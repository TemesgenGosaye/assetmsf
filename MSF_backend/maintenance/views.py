"""
Views for maintenance ticket management.
"""
from datetime import timedelta

from rest_framework import generics, status, filters
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Count, Sum
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
from assets.models import Asset, AssetLifecycleEvent
from assets.signals import log_lifecycle_event
from authentication.models import User, UserPropertyAccess


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
        data = request.data.copy()
        
        # Map frontend 'assignee' to model 'assigned_to'
        assignee = data.pop('assignee', None)
        if assignee and assignee != 'null':
            try:
                user_obj = User.objects.get(id=assignee)
                data['assigned_to'] = str(user_obj.id)
            except (User.DoesNotExist, ValueError):
                pass
        
        # Map frontend 'created_by' to model 'created_by'
        created_by_val = data.pop('created_by', None)
        creator_user = request.user
        if created_by_val:
            try:
                creator_user = User.objects.get(id=created_by_val)
            except (User.DoesNotExist, ValueError):
                pass
        
        # Map frontend 'sla_due_at' to model 'due_date'
        sla = data.pop('sla_due_at', None)
        if sla and sla != 'null':
            data['due_date'] = sla
        
        # Remove fields not in serializer
        data.pop('created_at', None)
        data.pop('updated_at', None)
        
        serializer = self.get_serializer(data=data)
        if serializer.is_valid():
            ticket = serializer.save(created_by=creator_user)
            
            # Create initial event
            actor_name = creator_user.name or creator_user.email
            TicketEvent.objects.create(
                ticket=ticket,
                event_type=TicketEvent.EventType.SYSTEM,
                author=creator_user,
                author_name=actor_name,
                author_email=creator_user.email,
                message=f"Ticket submitted by {actor_name}"
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


class MaintenanceScheduleActionView(generics.GenericAPIView):
    """
    Perform a maintenance schedule.

    Marks the schedule as performed (last_performed = today), advances next_due
    by the configured frequency, and records an immutable asset lifecycle event.
    """
    queryset = MaintenanceSchedule.objects.filter(is_active=True)
    serializer_class = MaintenanceScheduleSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        instance = self.queryset.filter(id=self.kwargs.get('id')).first()
        if not instance:
            from django.http import Http404
            raise Http404("No MaintenanceSchedule matches the given query.")
        return instance

    @staticmethod
    def _advance_due(current_due, frequency):
        from datetime import date
        if frequency == MaintenanceSchedule.Frequency.DAILY:
            return current_due + timedelta(days=1)
        if frequency == MaintenanceSchedule.Frequency.WEEKLY:
            return current_due + timedelta(weeks=1)
        if frequency == MaintenanceSchedule.Frequency.MONTHLY:
            month = current_due.month + 1
            year = current_due.year + (month - 1) // 12
            month = (month - 1) % 12 + 1
            day = min(current_due.day, 28)
            return date(year, month, day)
        if frequency == MaintenanceSchedule.Frequency.QUARTERLY:
            return current_due + timedelta(days=90)
        if frequency == MaintenanceSchedule.Frequency.YEARLY:
            return current_due.replace(year=current_due.year + 1)
        return current_due + timedelta(days=30)

    def post(self, request, *args, **kwargs):
        schedule = self.get_object()
        from datetime import date
        today = date.today()

        schedule.last_performed = today
        schedule.next_due = self._advance_due(schedule.next_due, schedule.frequency)
        if schedule.end_date and schedule.next_due > schedule.end_date:
            schedule.is_active = False
        schedule.updated_by = request.user
        schedule.save(update_fields=['last_performed', 'next_due', 'is_active', 'updated_by', 'updated_at'])

        if schedule.asset_id:
            log_lifecycle_event(
                asset=schedule.asset,
                event_type=AssetLifecycleEvent.EventType.MAINTENANCE_COMPLETED,
                actor=request.user,
                new_value={
                    'schedule': schedule.name,
                    'frequency': schedule.frequency,
                    'performed_on': today.isoformat(),
                    'next_due': schedule.next_due.isoformat(),
                },
                message=f"Preventive maintenance '{schedule.name}' performed on {today}",
            )

        return StandardResponse.success(
            MaintenanceScheduleSerializer(schedule).data,
            "Schedule marked as performed."
        )


class MaintenanceAnalyticsView(generics.GenericAPIView):
    """Aggregated maintenance performance analytics."""
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        from assets.views import scoped_assets

        asset_ids = list(scoped_assets(request.user).values_list('id', flat=True))
        tickets = (MaintenanceTicket.objects.filter(is_active=True, asset_id__in=asset_ids)
                   if asset_ids else MaintenanceTicket.objects.none())

        now = timezone.now()
        open_statuses = [
            MaintenanceTicket.Status.BACKLOG, MaintenanceTicket.Status.OPEN,
            MaintenanceTicket.Status.IN_PROGRESS, MaintenanceTicket.Status.WAITING_PARTS,
            MaintenanceTicket.Status.ON_HOLD,
        ]

        status_rows = tickets.values('status').annotate(count=Count('id'))
        status_breakdown = [
            {'key': r['status'], 'label': str(dict(MaintenanceTicket.Status.choices).get(r['status'], r['status'])),
             'count': r['count']}
            for r in status_rows
        ]

        priority_rows = tickets.values('priority').annotate(count=Count('id'), cost=Sum('actual_cost'))
        priority_breakdown = [
            {'key': r['priority'], 'label': str(dict(MaintenanceTicket.Priority.choices).get(r['priority'], r['priority'])),
             'count': r['count'], 'cost': round(float(r['cost'] or 0), 2)}
            for r in priority_rows
        ]

        resolved = tickets.filter(status=MaintenanceTicket.Status.RESOLVED, resolved_at__isnull=False)
        avg_resolution_hours = None
        durations = []
        for t in resolved.only('created_at', 'resolved_at'):
            durations.append((t.resolved_at - t.created_at).total_seconds() / 3600)
        if durations:
            avg_resolution_hours = round(sum(durations) / len(durations), 1)

        schedules = (MaintenanceSchedule.objects.filter(is_active=True, asset_id__in=asset_ids)
                     if asset_ids else MaintenanceSchedule.objects.none())
        today = timezone.localdate()

        data = {
            'totals': {
                'total_tickets': tickets.count(),
                'open_tickets': tickets.filter(status__in=open_statuses).count(),
                'overdue_tickets': tickets.filter(status__in=open_statuses, due_date__lt=now).count(),
                'resolved_total': resolved.count(),
                'closed_30d': tickets.filter(status=MaintenanceTicket.Status.CLOSED,
                                             updated_at__gte=now - timedelta(days=30)).count(),
                'resolved_30d': tickets.filter(status=MaintenanceTicket.Status.RESOLVED,
                                               resolved_at__gte=now - timedelta(days=30)).count(),
                'sla_breached': tickets.filter(sla_breach=True).count(),
                'estimated_cost': round(float(tickets.aggregate(v=Sum('estimated_cost'))['v'] or 0), 2),
                'actual_cost': round(float(tickets.aggregate(v=Sum('actual_cost'))['v'] or 0), 2),
                'avg_resolution_hours': avg_resolution_hours,
                'schedules_due': schedules.filter(next_due__lte=today + timedelta(days=30)).count(),
                'schedules_overdue': schedules.filter(next_due__lt=today).count(),
            },
            'status_breakdown': status_breakdown,
            'priority_breakdown': priority_breakdown,
        }
        return StandardResponse.success(data, "Maintenance analytics retrieved successfully")
