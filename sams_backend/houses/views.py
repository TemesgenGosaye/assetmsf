"""
Views for the houses app.
"""
from rest_framework import generics, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from core.responses import StandardResponse
from .models import House
from .serializers import HouseSerializer, HouseCreateUpdateSerializer


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
