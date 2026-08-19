"""
Views for asset management.
"""
from datetime import date, timedelta

from rest_framework import generics, status, filters
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.http import Http404
from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth
from django_filters.rest_framework import DjangoFilterBackend
from core.responses import StandardResponse
from core.permissions import IsAdminOrManager
from .serializers import (
    AssetSerializer, AssetCreateSerializer, AssetUpdateSerializer,
    AssetAttachmentSerializer, AssetAttachmentCreateSerializer,
    AssetTransferSerializer, AssetTransferCreateSerializer,
    AssetLifecycleEventSerializer
)
from .models import Asset, AssetAttachment, AssetTransfer, AssetLifecycleEvent
from .signals import log_lifecycle_event
from authentication.models import UserPropertyAccess, UserDepartmentAccess, UserPermission


def scoped_assets(user):
    """Return the asset queryset a user is permitted to see (mirrors list view)."""
    queryset = Asset.objects.select_related(
        'property', 'category', 'item_type', 'owner'
    ).filter(is_active=True)

    if user.is_super_admin() or user.is_admin():
        return queryset

    has_all_props = UserPermission.objects.filter(
        user=user,
        page=UserPermission.Page.PROPERTIES,
        can_view=True
    ).exists()

    if has_all_props:
        return queryset.filter(property__status='active')

    accessible_property_ids = UserPropertyAccess.objects.filter(
        user=user
    ).values_list('property_id', flat=True)

    if accessible_property_ids:
        queryset = queryset.filter(property_id__in=accessible_property_ids)

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
        queryset = Asset.objects.select_related(
            'property', 'category', 'item_type', 'owner'
        ).filter(is_active=True)
        
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
    serializer_class = AssetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter queryset based on user permissions."""
        return scoped_assets(self.request.user)

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
            raise Http404("No Asset matches the given query.")

        self.check_object_permissions(self.request, obj)
        return obj
    
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
        queryset = AssetTransfer.objects.select_related('asset').filter(is_active=True)
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
    serializer_class = AssetTransferSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'

    def get_object(self):
        """Lookup by UUID or transfer_code."""
        lookup_val = self.kwargs.get('id')
        import uuid
        try:
            uuid.UUID(str(lookup_val))
            obj = AssetTransfer.objects.select_related('asset').filter(id=lookup_val, is_active=True).first()
        except ValueError:
            obj = AssetTransfer.objects.select_related('asset').filter(transfer_code=lookup_val, is_active=True).first()
        if not obj:
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
            obj = AssetTransfer.objects.select_related('asset').filter(id=lookup_val, is_active=True).first()
        except ValueError:
            obj = AssetTransfer.objects.select_related('asset').filter(transfer_code=lookup_val, is_active=True).first()
        if not obj:
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
        if transfer.status == AssetTransfer.Status.COMPLETED:
            return StandardResponse.success(
                AssetTransferSerializer(transfer).data,
                "Transfer already completed"
            )
        if transfer.status != AssetTransfer.Status.APPROVED:
            return StandardResponse.conflict(
                f"Only an approved transfer can be completed. Current status: {transfer.status}."
            )
        asset = transfer.asset
        changed = False
        if transfer.to_department and transfer.to_department != asset.department:
            asset.department = transfer.to_department
            changed = True
        if transfer.to_property and transfer.to_property_id != (asset.property_id if asset.property else None):
            asset.property = transfer.to_property
            changed = True
        if transfer.to_owner and transfer.to_owner_id != (asset.owner_id if asset.owner else None):
            asset.owner = transfer.to_owner
            changed = True
        if transfer.to_location and transfer.to_location != (asset.location or ''):
            asset.location = transfer.to_location
            changed = True
        if changed:
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


class AssetLifecycleEventListView(generics.ListAPIView):
    """
    List the immutable lifecycle audit trail for assets.

    Optionally scope to a single asset via ?asset=<uuid|code> and filter by
    ?event_type=. The response is the same scoped set of assets as the list view.
    """
    queryset = AssetLifecycleEvent.objects.filter(is_active=True)
    serializer_class = AssetLifecycleEventSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        import uuid
        from django.shortcuts import get_object_or_404

        user = self.request.user
        queryset = AssetLifecycleEvent.objects.select_related('asset').filter(is_active=True)

        asset_id = self.request.query_params.get('asset')
        if asset_id:
            asset = None
            try:
                uuid.UUID(str(asset_id))
                asset = Asset.objects.filter(id=asset_id, is_active=True).first()
            except ValueError:
                asset = Asset.objects.filter(asset_code=asset_id, is_active=True).first()
            if not asset:
                raise Http404("No Asset matches the given query.")
            if not scoped_assets(user).filter(pk=asset.pk).exists():
                raise Http404("No Asset matches the given query.")
            queryset = queryset.filter(asset=asset)

        event_type = self.request.query_params.get('event_type')
        if event_type:
            queryset = queryset.filter(event_type=event_type)

        asset_ids = list(scoped_assets(user).values_list('id', flat=True))
        if not asset_ids:
            return AssetLifecycleEvent.objects.none()
        return queryset.filter(asset_id__in=asset_ids)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Lifecycle events retrieved successfully")


class AssetAnalyticsView(generics.GenericAPIView):
    """Aggregated enterprise analytics for the asset portfolio."""
    permission_classes = [IsAuthenticated]

    @staticmethod
    def _month_range(count):
        today = date.today()
        year, month = today.year, today.month
        months = []
        for i in range(count - 1, -1, -1):
            m = month - i
            y = year
            while m <= 0:
                m += 12
                y -= 1
            months.append((y, m))
        return months

    def get(self, request, *args, **kwargs):
        assets = scoped_assets(request.user)

        totals = assets.aggregate(
            total_assets=Count('id'),
            total_purchase_cost=Sum('purchase_cost'),
            total_current_value=Sum('current_value'),
            total_accumulated_depreciation=Sum('accumulated_depreciation'),
        )
        total_purchase_cost = float(totals['total_purchase_cost'] or 0)
        total_current_value = float(totals['total_current_value'] or 0)
        total_depreciation = float(totals['total_accumulated_depreciation'] or 0)

        # Depreciation health: if book value is not stored, compute it
        if total_current_value <= 0 and total_purchase_cost > 0:
            total_current_value = total_purchase_cost - total_depreciation

        def _breakdown(rows):
            return [
                {'key': r['key'], 'label': r['label'], 'count': r['count'],
                 'value': round(float(r['value'] or 0), 2)}
                for r in rows if r['key']
            ]

        status_rows = assets.values('status').annotate(
            count=Count('id'), value=Sum('current_value')
        )
        status_breakdown = [
            {'key': r['status'],
             'label': str(dict(Asset.Status.choices).get(r['status'], r['status'])),
             'count': r['count'], 'value': round(float(r['value'] or 0), 2)}
            for r in status_rows
        ]

        condition_rows = assets.values('condition').annotate(
            count=Count('id'), value=Sum('current_value')
        )
        condition_breakdown = [
            {'key': r['condition'],
             'label': str(dict(Asset.Condition.choices).get(r['condition'], r['condition'])),
             'count': r['count'], 'value': round(float(r['value'] or 0), 2)}
            for r in condition_rows
        ]

        category_rows = assets.exclude(category__isnull=True).values('category__name', 'category').annotate(
            count=Count('id'), value=Sum('current_value')
        ).order_by('-count')
        category_breakdown = [
            {'key': str(r['category']), 'label': r['category__name'],
             'count': r['count'], 'value': round(float(r['value'] or 0), 2)}
            for r in category_rows
        ]

        department_rows = assets.exclude(department='').values('department').annotate(
            count=Count('id'), value=Sum('current_value')
        ).order_by('-count')[:10]
        department_breakdown = [
            {'key': r['department'], 'label': r['department'],
             'count': r['count'], 'value': round(float(r['value'] or 0), 2)}
            for r in department_rows
        ]

        property_rows = assets.values('property_id', 'property__name').annotate(
            count=Count('id'), value=Sum('current_value')
        ).order_by('-count')[:10]
        property_breakdown = [
            {'key': str(r['property_id']), 'label': r['property__name'],
             'count': r['count'], 'value': round(float(r['value'] or 0), 2)}
            for r in property_rows
        ]

        method_rows = assets.values('depreciation_method').annotate(count=Count('id'))
        depreciation_method_breakdown = [
            {'key': r['depreciation_method'],
             'label': str(dict(Asset.DepreciationMethod.choices).get(r['depreciation_method'], r['depreciation_method'])),
             'count': r['count']}
            for r in method_rows
        ]

        today = date.today()
        in_30 = today + timedelta(days=30)
        in_90 = today + timedelta(days=90)

        def _compliance(expiry_field):
            return {
                'active': assets.filter(**{f'{expiry_field}__gte': today}).count(),
                'expiring_30': assets.filter(**{f'{expiry_field}__gte': today, f'{expiry_field}__lte': in_30}).count(),
                'expiring_90': assets.filter(**{f'{expiry_field}__gte': today, f'{expiry_field}__lte': in_90}).count(),
                'expired': assets.filter(**{f'{expiry_field}__lt': today}).count(),
                'none': assets.filter(**{f'{expiry_field}__isnull': True}).count(),
            }

        warranty = _compliance('warranty_expiry')
        amc = assets.filter(amc_enabled=True)
        amc_data = {
            'active': amc.filter(amc_start_date__lte=today, amc_end_date__gte=today).count(),
            'expiring_30': amc.filter(amc_end_date__gte=today, amc_end_date__lte=in_30).count(),
            'expiring_90': amc.filter(amc_end_date__gte=today, amc_end_date__lte=in_90).count(),
            'expired': amc.filter(amc_end_date__lt=today).count(),
            'none': assets.exclude(amc_enabled=True).count(),
        }

        # Monthly acquisitions for the last 12 months
        month_map = {}
        for r in (assets.filter(purchase_date__isnull=False)
                        .annotate(month=TruncMonth('purchase_date'))
                        .values('month')
                        .annotate(count=Count('id'), value=Sum('purchase_cost'))
                        .order_by('month')):
            key = (r['month'].year, r['month'].month)
            month_map[key] = {'count': r['count'], 'value': round(float(r['value'] or 0), 2)}

        monthly = []
        for (y, m) in self._month_range(12):
            data = month_map.get((y, m), {'count': 0, 'value': 0})
            monthly.append({
                'year': y, 'month': m,
                'label': f"{y}-{str(m).zfill(2)}",
                'count': data['count'], 'value': data['value'],
            })

        # Annual depreciation from the chosen methods (computed in Python)
        annual_depreciation_total = 0.0
        for asset in assets.only('purchase_cost', 'purchase_date', 'depreciation_method',
                                 'useful_life_years', 'salvage_value', 'depreciation_rate'):
            annual_depreciation_total += float(asset.annual_depreciation_value() or 0)

        # 5-year book-value projection
        projection = []
        for year in range(0, 6):
            value = 0.0
            for asset in assets.only('purchase_cost', 'purchase_date', 'depreciation_method',
                                     'useful_life_years', 'salvage_value', 'depreciation_rate'):
                cost = float(asset.purchase_cost or 0)
                if cost <= 0:
                    continue
                salvage = float(asset.salvage_value or 0)
                if asset.depreciation_method == Asset.DepreciationMethod.NO_DEPRECIATION:
                    value += cost
                    continue
                if asset.depreciation_method == Asset.DepreciationMethod.STRAIGHT_LINE and asset.useful_life_years:
                    life = float(asset.useful_life_years)
                    annual = max(0, cost - salvage) / life if life > 0 else 0
                    value += max(salvage, cost - annual * year)
                else:
                    rate = float(asset.depreciation_rate or 0) / 100
                    projected = cost * ((1 - rate) ** year) if rate > 0 else cost
                    value += max(salvage, min(projected, cost))
            projection.append({'year': year, 'value': round(value, 2)})

        from maintenance.models import MaintenanceTicket, MaintenanceSchedule
        open_ticket_statuses = [
            MaintenanceTicket.Status.BACKLOG, MaintenanceTicket.Status.OPEN,
            MaintenanceTicket.Status.IN_PROGRESS, MaintenanceTicket.Status.WAITING_PARTS,
            MaintenanceTicket.Status.ON_HOLD,
        ]
        scoped_asset_ids = list(assets.values_list('id', flat=True))
        tickets = MaintenanceTicket.objects.filter(is_active=True, asset_id__in=scoped_asset_ids) if scoped_asset_ids else MaintenanceTicket.objects.none()
        maintenance = {
            'open_tickets': tickets.filter(status__in=open_ticket_statuses).count(),
            'overdue_tickets': tickets.filter(status__in=open_ticket_statuses, due_date__lt=timezone.now()).count(),
            'resolved_30d': tickets.filter(status=MaintenanceTicket.Status.RESOLVED, resolved_at__gte=timezone.now() - timedelta(days=30)).count(),
            'total_estimated_cost': round(float(tickets.aggregate(v=Sum('estimated_cost'))['v'] or 0), 2),
            'total_actual_cost': round(float(tickets.aggregate(v=Sum('actual_cost'))['v'] or 0), 2),
            'schedules_due_30d': (MaintenanceSchedule.objects.filter(is_active=True, asset_id__in=scoped_asset_ids, next_due__lte=in_30).count()
                                  if scoped_asset_ids else 0),
            'schedules_overdue': (MaintenanceSchedule.objects.filter(is_active=True, asset_id__in=scoped_asset_ids, next_due__lt=today).count()
                                  if scoped_asset_ids else 0),
        }

        data = {
            'totals': {
                'total_assets': totals['total_assets'] or 0,
                'total_purchase_cost': round(total_purchase_cost, 2),
                'total_current_value': round(total_current_value, 2),
                'total_accumulated_depreciation': round(total_depreciation, 2),
                'annual_depreciation': round(annual_depreciation_total, 2),
            },
            'status_breakdown': status_breakdown,
            'condition_breakdown': condition_breakdown,
            'category_breakdown': category_breakdown,
            'department_breakdown': department_breakdown,
            'property_breakdown': property_breakdown,
            'depreciation_method_breakdown': depreciation_method_breakdown,
            'warranty': warranty,
            'amc': amc_data,
            'monthly_acquisitions': monthly,
            'projection': projection,
            'maintenance': maintenance,
        }
        return StandardResponse.success(data, "Asset analytics retrieved successfully")


class AssetComplianceView(generics.GenericAPIView):
    """Warranty & AMC compliance summary with upcoming/expired items."""
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        assets = scoped_assets(request.user)
        today = date.today()
        in_30 = today + timedelta(days=30)
        in_90 = today + timedelta(days=90)
        horizon = int(request.query_params.get('days', 90))

        def _days_left(expiry):
            return (expiry - today).days if expiry else None

        warranties = []
        for a in assets.exclude(warranty_expiry__isnull=True):
            if a.warranty_expiry < today or a.warranty_expiry <= today + timedelta(days=horizon):
                warranties.append({
                    'asset': a.asset_code, 'asset_name': a.name, 'asset_id': a.asset_code,
                    'expiry': a.warranty_expiry.isoformat(),
                    'days_left': _days_left(a.warranty_expiry),
                    'status': 'expired' if a.warranty_expiry < today else 'expiring',
                    'provider': a.warranty_provider,
                    'purchase_cost': float(a.purchase_cost or 0),
                })

        amcs = []
        for a in assets.filter(amc_enabled=True, amc_end_date__isnull=False):
            if a.amc_end_date < today or a.amc_end_date <= today + timedelta(days=horizon):
                amcs.append({
                    'asset': a.asset_code, 'asset_name': a.name, 'asset_id': a.asset_code,
                    'start': a.amc_start_date.isoformat() if a.amc_start_date else None,
                    'expiry': a.amc_end_date.isoformat(),
                    'days_left': _days_left(a.amc_end_date),
                    'status': 'expired' if a.amc_end_date < today else 'expiring',
                    'provider': a.amc_provider,
                    'cost': float(a.amc_cost or 0),
                })

        warranties.sort(key=lambda x: (x['status'] != 'expired', x['days_left'] or 0))
        amcs.sort(key=lambda x: (x['status'] != 'expired', x['days_left'] or 0))

        data = {
            'generated_at': timezone.now().isoformat(),
            'horizon_days': horizon,
            'warranty': {
                'active': assets.filter(warranty_expiry__gte=today).count(),
                'expiring_30': assets.filter(warranty_expiry__gte=today, warranty_expiry__lte=in_30).count(),
                'expiring_90': assets.filter(warranty_expiry__gte=today, warranty_expiry__lte=in_90).count(),
                'expired': assets.filter(warranty_expiry__lt=today).count(),
                'items': warranties,
            },
            'amc': {
                'active': assets.filter(amc_enabled=True, amc_start_date__lte=today, amc_end_date__gte=today).count(),
                'expiring_30': assets.filter(amc_enabled=True, amc_end_date__gte=today, amc_end_date__lte=in_30).count(),
                'expiring_90': assets.filter(amc_enabled=True, amc_end_date__gte=today, amc_end_date__lte=in_90).count(),
                'expired': assets.filter(amc_enabled=True, amc_end_date__lt=today).count(),
                'items': amcs,
            },
        }
        return StandardResponse.success(data, "Compliance data retrieved successfully")


class AssetDepreciationView(generics.GenericAPIView):
    """
    GET  -> list of assets with current depreciation state (scoped).
    POST -> recompute accumulated depreciation & current value for all scoped
            assets and record lifecycle events. Requires admin/manager.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        assets = scoped_assets(request.user)
        today = date.today()
        rows = []
        for a in assets.only('asset_code', 'name', 'purchase_cost', 'purchase_date',
                             'depreciation_method', 'useful_life_years', 'salvage_value',
                             'depreciation_rate', 'accumulated_depreciation', 'current_value'):
            accumulated = a.calculate_depreciation()
            purchase_cost = float(a.purchase_cost or 0)
            rows.append({
                'asset': a.asset_code,
                'asset_name': a.name,
                'purchase_date': a.purchase_date.isoformat() if a.purchase_date else None,
                'purchase_cost': purchase_cost,
                'method': a.depreciation_method,
                'method_label': str(a.get_depreciation_method_display()),
                'useful_life_years': float(a.useful_life_years) if a.useful_life_years else None,
                'salvage_value': float(a.salvage_value or 0),
                'annual_depreciation': round(float(a.annual_depreciation_value() or 0), 2),
                'accumulated_depreciation': round(float(accumulated), 2),
                'current_value': round(float(max(0, purchase_cost - accumulated)), 2),
                'depreciated_percent': round(accumulated / purchase_cost * 100, 2) if purchase_cost else 0,
            })
        rows.sort(key=lambda r: r['asset'])
        total_purchase = sum(r['purchase_cost'] for r in rows)
        total_current = sum(r['current_value'] for r in rows)
        total_accumulated = sum(r['accumulated_depreciation'] for r in rows)
        return StandardResponse.success({
            'as_of': today.isoformat(),
            'totals': {
                'assets': len(rows),
                'purchase_cost': round(total_purchase, 2),
                'current_value': round(total_current, 2),
                'accumulated_depreciation': round(total_accumulated, 2),
            },
            'items': rows,
        }, "Depreciation data retrieved successfully")

    def post(self, request, *args, **kwargs):
        if not (request.user.is_super_admin() or request.user.is_admin()
                or request.user.is_manager()):
            return StandardResponse.error(
                "You do not have permission to recalculate depreciation.",
                status_code=403,
            )

        assets = scoped_assets(request.user)
        updated = 0
        for a in assets.only('purchase_cost', 'purchase_date', 'depreciation_method',
                             'useful_life_years', 'salvage_value', 'depreciation_rate',
                             'accumulated_depreciation', 'current_value'):
            new_accumulated = a.calculate_depreciation()
            new_current = max(0, float(a.purchase_cost or 0) - new_accumulated)
            changed = abs(float(a.accumulated_depreciation or 0) - new_accumulated) > 0.01
            if changed:
                a.accumulated_depreciation = new_accumulated
                a.current_value = new_current
                a.updated_by = request.user
                a.save(update_fields=['accumulated_depreciation', 'current_value', 'updated_by', 'updated_at'])
                log_lifecycle_event(
                    asset=a,
                    event_type=AssetLifecycleEvent.EventType.DEPRECIATION_UPDATED,
                    actor=request.user,
                    old_value={'accumulated_depreciation': float(a.accumulated_depreciation)},
                    new_value={'accumulated_depreciation': new_accumulated,
                               'current_value': new_current},
                    message=f"Depreciation recalculated: accumulated {new_accumulated:.2f}",
                )
                updated += 1

        return StandardResponse.success(
            {'updated': updated, 'as_of': date.today().isoformat()},
            f"Depreciation recalculated for {updated} asset(s).",
        )
