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
    HouseOpportunity, Allocation, HouseAuditTrail,
)
from .serializers import (
    HouseSerializer, HouseCreateUpdateSerializer,
    HouseApplicationListSerializer, HouseApplicationDetailSerializer,
    HouseApplicationCreateSerializer, HouseApplicationStatusSerializer,
    ScoringConfigSerializer, EligibilityRuleSerializer, AllocationLogSerializer,
    HouseOpportunitySerializer, AllocationSerializer, HouseAuditTrailSerializer,
)
from .allocation_engine import (
    get_ranked_queue, auto_allocate_single, manual_allocate,
    deallocate, run_batch_allocation, determine_eligible_category,
    compute_mcda_score, topsis_rank, check_allocation_constraints,
    analyze_eligibility, generate_opportunities, rank_opportunities,
    allocate_application, override_allocate, terminate_allocation,
    record_audit, ALLOCATION_MODE_ROOM, ALLOCATION_MODE_HOUSE,
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
        results, best = analyze_eligibility(instance)
        cat = best
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
