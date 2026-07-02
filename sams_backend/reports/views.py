"""
Views for report management.
"""
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from core.responses import StandardResponse
from .serializers import ReportSerializer, ReportCreateSerializer
from .models import Report


class ReportListView(generics.ListCreateAPIView):
    """List and create reports."""
    queryset = Report.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        """Return appropriate serializer based on request method."""
        if self.request.method == 'POST':
            return ReportCreateSerializer
        return ReportSerializer
    
    def get_queryset(self):
        """Filter reports by current user."""
        return Report.objects.filter(
            created_by_id=str(self.request.user.id),
            is_active=True
        ).order_by('-created_at')
    
    def list(self, request, *args, **kwargs):
        """List reports with standard response format."""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Reports retrieved successfully")
    
    def create(self, request, *args, **kwargs):
        """Create report with standard response format."""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            report = serializer.save(
                created_by_name=request.user.name or request.user.email,
                created_by_id=str(request.user.id),
                created_by=request.user
            )
            return StandardResponse.created(
                ReportSerializer(report).data,
                "Report created successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class ReportDetailView(generics.RetrieveDestroyAPIView):
    """Retrieve or delete a report."""
    queryset = Report.objects.filter(is_active=True)
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'
    
    def get_queryset(self):
        """Filter reports by current user."""
        return Report.objects.filter(
            created_by_id=str(self.request.user.id),
            is_active=True
        )
    
    def retrieve(self, request, *args, **kwargs):
        """Retrieve report with standard response format."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return StandardResponse.success(serializer.data, "Report retrieved successfully")
    
    def destroy(self, request, *args, **kwargs):
        """Soft delete report."""
        instance = self.get_object()
        instance.soft_delete(request.user)
        return StandardResponse.no_content("Report deleted successfully")


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def clear_reports(request):
    """Soft delete all reports for current user."""
    Report.objects.filter(
        created_by_id=str(request.user.id),
        is_active=True
    ).update(is_active=False)
    return StandardResponse.success(None, "All reports cleared")
