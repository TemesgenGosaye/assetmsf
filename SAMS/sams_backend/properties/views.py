"""
Views for property management.
"""
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from core.responses import StandardResponse
from core.permissions import IsAdminOrManager
from .serializers import PropertySerializer, PropertyCreateSerializer, PropertyUpdateSerializer
from .models import Property
from authentication.models import UserPropertyAccess


class PropertyListView(generics.ListCreateAPIView):
    """List and create properties."""
    queryset = Property.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        """Return appropriate serializer based on request method."""
        if self.request.method == 'POST':
            return PropertyCreateSerializer
        return PropertySerializer
    
    def get_queryset(self):
        """Filter queryset based on user permissions."""
        user = self.request.user
        if user.is_super_admin() or user.is_admin():
            return Property.objects.filter(is_active=True)
        
        # Check if user has all_properties permission
        from authentication.models import UserPermission
        has_all_props = UserPermission.objects.filter(
            user=user,
            page=UserPermission.Page.ALL_PROPERTIES,
            can_view=True
        ).exists()
        
        if has_all_props:
            return Property.objects.filter(is_active=True, status=Property.Status.ACTIVE)
        
        # Filter by user's property access
        accessible_property_ids = UserPropertyAccess.objects.filter(
            user=user
        ).values_list('property_id', flat=True)
        
        return Property.objects.filter(
            is_active=True,
            id__in=accessible_property_ids
        )
    
    def list(self, request, *args, **kwargs):
        """List properties with standard response format."""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Properties retrieved successfully")
    
    def create(self, request, *args, **kwargs):
        """Create property with standard response format."""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return StandardResponse.created(
                PropertySerializer(serializer.instance).data,
                "Property created successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class PropertyDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a property."""
    queryset = Property.objects.filter(is_active=True)
    serializer_class = PropertySerializer
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    lookup_field = 'id'
    
    def retrieve(self, request, *args, **kwargs):
        """Retrieve property with standard response format."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return StandardResponse.success(serializer.data, "Property retrieved successfully")
    
    def update(self, request, *args, **kwargs):
        """Update property with standard response format."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = PropertyUpdateSerializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return StandardResponse.success(
                PropertySerializer(serializer.instance).data,
                "Property updated successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)
    
    def destroy(self, request, *args, **kwargs):
        """Soft delete property."""
        instance = self.get_object()
        instance.soft_delete(request.user)
        return StandardResponse.no_content("Property deleted successfully")
