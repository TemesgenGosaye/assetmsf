"""
Views for maintenance ticket management.
"""
from rest_framework import generics, status, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from core.responses import StandardResponse
from core.exceptions import ValidationException
from .serializers import (
    MaintenanceTicketSerializer, MaintenanceTicketCreateSerializer,
    MaintenanceTicketUpdateSerializer, TicketEventSerializer,
    TicketEventCreateSerializer, TicketAttachmentSerializer,
    TicketAttachmentCreateSerializer, MaintenanceScheduleSerializer,
    MaintenanceScheduleCreateSerializer
)
from .models import MaintenanceTicket, TicketEvent, TicketAttachment, MaintenanceSchedule
from assets.models import Asset
from authentication.models import UserPropertyAccess


class MaintenanceTicketListView(generics.ListCreateAPIView):
    """List and create maintenance tickets."""
    queryset = MaintenanceTicket.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'priority', 'asset', 'assigned_to']
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'due_date', 'priority']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        """Return appropriate serializer based on request method."""
        if self.request.method == 'POST':
            return MaintenanceTicketCreateSerializer
        return MaintenanceTicketSerializer
    
    def get_queryset(self):
        """Filter queryset based on user permissions."""
        user = self.request.user
        queryset = MaintenanceTicket.objects.filter(is_active=True)
        
        if user.is_super_admin() or user.is_admin():
            return queryset
        
        # Filter by property access
        accessible_property_ids = UserPropertyAccess.objects.filter(
            user=user
        ).values_list('property_id', flat=True)
        
        if accessible_property_ids:
            queryset = queryset.filter(asset__property_id__in=accessible_property_ids)
        
        # Filter by assignment
        if user.is_manager() or user.is_field_staff():
            queryset = queryset.filter(assigned_to=user) | queryset.filter(assigned_to__isnull=True)
        
        return queryset.distinct()
    
    def list(self, request, *args, **kwargs):
        """List tickets with standard response format."""
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Tickets retrieved successfully")
    
    def create(self, request, *args, **kwargs):
        """Create ticket with standard response format."""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            ticket = serializer.save(requester=request.user, created_by=request.user)
            
            # Create initial event
            TicketEvent.objects.create(
                ticket=ticket,
                event_type=TicketEvent.EventType.SUBMITTED,
                actor=request.user,
                actor_name=request.user.name or request.user.email,
                actor_email=request.user.email,
                message=f"Ticket submitted by {request.user.name or request.user.email}"
            )
            
            return StandardResponse.created(
                MaintenanceTicketSerializer(ticket).data,
                "Ticket created successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class MaintenanceTicketDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete aaintenance ticket."""
    queryset = MaintenanceTicket.objects.filter(is_active=True)
    serializer_class = MaintenanceTicketSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'
    
    def get_queryset(self):
        """Filter queryset based on user permissions."""
        user = self.request.user
        queryset = MaintenanceTicket.objects.filter(is_active=True)
        
        if user.is_super_admin() or user.is_admin():
            return queryset
        
        accessible_property_ids = UserPropertyAccess.objects.filter(
            user=user
        ).values_list('property_id', flat=True)
        
        if accessible_property_ids:
            queryset = queryset.filter(asset__property_id__in=accessible_property_ids)
        
        return queryset
    
    def retrieve(self, request, *args, **kwargs):
        """Retrieve ticket with standard response format."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return StandardResponse.success(serializer.data, "Ticket retrieved successfully")
    
    def update(self, request, *args, **kwargs):
        """Update ticket with standard response format."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Check if ticket is closed
        if instance.is_closed():
            raise ValidationException("Cannot modify a closed ticket.")
        
        old_status = instance.status
        serializer = MaintenanceTicketUpdateSerializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            ticket = serializer.save(updated_by=request.user)
            
            # Create status change event
            if 'status' in serializer.validated_data and old_status != ticket.status:
                TicketEvent.objects.create(
                    ticket=ticket,
                    event_type=TicketEvent.EventType.STATUS_CHANGE,
                    actor=request.user,
                    actor_name=request.user.name or request.user.email,
                    actor_email=request.user.email,
                    message=f"Status changed from {old_status} to {ticket.status}",
                    old_value=old_status,
                    new_value=ticket.status
                )
            
            return StandardResponse.success(
                MaintenanceTicketSerializer(ticket).data,
                "Ticket updated successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)
    
    def destroy(self, request, *args, **kwargs):
        """Soft delete ticket."""
        instance = self.get_object()
        if instance.is_closed():
            raise ValidationException("Cannot delete a closed ticket.")
        instance.soft_delete(request.user)
        return StandardResponse.no_content("Ticket deleted successfully")


class TicketEventListView(generics.ListCreateAPIView):
    """List and create ticket events (comments)."""
    queryset = TicketEvent.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        """Return appropriate serializer based on request method."""
        if self.request.method == 'POST':
            return TicketEventCreateSerializer
        return TicketEventSerializer
    
    def get_queryset(self):
        """Filter events by ticket."""
        ticket_id = self.kwargs.get('ticket_id')
        return TicketEvent.objects.filter(ticket_id=ticket_id, is_active=True).order_by('created_at')
    
    def list(self, request, *args, **kwargs):
        """List events with standard response format."""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Events retrieved successfully")
    
    def create(self, request, *args, **kwargs):
        """Create event with standard response format."""
        ticket_id = self.kwargs.get('ticket_id')
        ticket = MaintenanceTicket.objects.get(id=ticket_id)
        
        # Check if ticket is closed
        if ticket.is_closed():
            raise ValidationException("Cannot add comments to a closed ticket.")
        
        data = request.data.copy()
        data['ticket'] = ticket_id
        data['event_type'] = TicketEvent.EventType.COMMENT
        data['actor'] = request.user.id
        data['actor_name'] = request.user.name or request.user.email
        data['actor_email'] = request.user.email
        
        serializer = self.get_serializer(data=data)
        if serializer.is_valid():
            event = serializer.save(created_by=request.user)
            return StandardResponse.created(
                TicketEventSerializer(event).data,
                "Comment added successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class TicketAttachmentListView(generics.ListCreateAPIView):
    """List and create ticket attachments."""
    queryset = TicketAttachment.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        """Return appropriate serializer based on request method."""
        if self.request.method == 'POST':
            return TicketAttachmentCreateSerializer
        return TicketAttachmentSerializer
    
    def get_queryset(self):
        """Filter attachments by ticket."""
        ticket_id = self.kwargs.get('ticket_id')
        return TicketAttachment.objects.filter(ticket_id=ticket_id, is_active=True)
    
    def list(self, request, *args, **kwargs):
        """List attachments with standard response format."""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Attachments retrieved successfully")
    
    def create(self, request, *args, **kwargs):
        """Create attachment with standard response format."""
        ticket_id = self.kwargs.get('ticket_id')
        ticket = MaintenanceTicket.objects.get(id=ticket_id)
        
        # Check if ticket is closed
        if ticket.is_closed():
            raise ValidationException("Cannot add attachments to a closed ticket.")
        
        data = request.data.copy()
        data['ticket'] = ticket_id
        data['uploaded_by'] = request.user.id
        
        serializer = self.get_serializer(data=data)
        if serializer.is_valid():
            attachment = serializer.save(created_by=request.user)
            return StandardResponse.created(
                TicketAttachmentSerializer(attachment).data,
                "Attachment uploaded successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class MaintenanceScheduleListView(generics.ListCreateAPIView):
    """List and create maintenance schedules."""
    queryset = MaintenanceSchedule.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['frequency', 'asset', 'is_active']
    ordering_fields = ['next_due', 'start_date']
    ordering = ['next_due']
    
    def get_serializer_class(self):
        """Return appropriate serializer based on request method."""
        if self.request.method == 'POST':
            return MaintenanceScheduleCreateSerializer
        return MaintenanceScheduleSerializer
    
    def get_queryset(self):
        """Filter queryset based on user permissions."""
        user = self.request.user
        queryset = MaintenanceSchedule.objects.filter(is_active=True)
        
        if user.is_super_admin() or user.is_admin():
            return queryset
        
        accessible_property_ids = UserPropertyAccess.objects.filter(
            user=user
        ).values_list('property_id', flat=True)
        
        if accessible_property_ids:
            queryset = queryset.filter(asset__property_id__in=accessible_property_ids)
        
        return queryset
    
    def list(self, request, *args, **kwargs):
        """List schedules with standard response format."""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Schedules retrieved successfully")
    
    def create(self, request, *args, **kwargs):
        """Create schedule with standard response format."""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return StandardResponse.created(
                MaintenanceScheduleSerializer(serializer.instance).data,
                "Schedule created successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class MaintenanceScheduleDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a maintenance schedule."""
    queryset = MaintenanceSchedule.objects.filter(is_active=True)
    serializer_class = MaintenanceScheduleSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'
    
    def retrieve(self, request, *args, **kwargs):
        """Retrieve schedule with standard response format."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return StandardResponse.success(serializer.data, "Schedule retrieved successfully")
    
    def update(self, request, *args, **kwargs):
        """Update schedule with standard response format."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = MaintenanceScheduleCreateSerializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return StandardResponse.success(
                MaintenanceScheduleSerializer(serializer.instance).data,
                "Schedule updated successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)
    
    def destroy(self, request, *args, **kwargs):
        """Soft delete schedule."""
        instance = self.get_object()
        instance.soft_delete(request.user)
        return StandardResponse.no_content("Schedule deleted successfully")
