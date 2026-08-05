"""
Views for asset management.
"""
from rest_framework import generics, status, filters
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from core.responses import StandardResponse
from core.permissions import IsAdminOrManager
from .serializers import (
    AssetSerializer, AssetCreateSerializer, AssetUpdateSerializer,
    AssetAttachmentSerializer, AssetAttachmentCreateSerializer,
    AssetTransferSerializer, AssetTransferCreateSerializer
)
from .models import Asset, AssetAttachment, AssetTransfer
from authentication.models import UserPropertyAccess, UserDepartmentAccess, UserPermission


class AssetListView(generics.ListCreateAPIView):
    """List and create assets."""
    queryset = Asset.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'condition', 'category', 'item_type', 'property', 'department', 'depreciation_method', 'warranty_expiry']
    search_fields = ['name', 'asset_code', 'serial_number', 'barcode', 'description', 'vendor', 'invoice_number', 'po_number']
    ordering_fields = ['created_at', 'name', 'asset_code', 'purchase_date', 'purchase_cost', 'current_value']
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


class AssetTransferListView(generics.ListCreateAPIView):
    """List and create asset transfers."""
    queryset = AssetTransfer.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['transfer_code', 'asset__asset_code', 'asset__name',
                     'from_department', 'to_department', 'from_property_name',
                     'to_property_name', 'from_owner_name', 'to_owner_name',
                     'reason']
    ordering_fields = ['created_at', 'requested_at', 'transfer_code', 'status']
    ordering = ['-created_at']

    def get_serializer_class(self):
        """Return appropriate serializer based on request method."""
        if self.request.method == 'POST':
            return AssetTransferCreateSerializer
        return AssetTransferSerializer

    def get_queryset(self):
        """Filter transfers by status and requester."""
        queryset = AssetTransfer.objects.filter(is_active=True)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    def list(self, request, *args, **kwargs):
        """List transfers with standard response format."""
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Transfers retrieved successfully")

    def create(self, request, *args, **kwargs):
        """Create transfer with standard response format."""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            instance = serializer.save()
            return StandardResponse.created(
                AssetTransferSerializer(instance).data,
                "Transfer created successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class AssetTransferDetailView(generics.RetrieveAPIView):
    """Retrieve an asset transfer."""
    queryset = AssetTransfer.objects.filter(is_active=True)
    serializer_class = AssetTransferSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'

    def get_object(self):
        """Lookup by UUID or transfer_code."""
        lookup_val = self.kwargs.get('id')
        import uuid
        try:
            uuid.UUID(str(lookup_val))
            obj = AssetTransfer.objects.filter(id=lookup_val, is_active=True).first()
        except ValueError:
            obj = AssetTransfer.objects.filter(transfer_code=lookup_val, is_active=True).first()
        if not obj:
            from django.http import Http404
            raise Http404("No AssetTransfer matches the given query.")
        return obj

    def retrieve(self, request, *args, **kwargs):
        """Retrieve transfer with standard response format."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return StandardResponse.success(serializer.data, "Transfer retrieved successfully")


class AssetTransferActionView(generics.GenericAPIView):
    """Approve, reject, complete, or cancel an asset transfer."""
    queryset = AssetTransfer.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]

    def get_object(self):
        """Lookup by UUID or transfer_code."""
        lookup_val = self.kwargs.get('id')
        import uuid
        try:
            uuid.UUID(str(lookup_val))
            obj = AssetTransfer.objects.filter(id=lookup_val, is_active=True).first()
        except ValueError:
            obj = AssetTransfer.objects.filter(transfer_code=lookup_val, is_active=True).first()
        if not obj:
            from django.http import Http404
            raise Http404("No AssetTransfer matches the given query.")
        return obj

    def post(self, request, *args, **kwargs):
        """Dispatch to the appropriate action handler."""
        action = self.kwargs.get('action')
        handler = getattr(self, f'handle_{action}', None)
        if not handler:
            return StandardResponse.error("Unknown transfer action.", status_code=404)
        return handler(request)

    def handle_approve(self, request):
        transfer = self.get_object()
        if transfer.status != AssetTransfer.Status.PENDING:
            return StandardResponse.conflict(
                f"Cannot approve a transfer with status '{transfer.status}'."
            )
        transfer.status = AssetTransfer.Status.APPROVED
        transfer.approved_by = request.user
        transfer.approved_by_name = getattr(request.user, 'name', None) or request.user.get_full_name() or request.user.email
        transfer.approved_at = timezone.now()
        transfer.updated_by = request.user
        transfer.save(update_fields=['status', 'approved_by', 'approved_by_name', 'approved_at', 'updated_by', 'updated_at'])
        return StandardResponse.success(
            AssetTransferSerializer(transfer).data,
            "Transfer approved successfully"
        )

    def handle_reject(self, request):
        transfer = self.get_object()
        if transfer.status != AssetTransfer.Status.PENDING:
            return StandardResponse.conflict(
                f"Cannot reject a transfer with status '{transfer.status}'."
            )
        reason = request.data.get('reason') if isinstance(request.data, dict) else None
        transfer.status = AssetTransfer.Status.REJECTED
        transfer.rejection_reason = reason or ''
        transfer.updated_by = request.user
        transfer.save(update_fields=['status', 'rejection_reason', 'updated_by', 'updated_at'])
        return StandardResponse.success(
            AssetTransferSerializer(transfer).data,
            "Transfer rejected successfully"
        )

    def handle_complete(self, request):
        transfer = self.get_object()
        if transfer.status != AssetTransfer.Status.APPROVED:
            return StandardResponse.conflict(
                "Only an approved transfer can be completed."
            )
        asset = transfer.asset
        if transfer.to_department:
            asset.department = transfer.to_department
        if transfer.to_property:
            asset.property = transfer.to_property
        if transfer.to_owner:
            asset.owner = transfer.to_owner
        if transfer.to_location:
            asset.location = transfer.to_location
        asset.updated_by = request.user
        asset.save(update_fields=['department', 'property', 'owner', 'location', 'updated_by', 'updated_at'])

        transfer.status = AssetTransfer.Status.COMPLETED
        transfer.completed_by = request.user
        transfer.completed_by_name = getattr(request.user, 'name', None) or request.user.get_full_name() or request.user.email
        transfer.completed_at = timezone.now()
        transfer.updated_by = request.user
        transfer.save(update_fields=['status', 'completed_by', 'completed_by_name', 'completed_at', 'updated_by', 'updated_at'])
        return StandardResponse.success(
            AssetTransferSerializer(transfer).data,
            "Transfer completed successfully"
        )

    def handle_cancel(self, request):
        transfer = self.get_object()
        if transfer.status != AssetTransfer.Status.PENDING:
            return StandardResponse.conflict(
                f"Cannot cancel a transfer with status '{transfer.status}'."
            )
        transfer.status = AssetTransfer.Status.CANCELLED
        transfer.cancelled_at = timezone.now()
        transfer.updated_by = request.user
        transfer.save(update_fields=['status', 'cancelled_at', 'updated_by', 'updated_at'])
        return StandardResponse.success(
            AssetTransferSerializer(transfer).data,
            "Transfer cancelled successfully"
        )
