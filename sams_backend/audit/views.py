"""
Views for audit management.
"""
from rest_framework import generics, status, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from core.responses import StandardResponse
from core.exceptions import ValidationException
from .serializers import (
    AuditSessionSerializer, AuditSessionCreateSerializer,
    AuditAssignmentSerializer, AuditReviewSerializer,
    AuditScanSerializer, AuditScanCreateSerializer, AuditInchargeSerializer
)
from .models import AuditSession, AuditAssignment, AuditReview, AuditScan, AuditIncharge
from authentication.models import UserPropertyAccess


class AuditSessionListView(generics.ListCreateAPIView):
    """List and create audit sessions."""
    queryset = AuditSession.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'frequency', 'property']
    search_fields = ['name', 'description']
    ordering_fields = ['scheduled_date', 'created_at']
    ordering = ['-scheduled_date']
    
    def get_serializer_class(self):
        """Return appropriate serializer based on request method."""
        if self.request.method == 'POST':
            return AuditSessionCreateSerializer
        return AuditSessionSerializer
    
    def get_queryset(self):
        """Filter queryset based on user permissions."""
        user = self.request.user
        queryset = AuditSession.objects.filter(is_active=True)
        
        if user.is_super_admin() or user.is_admin():
            return queryset
        
        accessible_property_ids = UserPropertyAccess.objects.filter(
            user=user
        ).values_list('property_id', flat=True)
        
        if accessible_property_ids:
            queryset = queryset.filter(property_id__in=accessible_property_ids)
        
        return queryset
    
    def list(self, request, *args, **kwargs):
        """List sessions with standard response format."""
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Sessions retrieved successfully")
    
    def create(self, request, *args, **kwargs):
        """Create session with standard response format."""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            session = serializer.save(
                initiated_by=request.user,
                created_by=request.user
            )
            return StandardResponse.created(
                AuditSessionSerializer(session).data,
                "Session created successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class AuditSessionDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete an audit session."""
    queryset = AuditSession.objects.filter(is_active=True)
    serializer_class = AuditSessionSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'
    
    def retrieve(self, request, *args, **kwargs):
        """Retrieve session with standard response format."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return StandardResponse.success(serializer.data, "Session retrieved successfully")
    
    def destroy(self, request, *args, **kwargs):
        """Soft delete session."""
        instance = self.get_object()
        instance.soft_delete(request.user)
        return StandardResponse.no_content("Session deleted successfully")


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_audit_session(request, id):
    """Start an audit session."""
    try:
        session = AuditSession.objects.get(id=id, is_active=True)
        
        if session.status != AuditSession.Status.SCHEDULED:
            raise ValidationException("Session is not in scheduled status.")
        
        session.status = AuditSession.Status.IN_PROGRESS
        session.start_date = timezone.now()
        session.save(updated_by=request.user)
        
        return StandardResponse.success(
            AuditSessionSerializer(session).data,
            "Session started successfully"
        )
    except AuditSession.DoesNotExist:
        return StandardResponse.not_found("Session not found")
    except ValidationException as e:
        return StandardResponse.bad_request(str(e))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def end_audit_session(request, id):
    """End an audit session."""
    try:
        session = AuditSession.objects.get(id=id, is_active=True)
        
        if session.status != AuditSession.Status.IN_PROGRESS:
            raise ValidationException("Session is not in progress.")
        
        session.status = AuditSession.Status.COMPLETED
        session.end_date = timezone.now()
        session.save(updated_by=request.user)
        
        return StandardResponse.success(
            AuditSessionSerializer(session).data,
            "Session completed successfully"
        )
    except AuditSession.DoesNotExist:
        return StandardResponse.not_found("Session not found")
    except ValidationException as e:
        return StandardResponse.bad_request(str(e))


class AuditAssignmentListView(generics.ListCreateAPIView):
    """List and create audit assignments."""
    queryset = AuditAssignment.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    serializer_class = AuditAssignmentSerializer
    
    def get_queryset(self):
        """Filter assignments by session."""
        session_id = self.kwargs.get('session_id')
        return AuditAssignment.objects.filter(session_id=session_id, is_active=True)
    
    def list(self, request, *args, **kwargs):
        """List assignments with standard response format."""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Assignments retrieved successfully")
    
    def create(self, request, *args, **kwargs):
        """Create assignment with standard response format."""
        session_id = self.kwargs.get('session_id')
        data = request.data.copy()
        data['session'] = session_id
        
        serializer = self.get_serializer(data=data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return StandardResponse.created(
                serializer.data,
                "Assignment created successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class AuditScanListView(generics.ListCreateAPIView):
    """List and create audit scans."""
    queryset = AuditScan.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        """Return appropriate serializer based on request method."""
        if self.request.method == 'POST':
            return AuditScanCreateSerializer
        return AuditScanSerializer
    
    def get_queryset(self):
        """Filter scans by session."""
        session_id = self.kwargs.get('session_id')
        return AuditScan.objects.filter(session_id=session_id, is_active=True).order_by('-scanned_at')
    
    def list(self, request, *args, **kwargs):
        """List scans with standard response format."""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Scans retrieved successfully")
    
    def create(self, request, *args, **kwargs):
        """Create scan with standard response format."""
        session_id = self.kwargs.get('session_id')
        data = request.data.copy()
        data['session'] = session_id
        data['scanned_by'] = request.user.id
        data['scanned_by_name'] = request.user.name or request.user.email
        data['scanned_by_email'] = request.user.email
        
        serializer = self.get_serializer(data=data)
        if serializer.is_valid():
            scan = serializer.save(created_by=request.user)
            
            # Update session statistics
            session = AuditSession.objects.get(id=session_id)
            session.total_assets += 1
            if scan.status == AuditScan.Status.VERIFIED:
                session.verified_assets += 1
            elif scan.status == AuditScan.Status.DAMAGED:
                session.damaged_assets += 1
            session.save(updated_by=request.user)
            
            return StandardResponse.created(
                AuditScanSerializer(scan).data,
                "Scan recorded successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class AuditInchargeListView(generics.ListCreateAPIView):
    """List and create audit incharges."""
    queryset = AuditIncharge.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    serializer_class = AuditInchargeSerializer
    
    def get_queryset(self):
        """Filter incharges by session."""
        session_id = self.kwargs.get('session_id')
        return AuditIncharge.objects.filter(session_id=session_id, is_active=True)
    
    def list(self, request, *args, **kwargs):
        """List incharges with standard response format."""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Incharges retrieved successfully")
    
    def create(self, request, *args, **kwargs):
        """Create incharge with standard response format."""
        session_id = self.kwargs.get('session_id')
        data = request.data.copy()
        data['session'] = session_id
        
        serializer = self.get_serializer(data=data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return StandardResponse.created(
                serializer.data,
                "Incharge assigned successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)
