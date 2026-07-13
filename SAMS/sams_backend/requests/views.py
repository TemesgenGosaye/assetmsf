"""
Views for approval workflow management.
"""
from rest_framework import generics, status, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from core.responses import StandardResponse
from core.exceptions import ValidationException
from .serializers import (
    ApprovalRequestSerializer, ApprovalRequestCreateSerializer,
    ApprovalEventSerializer, ApprovalEventCreateSerializer
)
from .models import ApprovalRequest, ApprovalEvent
from assets.models import Asset
from authentication.models import UserPropertyAccess, UserPermission, FinalApprover, User


class ApprovalRequestListView(generics.ListCreateAPIView):
    """List and create approval requests."""
    queryset = ApprovalRequest.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['request_type', 'requester', 'current_approver']
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'status']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        """Return appropriate serializer based on request method."""
        if self.request.method == 'POST':
            return ApprovalRequestCreateSerializer
        return ApprovalRequestSerializer
    
    def get_queryset(self):
        """Filter queryset based on user permissions."""
        user = self.request.user
        queryset = ApprovalRequest.objects.filter(is_active=True)
        
        if user.is_super_admin() or user.is_admin():
            return queryset
        
        # Filter by requester
        if user.is_manager() or user.is_field_staff():
            queryset = queryset.filter(requester=user)
        
        # Filter by current approver
        if user.is_manager():
            queryset = queryset.filter(current_approver=user)
        
        status_param = self.request.query_params.get('status')
        if status_param:
            if status_param == 'pending_manager':
                queryset = queryset.filter(
                    status__in=[
                        ApprovalRequest.Status.PENDING,
                        ApprovalRequest.Status.UNDER_REVIEW,
                    ],
                    forwarded_by__isnull=True,
                )
            elif status_param == 'pending_admin':
                queryset = queryset.filter(
                    status=ApprovalRequest.Status.UNDER_REVIEW,
                    forwarded_by__isnull=False,
                )
            elif status_param in dict(ApprovalRequest.Status.choices):
                queryset = queryset.filter(status=status_param)
        
        return queryset.distinct()
    
    def list(self, request, *args, **kwargs):
        """List requests with standard response format."""
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Requests retrieved successfully")
    
    def create(self, request, *args, **kwargs):
        """Create request with standard response format."""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            approval = serializer.save(
                requester=request.user,
                requester_department=request.user.department,
                created_by=request.user
            )
            
            # Create submitted event
            ApprovalEvent.objects.create(
                approval=approval,
                action=ApprovalEvent.ActionType.SUBMITTED,
                actor=request.user,
                actor_name=request.user.name or request.user.email,
                actor_email=request.user.email,
                notes=f"Request submitted by {request.user.name or request.user.email}"
            )
            
            # Set initial approver (manager)
            approval.status = ApprovalRequest.Status.UNDER_REVIEW
            approval.save()
            
            return StandardResponse.created(
                ApprovalRequestSerializer(approval).data,
                "Request submitted successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class ApprovalRequestDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete an approval request."""
    queryset = ApprovalRequest.objects.filter(is_active=True)
    serializer_class = ApprovalRequestSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'
    
    def get_queryset(self):
        """Filter queryset based on user permissions."""
        user = self.request.user
        queryset = ApprovalRequest.objects.filter(is_active=True)
        
        if user.is_super_admin() or user.is_admin():
            return queryset
        
        if user.is_manager():
            queryset = queryset.filter(current_approver=user) | queryset.filter(requester=user)
        
        if user.is_field_staff():
            queryset = queryset.filter(requester=user)
        
        return queryset.distinct()
    
    def retrieve(self, request, *args, **kwargs):
        """Retrieve request with standard response format."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return StandardResponse.success(serializer.data, "Request retrieved successfully")
    
    def destroy(self, request, *args, **kwargs):
        """Soft delete request."""
        instance = self.get_object()
        if not instance.is_pending():
            raise ValidationException("Cannot delete a processed request.")
        instance.soft_delete(request.user)
        return StandardResponse.no_content("Request deleted successfully")


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def forward_approval(request, id):
    """Forward approval to admin."""
    try:
        approval = ApprovalRequest.objects.get(id=id, is_active=True)
        
        if not approval.can_be_forwarded():
            raise ValidationException("Request cannot be forwarded.")
        
        if approval.current_approver != request.user:
            raise ValidationException("You are not the current approver.")
        
        # Find admin to forward to
        admin = User.objects.filter(role=User.Role.ADMIN, status=User.Status.ACTIVE).first()
        if not admin:
            raise ValidationException("No admin available to forward to.")
        
        old_status = approval.status
        approval.current_approver = admin
        approval.forwarded_by = request.user
        approval.forwarded_at = timezone.now()
        approval.save(updated_by=request.user)
        
        # Create forwarded event
        ApprovalEvent.objects.create(
            approval=approval,
            action=ApprovalEvent.ActionType.FORWARDED,
            actor=request.user,
            actor_name=request.user.name or request.user.email,
            actor_email=request.user.email,
            notes=f"Forwarded to admin by {request.user.name or request.user.email}",
            old_status=old_status,
            new_status=approval.status
        )
        
        return StandardResponse.success(
            ApprovalRequestSerializer(approval).data,
            "Request forwarded to admin successfully"
        )
    except ApprovalRequest.DoesNotExist:
        return StandardResponse.not_found("Request not found")
    except ValidationException as e:
        return StandardResponse.bad_request(str(e))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def decide_approval(request, id):
    """Approve or reject approval request."""
    decision = request.data.get('decision')
    notes = request.data.get('notes', '')
    
    if decision not in ['approved', 'rejected']:
        return StandardResponse.bad_request("Invalid decision. Must be 'approved' or 'rejected'.")
    
    try:
        approval = ApprovalRequest.objects.get(id=id, is_active=True)
        
        if not approval.is_pending():
            raise ValidationException("Request is not pending.")
        
        if approval.current_approver != request.user:
            raise ValidationException("You are not the current approver.")
        
        old_status = approval.status
        approval.status = ApprovalRequest.Status.APPROVED if decision == 'approved' else ApprovalRequest.Status.REJECTED
        approval.decision = notes
        approval.decided_at = timezone.now()
        approval.decided_by = request.user
        approval.save(updated_by=request.user)
        
        # Create decision event
        ApprovalEvent.objects.create(
            approval=approval,
            action=ApprovalEvent.ActionType.APPROVED if decision == 'approved' else ApprovalEvent.ActionType.REJECTED,
            actor=request.user,
            actor_name=request.user.name or request.user.email,
            actor_email=request.user.email,
            notes=notes,
            old_status=old_status,
            new_status=approval.status
        )
        
        return StandardResponse.success(
            ApprovalRequestSerializer(approval).data,
            f"Request {decision} successfully"
        )
    except ApprovalRequest.DoesNotExist:
        return StandardResponse.not_found("Request not found")
    except ValidationException as e:
        return StandardResponse.bad_request(str(e))


class ApprovalEventListView(generics.ListCreateAPIView):
    """List and create approval events."""
    queryset = ApprovalEvent.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    serializer_class = ApprovalEventSerializer
    
    def get_queryset(self):
        """Filter events by approval."""
        approval_id = self.kwargs.get('approval_id')
        return ApprovalEvent.objects.filter(approval_id=approval_id, is_active=True).order_by('created_at')
    
    def list(self, request, *args, **kwargs):
        """List events with standard response format."""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Events retrieved successfully")
