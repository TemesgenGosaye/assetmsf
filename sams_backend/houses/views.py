"""
Views for the houses app.
"""
from rest_framework import generics, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone

from core.responses import StandardResponse
from core.permissions import IsAdminOrManager
from .models import House, HouseApplication
from .serializers import (
    HouseSerializer, HouseCreateUpdateSerializer,
    HouseApplicationListSerializer, HouseApplicationDetailSerializer,
    HouseApplicationCreateSerializer, HouseApplicationStatusSerializer,
)


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
        instance.soft_delete(request.user)
        return StandardResponse.no_content("House deleted successfully")


class HouseApplicationListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/houses/applications/"""

    queryset = HouseApplication.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "requested_house_category"]
    search_fields = ["application_no", "employee_name", "national_id"]
    ordering_fields = ["created_at", "submitted_at", "application_no"]
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
        instance.save(update_fields=["status", "submitted_at", "updated_at"])
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
