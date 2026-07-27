"""
Views for the houses app.
"""
import csv
from django.http import HttpResponse
from django.db.models import Avg, Count, Q, Sum
from rest_framework import generics, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone

from core.responses import StandardResponse
from core.permissions import IsAdminOrManager
from .models import (
    House, HouseApplication, ScoringConfig, AllocationLog, get_eligible_category,
    HouseInspection, HouseMaintenanceRequest, HouseTransfer, HouseNotification,
)
from .serializers import (
    HouseSerializer, HouseCreateUpdateSerializer,
    HouseApplicationListSerializer, HouseApplicationDetailSerializer,
    HouseApplicationCreateSerializer, HouseApplicationStatusSerializer,
    ScoringConfigSerializer, AllocationLogSerializer,
    HouseInspectionSerializer, HouseMaintenanceRequestSerializer,
    HouseTransferSerializer, HouseNotificationSerializer,
)
from .allocation_engine import (
    calculate_priority_score, recalculate_all_scores, get_ranked_queue,
    auto_allocate_house, manual_allocate_house, deallocate_house,
    batch_allocate_all, process_house_transfer,
)
from .notifications_service import notify_status_change, send_house_notification


class HouseListCreateView(generics.ListCreateAPIView):
    """GET /api/houses/   POST /api/houses/"""

    queryset = House.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields  = ["house_type", "status"]
    search_fields     = ["house_id", "location", "description"]
    ordering_fields   = ["house_id", "location", "house_type", "status", "created_at"]
    ordering          = ["house_id"]

    def get_serializer_class(self):
        return HouseCreateUpdateSerializer if self.request.method == "POST" else HouseSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page     = self.paginate_queryset(queryset)
        if page is not None:
            serializer = HouseSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = HouseSerializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Houses retrieved successfully")

    def create(self, request, *args, **kwargs):
        serializer = HouseCreateUpdateSerializer(data=request.data)
        if serializer.is_valid():
            instance = serializer.save(created_by=request.user)
            return StandardResponse.created(
                HouseSerializer(instance).data, "House created successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class HouseDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/PATCH/DELETE /api/houses/<uuid:id>/"""

    queryset = House.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    lookup_field = "id"

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return HouseCreateUpdateSerializer
        return HouseSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        return StandardResponse.success(
            HouseSerializer(instance).data, "House retrieved successfully"
        )

    def update(self, request, *args, **kwargs):
        partial  = kwargs.pop("partial", False)
        instance = self.get_object()

        # Check if house is currently assigned / allocated
        is_assigned = instance.allocations.filter(is_active=True, status="Allocated").exists()
        if is_assigned:
            return StandardResponse.bad_request("Allocated houses cannot be edited while assigned to an active user.")

        serializer = HouseCreateUpdateSerializer(
            instance, data=request.data, partial=partial
        )
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return StandardResponse.success(
                HouseSerializer(instance).data, "House updated successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        # Check if house is currently assigned / allocated
        is_assigned = instance.allocations.filter(is_active=True, status="Allocated").exists()
        if is_assigned:
            return StandardResponse.bad_request("Allocated houses cannot be deleted while assigned to an active user.")

        instance.soft_delete(request.user)
        return StandardResponse.no_content("House deleted successfully")


class HouseApplicationListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/houses/applications/"""

    queryset = HouseApplication.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "requested_house_category", "eligible_house_category"]
    search_fields = ["application_no", "employee_name", "national_id"]
    ordering_fields = ["created_at", "submitted_at", "application_no", "priority_score"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return HouseApplicationCreateSerializer
        return HouseApplicationListSerializer

    def get_queryset(self):
        qs = HouseApplication.objects.filter(is_active=True)
        user = self.request.user
        if user.is_requester():
            qs = qs.filter(requester=user)
        return qs

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = HouseApplicationListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = HouseApplicationListSerializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Applications retrieved successfully")

    def create(self, request, *args, **kwargs):
        serializer = HouseApplicationCreateSerializer(data=request.data)
        if serializer.is_valid():
            instance = serializer.save(requester=request.user)
            return StandardResponse.created(
                HouseApplicationDetailSerializer(instance).data,
                "Application created successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class HouseApplicationDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/PATCH/DELETE /api/houses/applications/<uuid:id>/"""

    queryset = HouseApplication.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    lookup_field = "id"

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return HouseApplicationCreateSerializer
        return HouseApplicationDetailSerializer

    def get_queryset(self):
        qs = HouseApplication.objects.filter(is_active=True)
        user = self.request.user
        if user.is_requester():
            qs = qs.filter(requester=user)
        return qs

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.is_requester() and instance.requester != request.user:
            return StandardResponse.forbidden("You can only view your own applications.")
        return StandardResponse.success(
            HouseApplicationDetailSerializer(instance).data,
            "Application retrieved successfully"
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        if request.user.is_requester() and instance.requester != request.user:
            return StandardResponse.forbidden("You can only edit your own applications.")

        if request.user.is_requester() and instance.status not in ("Draft", "Returned"):
            return StandardResponse.bad_request(
                "You can only edit applications in Draft or Returned status."
            )

        serializer = HouseApplicationCreateSerializer(
            instance, data=request.data, partial=partial
        )
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            # Recalculate score after update
            instance.refresh_from_db()
            instance.eligible_house_category = get_eligible_category(instance.job_grade)
            instance.priority_score = calculate_priority_score(instance)
            instance.save(update_fields=["eligible_house_category", "priority_score", "updated_at"])
            return StandardResponse.success(
                HouseApplicationDetailSerializer(instance).data,
                "Application updated successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.is_requester() and instance.requester != request.user:
            return StandardResponse.forbidden("You can only delete your own applications.")
        if request.user.is_requester() and instance.status != "Draft":
            return StandardResponse.bad_request("You can only delete applications in Draft status.")
        instance.soft_delete(request.user)
        return StandardResponse.no_content("Application deleted successfully")


class HouseApplicationSubmitView(generics.GenericAPIView):
    """POST /api/houses/applications/<uuid:id>/submit/ — move Draft → Submitted"""

    queryset = HouseApplication.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    lookup_field = "id"

    def post(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.is_requester() and instance.requester != request.user:
            return StandardResponse.forbidden("You can only submit your own applications.")
        if instance.status != "Draft":
            return StandardResponse.bad_request("Only Draft applications can be submitted.")
        instance.status = "Submitted"
        instance.submitted_at = timezone.now()
        # Auto-calculate eligible category and priority score on submission
        instance.eligible_house_category = get_eligible_category(instance.job_grade)
        instance.priority_score = calculate_priority_score(instance)
        instance.save(update_fields=[
            "status", "submitted_at", "eligible_house_category", "priority_score", "updated_at",
        ])
        notify_status_change(instance, "Draft", "Submitted", performed_by=request.user)
        return StandardResponse.success(
            HouseApplicationDetailSerializer(instance).data,
            "Application submitted successfully"
        )


class HouseApplicationStatusUpdateView(generics.GenericAPIView):
    """PATCH /api/houses/applications/<uuid:id>/status/ — admin status transitions"""

    queryset = HouseApplication.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    lookup_field = "id"

    def patch(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = HouseApplicationStatusSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return StandardResponse.validation_error("Validation failed", serializer.errors)

        new_status = serializer.validated_data.get("status")
        VALID_TRANSITIONS = {
            "Submitted": ["Under Review", "Returned"],
            "Under Review": ["Verified", "Rejected", "Returned"],
            "Verified": ["Waiting for Allocation", "Rejected"],
            "Waiting for Allocation": ["Allocated", "Rejected"],
            "Returned": ["Submitted"],
            "Rejected": [],
            "Allocated": [],
            "Draft": [],
        }

        allowed = VALID_TRANSITIONS.get(instance.status, [])
        if new_status not in allowed:
            return StandardResponse.bad_request(
                f"Cannot transition from '{instance.status}' to '{new_status}'."
            )

        instance.status = new_status
        if new_status == "Rejected":
            instance.rejection_reason = serializer.validated_data.get("rejection_reason", "")
        if new_status == "Returned":
            instance.returned_reason = serializer.validated_data.get("returned_reason", "")
        if new_status in ("Under Review", "Verified", "Rejected", "Returned"):
            instance.reviewed_at = timezone.now()
            instance.reviewed_by = request.user
        instance.save()

        # Recalculate scores when status changes to queued states
        if new_status in ("Submitted", "Under Review", "Verified", "Waiting for Allocation"):
            instance.priority_score = calculate_priority_score(instance)
            instance.save(update_fields=["priority_score", "updated_at"])

        return StandardResponse.success(
            HouseApplicationDetailSerializer(instance).data,
            f"Application status updated to '{new_status}'"
        )


class HouseApplicationDashboardView(generics.GenericAPIView):
    """GET /api/houses/applications/dashboard/ — summary counts"""

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        qs = HouseApplication.objects.filter(is_active=True)
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
        }
        return StandardResponse.success(counts, "Dashboard data retrieved successfully")


# ── Queue View ────────────────────────────────────────────────────────

class HouseQueueView(generics.GenericAPIView):
    """GET /api/houses/queue/ — ranked queue by priority score"""

    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def get(self, request, *args, **kwargs):
        category = request.query_params.get("category")
        # Scores are calculated on submit/status-change/config-save.
        # Only recalculate if explicitly requested via ?recalculate=true
        if request.query_params.get("recalculate") == "true":
            recalculate_all_scores(category)
        queue = get_ranked_queue(category)
        serializer = HouseApplicationListSerializer(queue, many=True)
        return StandardResponse.success(serializer.data, "Queue retrieved successfully")


# ── Auto-Allocate View ────────────────────────────────────────────────

class AutoAllocateView(generics.GenericAPIView):
    """POST /api/houses/auto-allocate/ — auto-allocate a house to a specific or highest-priority applicant"""

    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request, *args, **kwargs):
        house_id = request.data.get("house_id")
        application_id = request.data.get("application_id")
        if not house_id:
            return StandardResponse.bad_request("house_id is required.")

        try:
            house = House.objects.get(id=house_id, is_active=True)
        except House.DoesNotExist:
            return StandardResponse.not_found("House not found.")

        if house.status == "Inactive":
            return StandardResponse.bad_request("House is not available (inactive).")

        winner = auto_allocate_house(house, user=request.user, application_id=application_id)
        if not winner:
            return StandardResponse.bad_request(
                f"No eligible applicants found for house type '{house.house_type}'."
            )

        return StandardResponse.success(
            HouseApplicationDetailSerializer(winner).data,
            f"House {house.house_id} allocated to {winner.employee_name} (score: {winner.priority_score})"
        )


# ── Batch Allocate View ────────────────────────────────────────────

class BatchAllocateView(generics.GenericAPIView):
    """POST /api/houses/batch-allocate/ — allocate ALL available houses at once"""

    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request, *args, **kwargs):
        results = batch_allocate_all(user=request.user)
        allocated = [r for r in results if r["allocated_to"]]
        skipped = [r for r in results if not r["allocated_to"]]

        return StandardResponse.success(
            {"allocated": allocated, "skipped": skipped, "total_houses": len(results)},
            f"{len(allocated)} of {len(results)} houses allocated successfully."
        )


# ── Manual Allocate View ──────────────────────────────────────────────

class ManualAllocateView(generics.GenericAPIView):
    """POST /api/houses/manual-allocate/ — manually allocate a house to a specific application"""

    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request, *args, **kwargs):
        house_id = request.data.get("house_id")
        application_id = request.data.get("application_id")
        notes = request.data.get("notes", "")

        if not house_id or not application_id:
            return StandardResponse.bad_request("house_id and application_id are required.")

        try:
            house = House.objects.get(id=house_id, is_active=True)
        except House.DoesNotExist:
            return StandardResponse.not_found("House not found.")

        try:
            application = HouseApplication.objects.get(id=application_id, is_active=True)
        except HouseApplication.DoesNotExist:
            return StandardResponse.not_found("Application not found.")

        if house.status == "Inactive":
            return StandardResponse.bad_request("House is not available (inactive).")

        if house.house_type != application.eligible_house_category:
            return StandardResponse.bad_request(
                f"House type '{house.house_type}' does not match applicant's "
                f"eligible category '{application.eligible_house_category}'."
            )

        result = manual_allocate_house(house, application, user=request.user, notes=notes)
        return StandardResponse.success(
            HouseApplicationDetailSerializer(result).data,
            f"House {house.house_id} manually allocated to {result.employee_name}"
        )


# ── Deallocate View ───────────────────────────────────────────────────

class DeallocateView(generics.GenericAPIView):
    """POST /api/houses/deallocate/ — reverse an allocation"""

    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request, *args, **kwargs):
        application_id = request.data.get("application_id")
        notes = request.data.get("notes", "")

        if not application_id:
            return StandardResponse.bad_request("application_id is required.")

        try:
            application = HouseApplication.objects.get(id=application_id, is_active=True)
        except HouseApplication.DoesNotExist:
            return StandardResponse.not_found("Application not found.")

        if application.status != "Allocated":
            return StandardResponse.bad_request("Only allocated applications can be deallocated.")

        if not application.allocated_house:
            return StandardResponse.bad_request(
                "This application has no allocated house to deallocate."
            )

        result = deallocate_house(application, user=request.user, notes=notes)
        return StandardResponse.success(
            HouseApplicationDetailSerializer(result).data,
            f"Allocation reversed for {result.employee_name}"
        )


# ── Scoring Config Views ──────────────────────────────────────────────

class ScoringConfigListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/houses/scoring-config/"""

    queryset = ScoringConfig.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    serializer_class = ScoringConfigSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = ScoringConfigSerializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Scoring configs retrieved successfully")

    def create(self, request, *args, **kwargs):
        serializer = ScoringConfigSerializer(data=request.data)
        if serializer.is_valid():
            instance = serializer.save(created_by=request.user)
            # Recalculate all scores with new config
            recalculate_all_scores()
            return StandardResponse.created(
                ScoringConfigSerializer(instance).data,
                "Scoring config created and scores recalculated"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class ScoringConfigDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/PATCH/DELETE /api/houses/scoring-config/<uuid:id>/"""

    queryset = ScoringConfig.objects.all()
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    serializer_class = ScoringConfigSerializer
    lookup_field = "id"

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = ScoringConfigSerializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            # Recalculate all scores with updated config
            recalculate_all_scores()
            return StandardResponse.success(
                ScoringConfigSerializer(instance).data,
                "Scoring config updated and scores recalculated"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


# ── Allocation Log View ───────────────────────────────────────────────

class AllocationLogListView(generics.ListAPIView):
    """GET /api/houses/allocation-logs/"""

    queryset = AllocationLog.objects.all()
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    serializer_class = AllocationLogSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["action", "application", "house"]
    ordering_fields = ["created_at", "priority_score"]
    ordering = ["-created_at"]

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = AllocationLogSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = AllocationLogSerializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Allocation logs retrieved successfully")
