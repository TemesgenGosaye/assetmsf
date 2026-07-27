"""
Views for asset management.
"""
from rest_framework import generics, status, filters
from rest_framework.permissions import IsAuthenticated
from django.db import models
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from core.responses import StandardResponse
from core.permissions import IsAdminOrManager
from .serializers import (
    AssetSerializer, AssetCreateSerializer, AssetUpdateSerializer,
    AssetAttachmentSerializer, AssetAttachmentCreateSerializer,
    AssetTransferSerializer, AssetTransferCreateSerializer,
    AssetTransferActionSerializer,
)
from .models import Asset, AssetAttachment, AssetTransfer
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
            page=UserPermission.Page.ALL_PROPERTIES,
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
        has_all_depts = UserPermission.objects.filter(
            user=user,
            page=UserPermission.Page.ALL_DEPARTMENTS,
            can_view=True
        ).exists()
        
        if not has_all_depts:
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


# ── Asset Transfer Views ────────────────────────────────────────────────────


class AssetTransferListView(generics.ListCreateAPIView):
    """List all transfers or create a new transfer."""
    queryset = AssetTransfer.objects.select_related(
        'asset', 'from_owner', 'from_property',
        'to_owner', 'to_property',
        'requested_by', 'approved_by', 'completed_by',
    ).all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'from_department', 'to_department', 'asset']
    search_fields = ['transfer_code', 'asset__asset_code', 'asset__name', 'reason']
    ordering_fields = ['requested_at', 'approved_at', 'completed_at', 'status']
    ordering = ['-requested_at']

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return AssetTransferCreateSerializer
        return AssetTransferSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_super_admin() or user.is_admin():
            return qs
        # Managers see transfers for their accessible properties
        if user.is_manager():
            accessible = UserPropertyAccess.objects.filter(
                user=user
            ).values_list('property_id', flat=True)
            return qs.filter(
                models.Q(from_property_id__in=accessible) |
                models.Q(to_property_id__in=accessible)
            )
        # Regular users see their own transfers
        return qs.filter(
            models.Q(requested_by=user) |
            models.Q(from_owner=user) |
            models.Q(to_owner=user)
        )

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Transfers retrieved successfully")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            transfer = serializer.save()
            # Auto-approve for admins
            if request.user.is_super_admin() or request.user.is_admin():
                transfer.approve(request.user)
            # Create activity log
            try:
                from dashboard.models import RecentActivity
                RecentActivity.objects.create(
                    user=request.user,
                    type=RecentActivity.Type.ASSET_UPDATED,
                    message=f"Transfer {transfer.transfer_code} requested for {transfer.asset.asset_code}",
                    user_name=request.user.name,
                    metadata={
                        'transfer_code': transfer.transfer_code,
                        'asset_code': transfer.asset.asset_code,
                        'from': transfer.from_department,
                        'to': transfer.to_department,
                    },
                )
            except Exception:
                pass
            return StandardResponse.created(
                AssetTransferSerializer(transfer).data,
                "Transfer request created successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class AssetTransferDetailView(generics.RetrieveAPIView):
    """Retrieve a single transfer."""
    queryset = AssetTransfer.objects.select_related(
        'asset', 'from_owner', 'from_property',
        'to_owner', 'to_property',
        'requested_by', 'approved_by', 'completed_by',
    ).all()
    serializer_class = AssetTransferSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'


class AssetTransferApproveView(generics.GenericAPIView):
    """Approve a pending transfer."""
    queryset = AssetTransfer.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = AssetTransferActionSerializer
    lookup_field = 'id'

    def post(self, request, *args, **kwargs):
        transfer = self.get_object()
        if transfer.status != AssetTransfer.Status.PENDING:
            return StandardResponse.bad_request(
                f"Cannot approve a transfer with status '{transfer.get_status_display()}'."
            )
        user = request.user
        if not (user.is_super_admin() or user.is_admin() or user.is_manager()):
            return StandardResponse.forbidden("You do not have permission to approve transfers.")

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        transfer.approve(user)

        try:
            from dashboard.models import RecentActivity
            RecentActivity.objects.create(
                user=user,
                type=RecentActivity.Type.ASSET_UPDATED,
                message=f"Transfer {transfer.transfer_code} approved for {transfer.asset.asset_code}",
                user_name=user.name,
                metadata={'transfer_code': transfer.transfer_code, 'asset_code': transfer.asset.asset_code},
            )
        except Exception:
            pass

        return StandardResponse.success(
            AssetTransferSerializer(transfer).data,
            "Transfer approved successfully"
        )


class AssetTransferRejectView(generics.GenericAPIView):
    """Reject a pending transfer."""
    queryset = AssetTransfer.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = AssetTransferActionSerializer
    lookup_field = 'id'

    def post(self, request, *args, **kwargs):
        transfer = self.get_object()
        if transfer.status != AssetTransfer.Status.PENDING:
            return StandardResponse.bad_request(
                f"Cannot reject a transfer with status '{transfer.get_status_display()}'."
            )
        user = request.user
        if not (user.is_super_admin() or user.is_admin() or user.is_manager()):
            return StandardResponse.forbidden("You do not have permission to reject transfers.")

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        transfer.reject(user, serializer.validated_data.get('reason', ''))

        try:
            from dashboard.models import RecentActivity
            RecentActivity.objects.create(
                user=user,
                type=RecentActivity.Type.ASSET_UPDATED,
                message=f"Transfer {transfer.transfer_code} rejected for {transfer.asset.asset_code}",
                user_name=user.name,
                metadata={'transfer_code': transfer.transfer_code, 'asset_code': transfer.asset.asset_code},
            )
        except Exception:
            pass

        return StandardResponse.success(
            AssetTransferSerializer(transfer).data,
            "Transfer rejected"
        )


class AssetTransferCompleteView(generics.GenericAPIView):
    """Complete an approved transfer — actually moves the asset."""
    queryset = AssetTransfer.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = AssetTransferActionSerializer
    lookup_field = 'id'

    def post(self, request, *args, **kwargs):
        transfer = self.get_object()
        if transfer.status != AssetTransfer.Status.APPROVED:
            return StandardResponse.bad_request(
                f"Cannot complete a transfer with status '{transfer.get_status_display()}'. "
                "Transfer must be approved first."
            )
        user = request.user
        if not (user.is_super_admin() or user.is_admin()):
            return StandardResponse.forbidden("Only admins can complete transfers.")

        transfer.complete(user)

        try:
            from dashboard.models import RecentActivity
            RecentActivity.objects.create(
                user=user,
                type=RecentActivity.Type.ASSET_UPDATED,
                message=f"Transfer {transfer.transfer_code} completed. {transfer.asset.asset_code} moved from {transfer.from_department} to {transfer.to_department}",
                user_name=user.name,
                metadata={
                    'transfer_code': transfer.transfer_code,
                    'asset_code': transfer.asset.asset_code,
                    'from': transfer.from_department,
                    'to': transfer.to_department,
                },
            )
        except Exception:
            pass

        return StandardResponse.success(
            AssetTransferSerializer(transfer).data,
            "Transfer completed. Asset has been moved."
        )


class AssetTransferCancelView(generics.GenericAPIView):
    """Cancel a pending or approved transfer."""
    queryset = AssetTransfer.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = AssetTransferActionSerializer
    lookup_field = 'id'

    def post(self, request, *args, **kwargs):
        transfer = self.get_object()
        if transfer.status not in (AssetTransfer.Status.PENDING, AssetTransfer.Status.APPROVED):
            return StandardResponse.bad_request(
                f"Cannot cancel a transfer with status '{transfer.get_status_display()}'."
            )
        user = request.user
        # Only the requester or an admin can cancel
        if not (user.is_super_admin() or user.is_admin() or transfer.requested_by == user):
            return StandardResponse.forbidden("You do not have permission to cancel this transfer.")

        transfer.cancel(user)

        try:
            from dashboard.models import RecentActivity
            RecentActivity.objects.create(
                user=user,
                type=RecentActivity.Type.ASSET_UPDATED,
                message=f"Transfer {transfer.transfer_code} cancelled for {transfer.asset.asset_code}",
                user_name=user.name,
                metadata={'transfer_code': transfer.transfer_code, 'asset_code': transfer.asset.asset_code},
            )
        except Exception:
            pass

        return StandardResponse.success(
            AssetTransferSerializer(transfer).data,
            "Transfer cancelled"
        )
