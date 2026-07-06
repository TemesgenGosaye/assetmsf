"""
Views for common functionality.
"""
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
def health_check(request):
    """Simple health check endpoint to verify backend is running."""
    return StandardResponse.success({"status": "ok"}, "Health check passed")


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
