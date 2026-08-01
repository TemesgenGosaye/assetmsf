"""
Views for common functionality.
"""
import os

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import api_view, permission_classes
from core.responses import StandardResponse
from core.permissions import IsAdminOrManager
from .serializers import (
    QRCodeSerializer, QRCodeCreateSerializer,
    VendorSerializer, VendorCreateSerializer, VendorUpdateSerializer
)
from .models import QRCode, Vendor


@api_view(['GET'])
@permission_classes([AllowAny])
def root_api_view(request):
    """Root API endpoint providing basic service status."""
    return StandardResponse.success(
        {
            "service": "SAMS Backend API",
            "version": "1.0.0",
            "health": "/api/health/",
            "status": "online"
        },
        "SAMS Backend API is online"
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Simple health check endpoint to verify backend is running."""
    return StandardResponse.success({"status": "ok"}, "Health check passed")


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def setup_database_view(request):
    """Endpoint to run database migrations and seed default users on Vercel.

    Protected by a setup key (env `SETUP_KEY`, passed via `X-Setup-Key` header)
    so it cannot be triggered by the public.
    """
    import logging

    logger = logging.getLogger('django.request')
    expected_key = os.environ.get('SETUP_KEY', '')
    provided_key = request.headers.get('X-Setup-Key', '')
    if not expected_key or provided_key != expected_key:
        return StandardResponse.error("Setup key missing or invalid", status_code=403)

    try:
        from django.core.management import call_command
        from authentication.models import User

        logger.info("Running database migrations (setup endpoint)...")
        call_command('migrate', interactive=False, verbosity=0)

        users_to_create = [
            {'email': 'superadmin@msf.org', 'password': 'SuperAdmin@2025', 'name': 'Super Admin', 'role': 'SUPER_ADMIN', 'is_staff': True, 'is_superuser': True},
            {'email': 'admin@demo.com', 'password': 'admin123', 'name': 'Admin User', 'role': 'ADMIN', 'is_staff': True, 'is_superuser': False},
            {'email': 'test@demo.com', 'password': 'demo123', 'name': 'Test User', 'role': 'FIELD_STAFF', 'is_staff': False, 'is_superuser': False},
            {'email': 'tsegaye@admin.com', 'password': 'admin123', 'name': 'Tsegaye Mokonen', 'role': 'ADMIN', 'is_staff': True, 'is_superuser': False},
        ]
        created_count = 0
        for udata in users_to_create:
            user, created = User.objects.get_or_create(
                email=udata['email'],
                defaults={'name': udata['name'], 'role': udata['role'], 'is_staff': udata['is_staff'], 'is_superuser': udata['is_superuser'], 'status': 'active'}
            )
            if created:
                user.set_password(udata['password'])
                user.name = udata['name']
                user.role = udata['role']
                user.status = 'active'
                user.save()
            created_count += 1

        # Seed Metehara Sugar Factory reference data (departments, properties,
        # categories, item types, vendors, assets, employees, houses).
        seed_summary = {}
        try:
            from seed_metehara_factory import seed_metehara_factory
            seed_summary = seed_metehara_factory()
        except Exception as seed_err:
            logger.error("Metehara seed step failed", exc_info=seed_err)

        return StandardResponse.success(
            {
                "migrations": "applied",
                "users_prepared": created_count,
                "metehara_seed": seed_summary,
            },
            "Database setup complete. Test users ready!"
        )
    except Exception as e:
        logger.error("Database setup failed", exc_info=e)
        return StandardResponse.error(f"Database setup failed: {str(e)}", status_code=500)


class QRCodeListView(generics.ListCreateAPIView):
    """List and create QR codes."""
    queryset = QRCode.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        """Return appropriate serializer based on request method."""
        if self.request.method == 'POST':
            return QRCodeCreateSerializer
        return QRCodeSerializer
    
    def get_queryset(self):
        """Filter QR codes by property access."""
        user = self.request.user
        queryset = QRCode.objects.filter(is_active=True)
        
        if user.is_super_admin() or user.is_admin():
            return queryset
        
        from authentication.models import UserPropertyAccess
        accessible_property_ids = UserPropertyAccess.objects.filter(
            user=user
        ).values_list('property_id', flat=True)
        
        if accessible_property_ids:
            queryset = queryset.filter(property__in=accessible_property_ids)
        
        return queryset
    
    def list(self, request, *args, **kwargs):
        """List QR codes with standard response format."""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "QR codes retrieved successfully")
    
    def create(self, request, *args, **kwargs):
        """Create QR code with standard response format."""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return StandardResponse.created(
                QRCodeSerializer(serializer.instance).data,
                "QR code created successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class QRCodeDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a QR code."""
    queryset = QRCode.objects.filter(is_active=True)
    serializer_class = QRCodeSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'
    
    def retrieve(self, request, *args, **kwargs):
        """Retrieve QR code with standard response format."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return StandardResponse.success(serializer.data, "QR code retrieved successfully")
    
    def update(self, request, *args, **kwargs):
        """Update QR code with standard response format."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = QRCodeCreateSerializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return StandardResponse.success(
                QRCodeSerializer(serializer.instance).data,
                "QR code updated successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)
    
    def destroy(self, request, *args, **kwargs):
        """Soft delete QR code."""
        instance = self.get_object()
        instance.soft_delete(request.user)
        return StandardResponse.no_content("QR code deleted successfully")


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def delete_all_qr_codes(request):
    """Soft delete all QR codes."""
    QRCode.objects.filter(is_active=True).update(is_active=False)
    return StandardResponse.success(None, "All QR codes deleted")


class VendorListView(generics.ListCreateAPIView):
    """List and create vendors."""
    queryset = Vendor.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        """Return appropriate serializer based on request method."""
        if self.request.method == 'POST':
            return VendorCreateSerializer
        return VendorSerializer
    
    def list(self, request, *args, **kwargs):
        """List vendors with standard response format."""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Vendors retrieved successfully")
    
    def create(self, request, *args, **kwargs):
        """Create vendor with standard response format."""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return StandardResponse.created(
                VendorSerializer(serializer.instance).data,
                "Vendor created successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class VendorDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a vendor."""
    queryset = Vendor.objects.filter(is_active=True)
    serializer_class = VendorSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    lookup_field = 'id'
    
    def retrieve(self, request, *args, **kwargs):
        """Retrieve vendor with standard response format."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return StandardResponse.success(serializer.data, "Vendor retrieved successfully")
    
    def update(self, request, *args, **kwargs):
        """Update vendor with standard response format."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = VendorUpdateSerializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return StandardResponse.success(
                VendorSerializer(serializer.instance).data,
                "Vendor updated successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)
    
    def destroy(self, request, *args, **kwargs):
        """Soft delete vendor."""
        instance = self.get_object()
        instance.soft_delete(request.user)
        return StandardResponse.no_content("Vendor deleted successfully")
