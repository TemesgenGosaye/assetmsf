"""
Views for asset management.
"""
from rest_framework import generics, status, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from core.responses import StandardResponse
from core.permissions import IsAdminOrManager
from .serializers import (
    AssetSerializer, AssetCreateSerializer, AssetUpdateSerializer,
    AssetAttachmentSerializer, AssetAttachmentCreateSerializer
)
from .models import Asset, AssetAttachment
from authentication.models import UserPropertyAccess, UserDepartmentAccess, UserPermission


class AssetListView(generics.ListCreateAPIView):
    """List and create assets."""
    queryset = Asset.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'condition', 'category', 'item_type', 'property', 'department']
    search_fields = ['name', 'asset_code', 'serial_number', 'barcode', 'description']
    ordering_fields = ['created_at', 'name', 'asset_code', 'purchase_date']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        """Return appropriate serializer based on request method."""
        if self.request.method == 'POST':
            return AssetCreateSerializer
        return AssetSerializer
    
    def get_queryset(self):
        """Filter queryset based on user permissions."""
        user = self.request.user
        queryset = Asset.objects.filter(is_active=True)
        
        if user.is_super_admin() or user.is_admin():
            return queryset
        
        # Check for all_properties permission
        has_all_props = UserPermission.objects.filter(
            user=user,
            page=UserPermission.Page.PROPERTIES,
            can_view=True
        ).exists()
        
        if has_all_props:
            return queryset.filter(property__status='active')
        
        # Filter by property access
        accessible_property_ids = UserPropertyAccess.objects.filter(
            user=user
        ).values_list('property_id', flat=True)
        
        if accessible_property_ids:
            queryset = queryset.filter(property_id__in=accessible_property_ids)
        
        # Filter by department access
        accessible_departments = UserDepartmentAccess.objects.filter(
            user=user
        ).values_list('department', flat=True)
        if accessible_departments:
            queryset = queryset.filter(department__in=accessible_departments)
        elif user.department:
            queryset = queryset.filter(department=user.department)
        else:
            queryset = Asset.objects.none()
        
        return queryset
    
    def list(self, request, *args, **kwargs):
        """List assets with standard response format."""
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Assets retrieved successfully")
    
    def create(self, request, *args, **kwargs):
        """Create asset with standard response format."""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return StandardResponse.created(
                AssetSerializer(serializer.instance).data,
                "Asset created successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class AssetDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete an asset."""
    queryset = Asset.objects.filter(is_active=True)
    serializer_class = AssetSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        """Lookup by UUID or asset_code."""
        queryset = self.filter_queryset(self.get_queryset())
        lookup_val = self.kwargs.get('id')
        
        import uuid
        try:
            uuid.UUID(str(lookup_val))
            obj = queryset.filter(id=lookup_val).first()
        except ValueError:
            obj = queryset.filter(asset_code=lookup_val).first()
            
        if not obj:
            from django.http import Http404
            raise Http404("No Asset matches the given query.")
            
        self.check_object_permissions(self.request, obj)
        return obj
        """Filter queryset based on user permissions."""
        user = self.request.user
        queryset = Asset.objects.filter(is_active=True)
        
        if user.is_super_admin() or user.is_admin():
            return queryset
        
        # Apply same filtering as list view
        accessible_property_ids = UserPropertyAccess.objects.filter(
            user=user
        ).values_list('property_id', flat=True)
        
        if accessible_property_ids:
            queryset = queryset.filter(property_id__in=accessible_property_ids)
        
        return queryset
    
    def retrieve(self, request, *args, **kwargs):
        """Retrieve asset with standard response format."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return StandardResponse.success(serializer.data, "Asset retrieved successfully")
    
    def update(self, request, *args, **kwargs):
        """Update asset with standard response format."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = AssetUpdateSerializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return StandardResponse.success(
                AssetSerializer(serializer.instance).data,
                "Asset updated successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)
    
    def destroy(self, request, *args, **kwargs):
        """Soft delete asset."""
        instance = self.get_object()
        instance.soft_delete(request.user)
        return StandardResponse.no_content("Asset deleted successfully")


class AssetAttachmentListView(generics.ListCreateAPIView):
    """List and create asset attachments."""
    queryset = AssetAttachment.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        """Return appropriate serializer based on request method."""
        if self.request.method == 'POST':
            return AssetAttachmentCreateSerializer
        return AssetAttachmentSerializer
    
    def get_queryset(self):
        """Filter attachments by asset, resolving asset_id."""
        asset_id = self.kwargs.get('asset_id')
        import uuid
        from django.shortcuts import get_object_or_404
        
        try:
            uuid.UUID(str(asset_id))
        except ValueError:
            asset = get_object_or_404(Asset, asset_code=asset_id, is_active=True)
            asset_id = asset.id
            
        return AssetAttachment.objects.filter(asset_id=asset_id, is_active=True)
    
    def list(self, request, *args, **kwargs):
        """List attachments with standard response format."""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Attachments retrieved successfully")
    
    def create(self, request, *args, **kwargs):
        """Create attachment with standard response format."""
        asset_id = self.kwargs.get('asset_id')
        import uuid
        from django.shortcuts import get_object_or_404
        
        try:
            uuid.UUID(str(asset_id))
        except ValueError:
            asset = get_object_or_404(Asset, asset_code=asset_id, is_active=True)
            asset_id = asset.id
            
        data = request.data.copy()
        data['asset'] = asset_id
        
        serializer = self.get_serializer(data=data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return StandardResponse.created(
                AssetAttachmentSerializer(serializer.instance).data,
                "Attachment created successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class AssetAttachmentDetailView(generics.RetrieveDestroyAPIView):
    """Retrieve or delete an asset attachment."""
    queryset = AssetAttachment.objects.filter(is_active=True)
    serializer_class = AssetAttachmentSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'
    
    def retrieve(self, request, *args, **kwargs):
        """Retrieve attachment with standard response format."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return StandardResponse.success(serializer.data, "Attachment retrieved successfully")
    
    def destroy(self, request, *args, **kwargs):
        """Soft delete attachment."""
        instance = self.get_object()
        instance.soft_delete(request.user)
        return StandardResponse.no_content("Attachment deleted successfully")
