"""
Views for dashboard management.
"""
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from core.responses import StandardResponse
from core.permissions import IsAdminOrManager
from .serializers import (
    RecentActivitySerializer, SystemSettingsSerializer,
    PropertyLicenseSerializer, LicenseMetaSerializer
)
from .models import RecentActivity, SystemSettings, PropertyLicense, LicenseMeta


class RecentActivityListView(generics.ListAPIView):
    """List recent activity for current user."""
    serializer_class = RecentActivitySerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter activity for current user."""
        limit = self.request.query_params.get('limit', 20)
        return RecentActivity.objects.filter(
            user=self.request.user,
            is_active=True
        ).order_by('-created_at')[:int(limit)]
    
    def list(self, request, *args, **kwargs):
        """List activity with standard response format."""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Activity retrieved successfully")


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def log_activity(request):
    """Log activity for current user."""
    activity_type = request.data.get('type')
    message = request.data.get('message')
    metadata = request.data.get('metadata', {})
    
    if not activity_type or not message:
        return StandardResponse.bad_request("Type and message are required")
    
    RecentActivity.objects.create(
        user=request.user,
        type=activity_type,
        message=message,
        user_name=request.user.name or request.user.email,
        metadata=metadata,
        created_by=request.user
    )
    
    return StandardResponse.success(None, "Activity logged successfully")


class SystemSettingsView(generics.RetrieveUpdateAPIView):
    """Retrieve or update system settings."""
    serializer_class = SystemSettingsSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    
    def get_object(self):
        """Get or create system settings."""
        settings, created = SystemSettings.objects.get_or_create(id=True)
        return settings
    
    def retrieve(self, request, *args, **kwargs):
        """Retrieve settings with standard response format."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return StandardResponse.success(serializer.data, "Settings retrieved successfully")
    
    def update(self, request, *args, **kwargs):
        """Update settings with standard response format."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return StandardResponse.success(
                serializer.data,
                "Settings updated successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class PropertyLicenseListView(generics.ListCreateAPIView):
    """List and create property licenses."""
    queryset = PropertyLicense.objects.filter(is_active=True)
    serializer_class = PropertyLicenseSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    
    def list(self, request, *args, **kwargs):
        """List licenses with standard response format."""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Licenses retrieved successfully")
    
    def create(self, request, *args, **kwargs):
        """Create license with standard response format."""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return StandardResponse.created(
                serializer.data,
                "License created successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class PropertyLicenseDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a property license."""
    queryset = PropertyLicense.objects.filter(is_active=True)
    serializer_class = PropertyLicenseSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    lookup_field = 'property_id'
    
    def retrieve(self, request, *args, **kwargs):
        """Retrieve license with standard response format."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return StandardResponse.success(serializer.data, "License retrieved successfully")
    
    def update(self, request, *args, **kwargs):
        """Update license with standard response format."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return StandardResponse.success(
                serializer.data,
                "License updated successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)
    
    def destroy(self, request, *args, **kwargs):
        """Soft delete license."""
        instance = self.get_object()
        instance.soft_delete(request.user)
        return StandardResponse.no_content("License deleted successfully")


class LicenseMetaView(generics.RetrieveUpdateAPIView):
    """Retrieve or update license metadata."""
    serializer_class = LicenseMetaSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    lookup_field = 'key'
    
    def get_object(self):
        """Get or create license metadata."""
        key = self.kwargs.get('key', 'global_limits')
        meta, created = LicenseMeta.objects.get_or_create(key=key)
        return meta
    
    def retrieve(self, request, *args, **kwargs):
        """Retrieve metadata with standard response format."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return StandardResponse.success(serializer.data, "Metadata retrieved successfully")
    
    def update(self, request, *args, **kwargs):
        """Update metadata with standard response format."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return StandardResponse.success(
                serializer.data,
                "Metadata updated successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)
