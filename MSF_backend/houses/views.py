"""
Views for the houses app — CRUD, queue, allocation, scoring, logs.
"""
from rest_framework import generics, filters, status as http_status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db import transaction

from core.responses import StandardResponse
from core.permissions import IsAdminOrManager
from .models import (
    House, HouseApplication, HouseInspection, MaintenanceRequest,
    HouseTransfer, ScoringConfig, EligibilityRule, AllocationLog,
    HouseOpportunity, Allocation, HouseAuditTrail, HouseHandoverReceipt,
    TerminationCase, TerminationTransaction,
)
from .serializers import (
    HouseSerializer, HouseCreateUpdateSerializer,
    HouseApplicationListSerializer, HouseApplicationDetailSerializer,
    HouseApplicationCreateSerializer, HouseApplicationStatusSerializer,
    ScoringConfigSerializer, EligibilityRuleSerializer, AllocationLogSerializer,
    HouseOpportunitySerializer, AllocationSerializer, HouseAuditTrailSerializer,
    HouseHandoverReceiptSerializer, HouseHandoverReceiptCreateSerializer,
    HouseHandoverReceiptUpdateSerializer,
    TerminationCaseSerializer, TerminationTransactionSerializer,
    TerminationCreateSerializer, TerminationApprovalSerializer,
    TerminationVerifyCodeSerializer, TerminationResolveIssuesSerializer,
    TerminateWithCodeSerializer,
)
from .allocation_engine import (
    get_ranked_queue, auto_allocate_single, auto_allocate_cascade,
    manual_allocate,
    deallocate, run_batch_allocation, determine_eligible_category,
    compute_mcda_score, topsis_rank, check_allocation_constraints,
    analyze_eligibility, generate_opportunities, rank_opportunities,
    allocate_application, override_allocate, terminate_allocation,
    record_audit, ALLOCATION_MODE_ROOM, ALLOCATION_MODE_HOUSE,
    create_termination_transaction, approve_termination, process_termination,
    validate_termination, verify_termination_code,
    resolve_inspection_issues, terminate_with_code,
)


def _resolve_house(house_id):
    """Resolve a house by its HID (90-XXX-00) or its UUID pk."""
    try:
        return House.objects.get(house_id=house_id, is_active=True)
    except House.DoesNotExist:
        try:
            return House.objects.get(id=house_id, is_active=True)
        except House.DoesNotExist:
            return None

def _pre_validate_allocation(application, house):
    """
    Mandatory backend API gate to block any manual or automated cross-category allocation.
    Returns (is_valid: bool, error_response: Response|None).
    """
    from .allocation_engine import validate_applicant_grade
    valid, eligible_cat, reason = validate_applicant_grade(application)
    
    if not valid:
        return False, StandardResponse.bad_request(
            f"ELIGIBILITY_FAILED: {reason}",
            {
                "status": "NOT ELIGIBLE", 
                "recommendation": "NONE", 
                "assignment": "BLOCKED"
            }
        )
        
    if house and house.house_type != eligible_cat:
        return False, StandardResponse.bad_request(
            "HOUSE_CATEGORY_NOT_ELIGIBLE",
            {
                "status": "REJECTED", 
                "recommendation": "NONE", 
                "reason": "HOUSE_CATEGORY_NOT_ELIGIBLE",
                "eligible_category": eligible_cat, 
                "house_category": house.house_type,
                "detail": f"Grade {application.job_grade} → category '{eligible_cat}' only. House '{house.house_id}' is '{house.house_type}'."
            }
        )
        
    return True, None


def _require_waiting_for_allocation(application):
    """
    Hard gate: allocation is ONLY permitted when the application status is
    exactly "Waiting for Allocation".  This is the single enforcement point
    that ensures:
      - Only APPROVED (Verified → Waiting for Allocation) applications can be allocated.
      - Applications that are Submitted, Under Review, Verified, Rejected,
        Returned, or already Allocated are completely blocked.
    Returns (is_valid: bool, error_response: Response|None).
    """
    if application.status != "Waiting for Allocation":
        return False, StandardResponse.bad_request(
            "ALLOCATION_BLOCKED",
            {
                "status": "BLOCKED",
                "reason": (
                    f"Application '{application.application_no}' has status "
                    f"'{application.status}'. "
                    "Allocation is only permitted for applications with status "
                    "'Waiting for Allocation'. "
                    "Use the Smart Allocation Console to allocate queued applications."
                ),
                "current_status": application.status,
                "required_status": "Waiting for Allocation",
            },
        )
    return True, None

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  HOUSE CRUD
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class HouseListCreateView(generics.ListCreateAPIView):
    queryset = House.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["house_type", "status"]
    search_fields = ["house_id", "location", "description"]
    ordering_fields = ["house_id", "location", "house_type", "status", "created_at"]
    ordering = ["house_id"]

    def get_serializer_class(self):
        return HouseCreateUpdateSerializer if self.request.method == "POST" else HouseSerializer

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(HouseSerializer(page, many=True).data)
        return StandardResponse.success(HouseSerializer(qs, many=True).data, "Houses retrieved successfully")

    def create(self, request, *args, **kwargs):
        ser = HouseCreateUpdateSerializer(data=request.data)
        if ser.is_valid():
            instance = ser.save(created_by=request.user)
            return StandardResponse.created(HouseSerializer(instance).data, "House created successfully")
        return StandardResponse.validation_error("Validation failed", ser.errors)


class HouseDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = House.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    lookup_field = "id"

    def get_serializer_class(self):
        return HouseCreateUpdateSerializer if self.request.method in ("PUT", "PATCH") else HouseSerializer

    def retrieve(self, request, *args, **kwargs):
        return StandardResponse.success(HouseSerializer(self.get_object()).data, "House retrieved")

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        ser = HouseCreateUpdateSerializer(instance, data=request.data, partial=partial)
        if ser.is_valid():
            ser.save(updated_by=request.user)
            return StandardResponse.success(HouseSerializer(instance).data, "House updated")
        return StandardResponse.validation_error("Validation failed", ser.errors)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.soft_delete(request.user)
        return StandardResponse.no_content("House deleted")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  APPLICATIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class HouseApplicationListCreateView(generics.ListCreateAPIView):
    queryset = HouseApplication.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "requested_house_category"]
    search_fields = ["application_no", "employee_name", "national_id"]
    ordering_fields = ["created_at", "submitted_at", "application_no", "priority_score"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        return HouseApplicationCreateSerializer if self.request.method == "POST" else HouseApplicationListSerializer

    def get_queryset(self):
        qs = HouseApplication.objects.filter(is_active=True)
        if self.request.user.is_requester():
            qs = qs.filter(requester=self.request.user)
        return qs

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(HouseApplicationListSerializer(page, many=True).data)
        return StandardResponse.success(HouseApplicationListSerializer(qs, many=True).data, "Applications retrieved")

    def create(self, request, *args, **kwargs):
        ser = HouseApplicationCreateSerializer(data=request.data)
        if ser.is_valid():
            instance = ser.save(requester=request.user)
            return StandardResponse.created(HouseApplicationDetailSerializer(instance).data, "Application created")
        return StandardResponse.validation_error("Validation failed", ser.errors)


class HouseApplicationDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = HouseApplication.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    lookup_field = "id"

    def get_serializer_class(self):
        return HouseApplicationCreateSerializer if self.request.method in ("PUT", "PATCH") else HouseApplicationDetailSerializer

    def get_queryset(self):
        qs = HouseApplication.objects.filter(is_active=True)
        if self.request.user.is_requester():
            qs = qs.filter(requester=self.request.user)
        return qs

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        return StandardResponse.success(HouseApplicationDetailSerializer(instance).data, "Application retrieved")

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        ser = HouseApplicationCreateSerializer(instance, data=request.data, partial=partial)
        if ser.is_valid():
            ser.save(updated_by=request.user)
            return StandardResponse.success(HouseApplicationDetailSerializer(instance).data, "Application updated")
        return StandardResponse.validation_error("Validation failed", ser.errors)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.soft_delete(request.user)
        return StandardResponse.no_content("Application deleted")


class HouseApplicationSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        pk = kwargs.get("id")
        try:
            instance = HouseApplication.objects.get(id=pk, is_active=True)
        except HouseApplication.DoesNotExist:
            return StandardResponse.not_found("Application not found")
        if instance.status != "Draft":
            return StandardResponse.bad_request("Only Draft applications can be submitted")
        instance.status = "Submitted"
        instance.submitted_at = timezone.now()
        instance.save(update_fields=["status", "submitted_at", "updated_at"])
        record_audit(instance, HouseAuditTrail.Action.SUBMITTED, request.user,
                     old_status="Draft", new_status="Submitted",
                     note="Application submitted by employee")
        return StandardResponse.success(HouseApplicationDetailSerializer(instance).data, "Application submitted")


class HouseApplicationStatusUpdateView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def patch(self, request, *args, **kwargs):
        pk = kwargs.get("id")
        try:
            instance = HouseApplication.objects.get(id=pk, is_active=True)
        except HouseApplication.DoesNotExist:
            return StandardResponse.not_found("Application not found")

        ser = HouseApplicationStatusSerializer(data=request.data, partial=True)
        if not ser.is_valid():
            return StandardResponse.validation_error("Validation failed", ser.errors)

        new_status = ser.validated_data.get("status")
        VALID_TRANSITIONS = {
            "Submitted":              ["Under Review", "Verified", "Returned"],
            "Under Review":           ["Verified", "Rejected", "Returned"],
            "Verified":               ["Waiting for Allocation", "Rejected"],
            "Waiting for Allocation": ["Allocated", "Rejected"],
            "Returned":               ["Submitted"],
            "Rejected":               [],
            "Allocated":              [],
            "Draft":                  [],
        }
        allowed = VALID_TRANSITIONS.get(instance.status, [])
        if new_status not in allowed:
            return StandardResponse.bad_request(f"Cannot transition from '{instance.status}' to '{new_status}'")

        old_status = instance.status
        instance.status = new_status
        if new_status == "Rejected":
            instance.rejection_reason = ser.validated_data.get("rejection_reason", "")
        if new_status == "Returned":
            instance.returned_reason = ser.validated_data.get("returned_reason", "")
        if new_status in ("Under Review", "Verified", "Rejected", "Returned"):
            instance.reviewed_at = timezone.now()
            instance.reviewed_by = request.user
        instance.save()

        AllocationLog.objects.create(
            application=instance,
            application_no=instance.application_no,
            employee_name=instance.employee_name,
            employee_id=instance.employee_id,
            house=instance.allocated_house,
            house_hid=instance.allocated_house.house_id if instance.allocated_house else "",
            action=AllocationLog.Action.STATUS_CHANGED,
            old_status=old_status,
            new_status=new_status,
            eligible_category=instance.eligible_house_category,
            performed_by=request.user,
            performed_by_name=request.user.get_full_name(),
        )
        record_audit(instance, HouseAuditTrail.Action.STATUS_CHANGED, request.user,
                     old_status=old_status, new_status=new_status,
                     detail={"reason": ser.validated_data.get("rejection_reason") or ser.validated_data.get("returned_reason") or ""},
                     note=f"Status → '{new_status}'")

        return StandardResponse.success(HouseApplicationDetailSerializer(instance).data, f"Status → '{new_status}'")


class HouseApplicationDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        qs = HouseApplication.objects.filter(is_active=True)
        houses_qs = House.objects.filter(is_active=True)
        user = request.user
        if user.is_requester():
            qs = qs.filter(requester=user)

        counts = {
            "total": qs.count(),
            "draft": qs.filter(status="Draft").count(),
            "submitted": qs.filter(status="Submitted").count(),
            "under_review": qs.filter(status="Under Review").count(),
            "verified": qs.filter(status="Verified").count(),
            "waiting_for_allocation": qs.filter(status="Waiting for Allocation").count(),
            "allocated": qs.filter(status="Allocated").count(),
            "rejected": qs.filter(status="Rejected").count(),
            "returned": qs.filter(status="Returned").count(),
            "total_houses": houses_qs.count(),
            "active_houses": houses_qs.filter(status="Active").count(),
            "inactive_houses": houses_qs.filter(status="Inactive").count(),
            "houses_by_type": {
                "Staff": houses_qs.filter(house_type="Staff").count(),
                "A": houses_qs.filter(house_type="A").count(),
                "B": houses_qs.filter(house_type="B").count(),
                "C": houses_qs.filter(house_type="C").count(),
                "D": houses_qs.filter(house_type="D").count(),
                "E": houses_qs.filter(house_type="E").count(),
            },
        }
        return StandardResponse.success(counts, "Dashboard retrieved")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  QUEUE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class HouseQueueView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        category = request.query_params.get("category")
        recalculate = request.query_params.get("recalculate", "").lower() == "true"
        apps = get_ranked_queue(category=category, recalculate=recalculate)
        data = HouseApplicationListSerializer(apps, many=True).data
        return StandardResponse.success(data, "Queue retrieved")


class HouseApplicationRecalcScoreView(APIView):
    """Recompute a single application's eligibility + MCDA/TOPSIS score
    and refresh its queue position. Returns the enriched detail payload."""

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        pk = kwargs.get("id")
        try:
            instance = HouseApplication.objects.get(id=pk, is_active=True)
        except HouseApplication.DoesNotExist:
            return StandardResponse.not_found("Application not found")

        config = ScoringConfig.objects.filter(is_active=True).first()
        results, _ = analyze_eligibility(instance)
        cat, _ = determine_eligible_category(instance)
        total, breakdown, reasons = compute_mcda_score(instance, config)
        instance.eligible_house_category = cat
        instance.eligibility_analysis = results
        instance.priority_score = total
        instance.score_breakdown = breakdown
        instance.save(update_fields=[
            "eligible_house_category", "eligibility_analysis", "priority_score",
            "score_breakdown", "updated_at",
        ])

        # Re-rank the live queue so queue_position reflects the new score.
        ranked = get_ranked_queue(recalculate=False)
        for rank, app in enumerate(ranked, 1):
            if app.id == instance.id:
                instance.queue_position = rank
                instance.save(update_fields=["queue_position", "updated_at"])
                break

        record_audit(instance, HouseAuditTrail.Action.SCORE_RECALCULATED, request.user,
                     new_status=instance.status,
                     detail={"priority_score": str(total), "eligible_category": cat},
                     note=f"Score recalculated ({total})")

        return StandardResponse.success(
            HouseApplicationDetailSerializer(instance).data,
            "Score recalculated and queue re-ranked",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  ALLOCATION ACTIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class AutoAllocateView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request, *args, **kwargs):
        house_id = request.data.get("house_id")
        app_id = request.data.get("application_id")
        mode = request.data.get("mode", "cascade")  # "cascade" (default) or "single"
        dry_run = str(request.data.get("dry_run", "false")).lower() in ("true", "1", "yes")

        # ── Cascade mode (new): walk eligible categories, R1→R2→R3 ─────
        if mode == "cascade" and app_id:
            try:
                target_app = HouseApplication.objects.get(id=app_id, is_active=True)
            except HouseApplication.DoesNotExist:
                return StandardResponse.not_found("Application not found")

            # Gate 1: must be "Waiting for Allocation"
            ok, err = _require_waiting_for_allocation(target_app)
            if not ok:
                return err

            valid, err_response = _pre_validate_allocation(target_app, None)
            if not valid:
                return err_response

            allocated, result = auto_allocate_cascade(
                target_app, request.user, dry_run=dry_run,
            )
            if allocated:
                msg = (
                    f"{'[DRY RUN] Would allocate' if dry_run else 'Allocated'} "
                    f"{result['employee_name']} → {result['resource']}"
                )
            else:
                msg = f"Skipped: {result.get('skip_reason', 'No house available')}"
            return StandardResponse.success(result, msg)

        # ── Single-house mode (legacy): allocate a specific house ────────
        if house_id:
            try:
                house = House.objects.get(house_id=house_id, is_active=True)
            except House.DoesNotExist:
                try:
                    house = House.objects.get(id=house_id, is_active=True)
                except House.DoesNotExist:
                    return StandardResponse.not_found(f"House '{house_id}' not found")
        else:
            available = [
                h for h in House.objects.filter(
                    is_active=True, status=House.Status.ACTIVE,
                ).exclude(allocation_category=House.AllocationCategory.GUEST)
                if h.is_available
            ]
            if not available:
                return StandardResponse.bad_request("No available vacant houses found")
            house = available[0]

        target_app = None
        if app_id:
            try:
                target_app = HouseApplication.objects.get(id=app_id, is_active=True)
            except HouseApplication.DoesNotExist:
                return StandardResponse.not_found("Application not found")

            # Gate 1: must be "Waiting for Allocation"
            ok, err = _require_waiting_for_allocation(target_app)
            if not ok:
                return err

            valid, err_response = _pre_validate_allocation(target_app, house)
            if not valid:
                return err_response

        try:
            app, breakdown, reasons = auto_allocate_single(
                house, target_app, request.user,
                room_label=request.data.get("room_label", ""),
            )
            return StandardResponse.success(
                HouseApplicationDetailSerializer(app).data,
                f"House {house.house_id} allocated to {app.employee_name}"
            )
        except ValueError as e:
            return StandardResponse.bad_request(str(e))


class BatchAllocateView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request, *args, **kwargs):
        raw = request.data.get("dry_run")
        if raw is None:
            raw = request.query_params.get("dry_run")
        dry_run = str(raw).strip().lower() in ("true", "1", "yes")
        result = run_batch_allocation(user=request.user, dry_run=dry_run)
        if dry_run:
            message = f"Dry-run preview: {len(result['allocated'])} would be allocated, {len(result['skipped'])} skipped"
        else:
            message = f"Batch allocation complete: {len(result['allocated'])} allocated, {len(result['skipped'])} skipped"
        return StandardResponse.success(result, message)


class ManualAllocateView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request, *args, **kwargs):
        house_id = request.data.get("house_id")
        app_id = request.data.get("application_id")
        notes = request.data.get("notes", "")

        if not house_id or not app_id:
            return StandardResponse.bad_request("house_id and application_id are required")

        try:
            house = House.objects.get(house_id=house_id, is_active=True)
        except House.DoesNotExist:
            try:
                house = House.objects.get(id=house_id, is_active=True)
            except House.DoesNotExist:
                return StandardResponse.not_found(f"House '{house_id}' not found")
        try:
            app = HouseApplication.objects.get(id=app_id, is_active=True)
        except HouseApplication.DoesNotExist:
            return StandardResponse.not_found("Application not found")

        # Gate: allocation only allowed when status is 'Waiting for Allocation'
        ok, err = _require_waiting_for_allocation(app)
        if not ok:
            return err

        valid, err_response = _pre_validate_allocation(app, house)
        if not valid:
            return err_response

        try:
            app = manual_allocate(
                house, app, request.user, notes,
                room_label=request.data.get("room_label", ""),
            )
            return StandardResponse.success(HouseApplicationDetailSerializer(app).data, "Manual allocation complete")
        except ValueError as e:
            return StandardResponse.bad_request(str(e))


class DeallocateView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request, *args, **kwargs):
        app_id = request.data.get("application_id")
        reason = request.data.get("notes", "")
        if not app_id:
            return StandardResponse.bad_request("application_id is required")
        try:
            app = HouseApplication.objects.get(id=app_id, is_active=True)
        except HouseApplication.DoesNotExist:
            return StandardResponse.not_found("Application not found")

        try:
            app = deallocate(app, request.user, reason)
            return StandardResponse.success(HouseApplicationDetailSerializer(app).data, "Deallocation complete")
        except ValueError as e:
            return StandardResponse.bad_request(str(e))


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  SCORING CONFIG
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class ScoringConfigListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    queryset = ScoringConfig.objects.all()
    serializer_class = ScoringConfigSerializer

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        return StandardResponse.success(ScoringConfigSerializer(qs, many=True).data, "Scoring configs retrieved")

    def create(self, request, *args, **kwargs):
        ser = ScoringConfigSerializer(data=request.data)
        if ser.is_valid():
            instance = ser.save(created_by=request.user)
            return StandardResponse.created(ScoringConfigSerializer(instance).data, "Scoring config created")
        return StandardResponse.validation_error("Validation failed", ser.errors)


class ScoringConfigDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    queryset = ScoringConfig.objects.all()
    serializer_class = ScoringConfigSerializer


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  ELIGIBILITY RULES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class EligibilityRuleListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    queryset = EligibilityRule.objects.all()
    serializer_class = EligibilityRuleSerializer

    def list(self, request, *args, **kwargs):
        return StandardResponse.success(EligibilityRuleSerializer(self.get_queryset(), many=True).data, "Rules retrieved")

    def create(self, request, *args, **kwargs):
        ser = EligibilityRuleSerializer(data=request.data)
        if ser.is_valid():
            instance = ser.save(created_by=request.user)
            return StandardResponse.created(EligibilityRuleSerializer(instance).data, "Rule created")
        return StandardResponse.validation_error("Validation failed", ser.errors)


class EligibilityRuleDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    queryset = EligibilityRule.objects.all()
    serializer_class = EligibilityRuleSerializer


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  ALLOCATION LOGS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class AllocationLogListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    queryset = AllocationLog.objects.all()
    serializer_class = AllocationLogSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["action", "employee_id"]
    search_fields = ["application_no", "employee_name", "employee_id", "house_id"]
    ordering_fields = ["created_at", "priority_score"]
    ordering = ["-created_at"]

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(AllocationLogSerializer(page, many=True).data)
        return StandardResponse.success(AllocationLogSerializer(qs, many=True).data, "Allocation logs retrieved")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  REVIEW QUEUE OVERVIEW  (real KPIs for the House Review Queue)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class ReviewOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        qs = HouseApplication.objects.filter(is_active=True)
        houses = House.objects.filter(is_active=True)

        counts = {s: qs.filter(status=s).count() for s in HouseApplication.Status.values}
        total_queue = sum(counts.get(s, 0) for s in [
            HouseApplication.Status.SUBMITTED,
            HouseApplication.Status.UNDER_REVIEW,
            HouseApplication.Status.VERIFIED,
            HouseApplication.Status.WAITING_FOR_ALLOCATION,
        ])

        ranked = get_ranked_queue(recalculate=False)
        avg_score = round(sum(float(a.priority_score) for a in ranked) / len(ranked), 4) if ranked else 0
        high_priority = sum(1 for a in ranked if float(a.priority_score) >= 25)

        available_houses = sum(
            1 for h in houses
            if h.is_available and h.allocation_category != House.AllocationCategory.GUEST
        )
        active_allocations = Allocation.objects.filter(status=Allocation.Status.ACTIVE).count()

        data = {
            "total_queue": total_queue,
            "submitted": counts.get(HouseApplication.Status.SUBMITTED, 0),
            "under_review": counts.get(HouseApplication.Status.UNDER_REVIEW, 0),
            "verified": counts.get(HouseApplication.Status.VERIFIED, 0),
            "waiting_for_allocation": counts.get(HouseApplication.Status.WAITING_FOR_ALLOCATION, 0),
            "allocated": counts.get(HouseApplication.Status.ALLOCATED, 0),
            "rejected": counts.get(HouseApplication.Status.REJECTED, 0),
            "returned": counts.get(HouseApplication.Status.RETURNED, 0),
            "average_score": avg_score,
            "high_priority": high_priority,
            "available_houses": available_houses,
            "active_allocations": active_allocations,
            "houses_by_type": {
                t: houses.filter(house_type=t).count() for t in
                ["Staff", "A", "B", "C", "D", "E"]
            },
            "allocations_by_type": {
                t: Allocation.objects.filter(status=Allocation.Status.ACTIVE, house__house_type=t).count()
                for t in ["Staff", "A", "B", "C", "D", "E"]
            },
            "allocations_by_unit": {
                "house": Allocation.objects.filter(
                    status=Allocation.Status.ACTIVE,
                    allocation_unit_type=ALLOCATION_MODE_HOUSE,
                ).count(),
                "room": Allocation.objects.filter(
                    status=Allocation.Status.ACTIVE,
                    allocation_unit_type=ALLOCATION_MODE_ROOM,
                ).count(),
            },
        }
        return StandardResponse.success(data, "Review overview retrieved")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  HOUSE OPPORTUNITIES  (house_opp)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class HouseOpportunityListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    queryset = HouseOpportunity.objects.filter(is_active=True)
    serializer_class = HouseOpportunitySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["application", "house", "status", "recommendation"]
    search_fields = ["application__application_no", "house__house_id", "house__location"]
    ordering_fields = ["compatibility_score", "rank", "priority_score"]
    ordering = ["rank", "-compatibility_score"]

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(HouseOpportunitySerializer(page, many=True).data)
        return StandardResponse.success(HouseOpportunitySerializer(qs, many=True).data, "Opportunities retrieved")


class ApplicationOpportunitiesView(APIView):
    """List the ranked house_opp shortlist for one application."""
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        pk = kwargs.get("id")
        try:
            application = HouseApplication.objects.get(id=pk, is_active=True)
        except HouseApplication.DoesNotExist:
            return StandardResponse.not_found("Application not found")

        opps = application.opportunities.select_related("house").order_by("rank", "-compatibility_score")
        return StandardResponse.success(HouseOpportunitySerializer(opps, many=True).data, "Opportunities retrieved")


class GenerateOpportunitiesView(APIView):
    """Generate + rank the house_opp shortlist for an application."""
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request, *args, **kwargs):
        pk = kwargs.get("id")
        try:
            application = HouseApplication.objects.get(id=pk, is_active=True)
        except HouseApplication.DoesNotExist:
            return StandardResponse.not_found("Application not found")

        try:
            created = generate_opportunities(application, request.user)
            ranked = rank_opportunities(application, request.user)
            opps = application.opportunities.select_related("house").order_by("rank", "-compatibility_score")
            return StandardResponse.success({
                "generated": created,
                "ranked": ranked,
                "opportunities": HouseOpportunitySerializer(opps, many=True).data,
            }, f"Generated {created} and ranked {ranked} opportunities")
        except Exception as e:
            return StandardResponse.bad_request(str(e))


class RankOpportunitiesView(APIView):
    """Re-rank an application's existing house_opp shortlist."""
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request, *args, **kwargs):
        pk = kwargs.get("id")
        try:
            application = HouseApplication.objects.get(id=pk, is_active=True)
        except HouseApplication.DoesNotExist:
            return StandardResponse.not_found("Application not found")

        ranked = rank_opportunities(application, request.user)
        opps = application.opportunities.select_related("house").order_by("rank", "-compatibility_score")
        return StandardResponse.success({
            "ranked": ranked,
            "opportunities": HouseOpportunitySerializer(opps, many=True).data,
        }, f"Ranked {ranked} opportunities")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  ALLOCATIONS  (Allocated House module)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class AllocationListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Allocation.objects.filter(is_active=True)
    serializer_class = AllocationSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "allocation_type", "house", "application", "occupancy_status"]
    search_fields = [
        "allocation_no", "employee_name", "employee_id",
        "house__house_id", "application__application_no",
    ]
    ordering_fields = ["allocated_at", "priority_score", "confidence"]
    ordering = ["-allocated_at"]

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(AllocationSerializer(page, many=True).data)
        return StandardResponse.success(AllocationSerializer(qs, many=True).data, "Allocations retrieved")


class AllocationDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Allocation.objects.filter(is_active=True)
    serializer_class = AllocationSerializer
    lookup_field = "id"

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        return StandardResponse.success(AllocationSerializer(instance).data, "Allocation retrieved")


class AllocateView(APIView):
    """
    Unified allocation endpoint.
    Body: {house_id, application_id, allocation_type (Auto|Manual|Override),
           notes?, override_reason?}
    """
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request, *args, **kwargs):
        house_id = request.data.get("house_id")
        app_id = request.data.get("application_id")
        allocation_type = str(request.data.get("allocation_type", "Manual")).capitalize()
        notes = request.data.get("notes", "")
        override_reason = request.data.get("override_reason", "")
        room_label = request.data.get("room_label", "")

        if not house_id or not app_id:
            return StandardResponse.bad_request("house_id and application_id are required")

        house = _resolve_house(house_id)
        if house is None:
            return StandardResponse.not_found(f"House '{house_id}' not found")
        try:
            app = HouseApplication.objects.get(id=app_id, is_active=True)
        except HouseApplication.DoesNotExist:
            return StandardResponse.not_found("Application not found")

        # Gate: allocation only allowed when status is 'Waiting for Allocation'
        ok, err = _require_waiting_for_allocation(app)
        if not ok:
            return err

        valid, err_response = _pre_validate_allocation(app, house)
        if not valid:
            return err_response

        try:
            if allocation_type == "Auto":
                allocation = allocate_application(app, house, request.user, "Auto", notes=notes, room_label=room_label)
            elif allocation_type == "Override":
                if not override_reason.strip():
                    return StandardResponse.bad_request("override_reason is required for manual overrides")
                allocation = override_allocate(house, app, request.user, override_reason, notes, room_label=room_label)
            else:
                allocation = allocate_application(app, house, request.user, "Manual", notes=notes, room_label=room_label)
            return StandardResponse.success(
                AllocationSerializer(allocation).data,
                f"Allocated {house.house_id} to {app.employee_name}",
            )
        except ValueError as e:
            return StandardResponse.bad_request(str(e))


class TerminateAllocationView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request, *args, **kwargs):
        pk = kwargs.get("id")
        reason = request.data.get("notes", "") or request.data.get("reason", "")
        move_to_queue = str(request.data.get("move_to_queue", "true")).lower() != "false"

        try:
            allocation = Allocation.objects.get(id=pk, is_active=True)
        except Allocation.DoesNotExist:
            return StandardResponse.not_found("Allocation not found")

        try:
            allocation = terminate_allocation(allocation, request.user, reason, move_to_queue)
            return StandardResponse.success(AllocationSerializer(allocation).data, "Allocation terminated")
        except ValueError as e:
            return StandardResponse.bad_request(str(e))


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  AUDIT TIMELINE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class ApplicationAuditView(APIView):
    """Merged audit timeline (generic trail + allocation logs) for an application."""
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        pk = kwargs.get("id")
        try:
            application = HouseApplication.objects.get(id=pk, is_active=True)
        except HouseApplication.DoesNotExist:
            return StandardResponse.not_found("Application not found")

        audit = HouseAuditTrailSerializer(application.audit_trail.all(), many=True).data
        logs = AllocationLogSerializer(application.allocation_logs.all(), many=True).data
        return StandardResponse.success({
            "audit": audit,
            "logs": logs,
        }, "Audit timeline retrieved")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  HOUSE HANDOVER RECEIPT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _handover_user_name(user) -> str:
    return getattr(user, "name", "") or getattr(user, "username", "")


def _extract_inspection_prefill(house):
    """Pre-fill receipt inspection sections from the latest completed Move-In inspection."""
    insp = (
        HouseInspection.objects.filter(
            house=house,
            inspection_type=HouseInspection.InspectionType.MOVE_IN,
            status=HouseInspection.Status.COMPLETED,
            is_active=True,
        )
        .order_by("-completed_date")
        .first()
    )
    if not insp:
        return "", "", "", ""

    checklist = insp.checklist_results or {}
    findings = (insp.findings or "").strip()

    def damage_line(key, label):
        val = checklist.get(key)
        if val is True or str(val).lower() == "true":
            return f"{label}: Damaged"
        return ""

    electrical = "\n".join(
        p for p in [damage_line("switch", "Switch"), damage_line("bulb", "Bulb")] if p
    )
    structural = "\n".join(
        p for p in [
            damage_line("door", "Door"),
            damage_line("windows", "Windows"),
            damage_line("walls", "Walls"),
        ] if p
    )
    water = damage_line("water", "Water")
    admin = findings
    return electrical, structural, water, admin


def _build_handover_receipt_defaults(allocation):
    """Snapshot allocation/application/house data for a new handover receipt."""
    app = allocation.application
    house = allocation.house
    emp = allocation.emp_record or app.emp_record

    department = ""
    if emp and getattr(emp, "department", None):
        department = emp.department.name

    elec, struct, water, admin = _extract_inspection_prefill(house)
    alloc_date = allocation.effective_date
    if not alloc_date and allocation.allocated_at:
        alloc_date = allocation.allocated_at.date()

    return {
        "application": app,
        "house": house,
        "employee_id": allocation.employee_id,
        "employee_name": allocation.employee_name,
        "job_position": app.job_position or "",
        "job_grade": app.job_grade or "",
        "department": department,
        "national_id": app.national_id or "",
        "marital_status": allocation.marital_status or app.marital_status or "",
        "family_size": allocation.family_size or app.family_size or 1,
        "house_number": house.house_number or house.house_id,
        "house_type": house.house_type,
        "house_location": house.location,
        "room_count": house.room_count,
        "allocation_no": allocation.allocation_no,
        "application_no": app.application_no,
        "allocation_date": alloc_date,
        "inspection_electrical": elec,
        "inspection_structural": struct,
        "inspection_water": water,
        "inspection_admin": admin,
        "committee_members": [],
        "doc_status": HouseHandoverReceipt.DocStatus.ACTIVE,
    }


class HandoverReceiptListCreateView(generics.ListCreateAPIView):
    """List handover receipts or generate one from an allocation (idempotent)."""
    permission_classes = [IsAuthenticated]
    serializer_class = HouseHandoverReceiptSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["allocation", "doc_status", "house"]
    search_fields = ["doc_number", "employee_name", "employee_id", "allocation_no"]
    ordering_fields = ["generated_date", "doc_number", "last_printed_at"]
    ordering = ["-generated_date"]

    def get_queryset(self):
        return HouseHandoverReceipt.objects.filter(is_active=True).select_related(
            "allocation", "application", "house", "generated_by", "printed_by",
        )

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(HouseHandoverReceiptSerializer(page, many=True).data)
        return StandardResponse.success(
            HouseHandoverReceiptSerializer(qs, many=True).data,
            "Handover receipts retrieved",
        )

    def create(self, request, *args, **kwargs):
        ser = HouseHandoverReceiptCreateSerializer(data=request.data)
        if not ser.is_valid():
            return StandardResponse.validation_error("Validation failed", ser.errors)

        allocation_id = ser.validated_data["allocation_id"]
        try:
            allocation = Allocation.objects.select_related(
                "application", "house", "emp_record__department",
            ).get(id=allocation_id, is_active=True)
        except Allocation.DoesNotExist:
            return StandardResponse.not_found("Allocation not found")

        if allocation.status != Allocation.Status.ACTIVE:
            return StandardResponse.bad_request("Receipt can only be generated for active allocations")

        with transaction.atomic():
            existing = HouseHandoverReceipt.objects.filter(
                allocation=allocation, is_active=True,
            ).first()
            if existing:
                return StandardResponse.success(
                    HouseHandoverReceiptSerializer(existing).data,
                    "Handover receipt already exists",
                )

            defaults = _build_handover_receipt_defaults(allocation)
            receipt = HouseHandoverReceipt.objects.create(
                allocation=allocation,
                generated_by=request.user,
                generated_by_name=_handover_user_name(request.user),
                created_by=request.user,
                **defaults,
            )

        return StandardResponse.created(
            HouseHandoverReceiptSerializer(receipt).data,
            "Handover receipt generated",
        )


class HandoverReceiptDetailView(generics.RetrieveUpdateAPIView):
    """Retrieve or update inspection notes / committee members before printing."""
    permission_classes = [IsAuthenticated]
    queryset = HouseHandoverReceipt.objects.filter(is_active=True)
    lookup_field = "id"

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return HouseHandoverReceiptUpdateSerializer
        return HouseHandoverReceiptSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        return StandardResponse.success(
            HouseHandoverReceiptSerializer(instance).data,
            "Handover receipt retrieved",
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        ser = HouseHandoverReceiptUpdateSerializer(instance, data=request.data, partial=True)
        if not ser.is_valid():
            return StandardResponse.validation_error("Validation failed", ser.errors)
        receipt = ser.save(updated_by=request.user)
        return StandardResponse.success(
            HouseHandoverReceiptSerializer(receipt).data,
            "Handover receipt updated",
        )


class HandoverReceiptPrintView(APIView):
    """Record a print or download event (increments reprint_count)."""
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        pk = kwargs.get("id")
        action = request.data.get("action", "printed")
        try:
            receipt = HouseHandoverReceipt.objects.get(id=pk, is_active=True)
        except HouseHandoverReceipt.DoesNotExist:
            return StandardResponse.not_found("Handover receipt not found")

        event = receipt.record_print_event(request.user, action=str(action))
        return StandardResponse.success(
            {
                "receipt": HouseHandoverReceiptSerializer(receipt).data,
                "event": event,
            },
            "Print event recorded",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  TERMINATION MANAGEMENT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TerminationCaseListCreateView(generics.ListCreateAPIView):
    """List or create termination cases (database-driven configuration)."""
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    serializer_class = TerminationCaseSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["category", "is_active"]
    search_fields = ["code", "name", "description"]
    ordering_fields = ["priority", "name", "code"]
    ordering = ["priority", "name"]

    def get_queryset(self):
        return TerminationCase.objects.all()

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        return StandardResponse.success(
            TerminationCaseSerializer(qs, many=True).data,
            "Termination cases retrieved",
        )

    def create(self, request, *args, **kwargs):
        ser = TerminationCaseSerializer(data=request.data)
        if ser.is_valid():
            instance = ser.save(created_by=request.user)
            return StandardResponse.created(
                TerminationCaseSerializer(instance).data,
                "Termination case created",
            )
        return StandardResponse.validation_error("Validation failed", ser.errors)


class TerminationCaseDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or soft-delete a termination case."""
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    queryset = TerminationCase.objects.all()
    lookup_field = "id"

    def get_serializer_class(self):
        return TerminationCaseSerializer

    def retrieve(self, request, *args, **kwargs):
        return StandardResponse.success(
            TerminationCaseSerializer(self.get_object()).data,
            "Termination case retrieved",
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        ser = TerminationCaseSerializer(instance, data=request.data, partial=partial)
        if ser.is_valid():
            ser.save(updated_by=request.user)
            return StandardResponse.success(
                TerminationCaseSerializer(instance).data,
                "Termination case updated",
            )
        return StandardResponse.validation_error("Validation failed", ser.errors)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])
        return StandardResponse.success(None, "Termination case deactivated")


class TerminationTransactionListCreateView(generics.ListCreateAPIView):
    """List or create termination transactions."""
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "case", "employee_id", "house", "approval_status"]
    search_fields = ["termination_no", "employee_name", "employee_id", "house_number"]
    ordering_fields = ["created_at", "effective_date", "termination_no"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return TerminationCreateSerializer
        return TerminationTransactionSerializer

    def get_queryset(self):
        return TerminationTransaction.objects.filter(is_active=True).select_related(
            "case", "allocation", "application", "house",
            "target_house", "approved_by", "created_by",
        )

    def list(self, request, *args, **kwargs):
        try:
            qs = self.filter_queryset(self.get_queryset())
            page = self.paginate_queryset(qs)
            if page is not None:
                return self.get_paginated_response(
                    TerminationTransactionSerializer(page, many=True).data
                )
            return StandardResponse.success(
                TerminationTransactionSerializer(qs, many=True).data,
                "Termination transactions retrieved",
            )
        except Exception as e:
            import logging
            logging.getLogger('django.request').error(
                "Error in TerminationTransactionListCreateView.list", exc_info=True
            )
            return StandardResponse.error(
                "Failed to retrieve termination transactions",
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def create(self, request, *args, **kwargs):
        ser = TerminationCreateSerializer(data=request.data)
        if not ser.is_valid():
            return StandardResponse.validation_error("Validation failed", ser.errors)

        data = ser.validated_data
        try:
            allocation = Allocation.objects.select_related("house", "application", "emp_record").get(
                id=data["allocation_id"], is_active=True
            )
        except Allocation.DoesNotExist:
            return StandardResponse.not_found("Allocation not found")

        try:
            case = TerminationCase.objects.get(id=data["case_id"], is_active=True)
        except TerminationCase.DoesNotExist:
            return StandardResponse.not_found("Termination case not found")

        try:
            termination, warnings = create_termination_transaction(
                allocation, case, request.user,
                employee_id=allocation.employee_id,
                effective_date=data["effective_date"],
                reason=data["reason"],
                target_house_id=data.get("target_house_id", ""),
                remarks=data.get("remarks", ""),
                requested_date=data.get("requested_date"),
            )
            result = TerminationTransactionSerializer(termination).data
            result["_warnings"] = warnings
            return StandardResponse.created(result, "Termination transaction created")
        except ValueError as e:
            return StandardResponse.bad_request(str(e))


class TerminationTransactionDetailView(generics.RetrieveAPIView):
    """Retrieve a termination transaction with full details."""
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    queryset = TerminationTransaction.objects.filter(is_active=True).select_related(
        "case", "allocation", "application", "house",
        "target_house", "target_allocation", "approved_by", "created_by",
    )
    lookup_field = "id"

    def retrieve(self, request, *args, **kwargs):
        return StandardResponse.success(
            TerminationTransactionSerializer(self.get_object()).data,
            "Termination transaction retrieved",
        )


class TerminationApproveView(APIView):
    """Approve or reject a pending termination transaction. Generates authorization code on approval."""
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request, *args, **kwargs):
        pk = kwargs.get("id")
        ser = TerminationApprovalSerializer(data=request.data)
        if not ser.is_valid():
            return StandardResponse.validation_error("Validation failed", ser.errors)

        try:
            termination = TerminationTransaction.objects.get(id=pk, is_active=True)
        except TerminationTransaction.DoesNotExist:
            return StandardResponse.not_found("Termination transaction not found")

        decision = ser.validated_data["decision"]
        notes = ser.validated_data.get("notes", "")

        try:
            if decision == "Rejected":
                termination.status = TerminationTransaction.Status.REJECTED
                termination.approval_status = TerminationTransaction.Status.REJECTED
                termination.approved_by = request.user
                termination.approval_date = timezone.now()
                termination.approval_notes = notes
                termination.save(update_fields=[
                    "status", "approval_status", "approved_by",
                    "approval_date", "approval_notes", "updated_at",
                ])
                record_audit(
                    termination.application,
                    HouseAuditTrail.Action.STATUS_CHANGED,
                    request.user,
                    old_status="Termination Pending",
                    new_status="Termination Rejected",
                    detail={"termination_no": termination.termination_no},
                    note=notes or "Termination rejected",
                )
                return StandardResponse.success(
                    TerminationTransactionSerializer(termination).data,
                    "Termination rejected",
                )

            termination, auth_code = approve_termination(termination, request.user, notes)
            result = TerminationTransactionSerializer(termination).data
            result["_authorization_code"] = auth_code
            return StandardResponse.success(
                result,
                "Termination approved. Authorization code generated.",
            )
        except ValueError as e:
            return StandardResponse.bad_request(str(e))


class TerminationVerifyCodeView(APIView):
    """Verify the termination authorization code before processing."""
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request, *args, **kwargs):
        pk = kwargs.get("id")
        ser = TerminationVerifyCodeSerializer(data=request.data)
        if not ser.is_valid():
            return StandardResponse.validation_error("Validation failed", ser.errors)

        try:
            termination = TerminationTransaction.objects.select_related(
                "allocation", "application", "house", "case",
            ).get(id=pk, is_active=True)
        except TerminationTransaction.DoesNotExist:
            return StandardResponse.not_found("Termination transaction not found")

        code = ser.validated_data["authorization_code"]
        is_valid, message = verify_termination_code(termination, code, request.user)

        if not is_valid:
            return StandardResponse.bad_request(message)

        termination.refresh_from_db()
        return StandardResponse.success(
            TerminationTransactionSerializer(termination).data,
            message,
        )


class TerminationResolveIssuesView(APIView):
    """Resolve inspection discrepancies for a termination transaction."""
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request, *args, **kwargs):
        pk = kwargs.get("id")
        ser = TerminationResolveIssuesSerializer(data=request.data)
        if not ser.is_valid():
            return StandardResponse.validation_error("Validation failed", ser.errors)

        try:
            termination = TerminationTransaction.objects.get(id=pk, is_active=True)
        except TerminationTransaction.DoesNotExist:
            return StandardResponse.not_found("Termination transaction not found")

        from .allocation_engine import resolve_inspection_issues
        try:
            termination = resolve_inspection_issues(
                termination,
                request.user,
                resolution_notes=ser.validated_data.get("resolution_notes", ""),
                force=ser.validated_data.get("force", False),
            )
            return StandardResponse.success(
                TerminationTransactionSerializer(termination).data,
                "Inspection issues resolved",
            )
        except ValueError as e:
            return StandardResponse.bad_request(str(e))


class TerminationProcessView(APIView):
    """
    Process (complete) an approved termination — closes allocation, releases house.
    SECURITY: Requires a verified authorization code. The termination must have
    gone through: create → approve → verify_code → process.
    """
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request, *args, **kwargs):
        pk = kwargs.get("id")
        auth_code = request.data.get("authorization_code", "")
        if not auth_code:
            return StandardResponse.bad_request("Authorization code is required to process termination")

        try:
            termination = TerminationTransaction.objects.select_related(
                "allocation", "application", "house", "case", "target_house",
            ).get(id=pk, is_active=True)
        except TerminationTransaction.DoesNotExist:
            return StandardResponse.not_found("Termination transaction not found")

        # Verify the authorization code matches what's stored
        if termination.authorization_code != str(auth_code).strip():
            return StandardResponse.bad_request("Invalid authorization code")

        if not termination.code_verified:
            return StandardResponse.bad_request(
                "Authorization code has not been verified. "
                "Call the verify-code endpoint first."
            )

        try:
            termination = process_termination(
                termination, request.user, authorization_code=auth_code,
            )
            return StandardResponse.success(
                TerminationTransactionSerializer(termination).data,
                "Termination processed successfully",
            )
        except ValueError as e:
            return StandardResponse.bad_request(str(e))


class TerminationStatsView(APIView):
    """Dashboard statistics for termination management."""
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        from django.db.models import Count

        base = TerminationTransaction.objects.filter(is_active=True)

        stats = {
            "total": base.count(),
            "pending": base.filter(status=TerminationTransaction.Status.PENDING).count(),
            "approved": base.filter(status=TerminationTransaction.Status.APPROVED).count(),
            "in_progress": base.filter(status=TerminationTransaction.Status.IN_PROGRESS).count(),
            "completed": base.filter(status=TerminationTransaction.Status.COMPLETED).count(),
            "rejected": base.filter(status=TerminationTransaction.Status.REJECTED).count(),
        }

        by_case = (
            base.values("case__code", "case__name", "case__category")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        stats["by_case"] = list(by_case)

        by_house_type = (
            base.values("house_type")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        stats["by_house_type"] = list(by_house_type)

        return StandardResponse.success(stats, "Termination statistics retrieved")


class AllocatedEmployeesListView(APIView):
    """List all employees with active allocations for termination selection."""
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def get(self, request, *args, **kwargs):
        allocations = (
            Allocation.objects
            .filter(status=Allocation.Status.ACTIVE, is_active=True)
            .select_related("house", "application", "emp_record")
            .order_by("-allocated_at")
        )

        result = []
        for alloc in allocations:
            app = alloc.application
            result.append({
                "allocation_id": str(alloc.id),
                "allocation_no": alloc.allocation_no,
                "employee_id": alloc.employee_id,
                "employee_name": alloc.employee_name,
                "job_position": app.job_position or "",
                "job_grade": app.job_grade or "",
                "marital_status": alloc.marital_status or app.marital_status or "",
                "family_size": alloc.family_size or app.family_size or 1,
                "house_id": str(alloc.house_id),
                "house_number": alloc.house.house_number or alloc.house.house_id,
                "house_type": alloc.house.house_type,
                "room_label": alloc.room_label or "",
                "unit_type": alloc.allocation_unit_type,
                "allocated_at": alloc.allocated_at.isoformat() if alloc.allocated_at else None,
                "application_no": app.application_no,
            })

        return StandardResponse.success(result, "Allocated employees retrieved")


class TerminateWithCodeView(APIView):
    """
    Terminate an allocation using a previously approved termination authorization code.

    This is the endpoint used by the Allocated Houses table sidebar. When a user
    clicks "Terminate" on an allocated house, they must enter the authorization
    code that was generated and approved from the Termination Management page.

    The backend validates:
      - Code exists, is valid, active, and belongs to this exact employee/allocation/house
      - Termination case matches the approved request
      - Inspection and house-condition requirements are satisfied
      - Admin/Manager approval exists
      - Allocation is still active

    Only after all verifications pass does the system execute the termination.
    """
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request, *args, **kwargs):
        pk = kwargs.get("id")
        ser = TerminateWithCodeSerializer(data=request.data)
        if not ser.is_valid():
            return StandardResponse.validation_error("Validation failed", ser.errors)

        try:
            allocation = Allocation.objects.select_related(
                "house", "application", "emp_record",
            ).get(id=pk, is_active=True)
        except Allocation.DoesNotExist:
            return StandardResponse.not_found("Allocation not found")

        auth_code = ser.validated_data["authorization_code"]
        reason = ser.validated_data.get("reason", "")

        try:
            termination = terminate_with_code(
                allocation, auth_code, request.user, reason=reason,
            )
            return StandardResponse.success(
                TerminationTransactionSerializer(termination).data,
                "Termination executed successfully via authorization code",
            )
        except ValueError as e:
            return StandardResponse.bad_request(str(e))
