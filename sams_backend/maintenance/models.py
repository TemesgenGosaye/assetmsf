"""
Maintenance ticket model for tracking maintenance requests.
"""
from django.utils.translation import gettext_lazy as _
from django.db import models
from django.core.validators import MinValueValidator
from core.models import BaseModel
from authentication.models import User
from assets.models import Asset


class MaintenanceTicket(BaseModel):
    """
    Maintenance ticket for tracking maintenance requests and their lifecycle.
    """
    class Status(models.TextChoices):
        """Ticket status with immutable closed state."""
        BACKLOG = 'backlog', _('Backlog')
        OPEN = 'open', _('Open')
        IN_PROGRESS = 'in_progress', _('In Progress')
        WAITING_PARTS = 'waiting_parts', _('Waiting Parts')
        ON_HOLD = 'on_hold', _('On Hold')
        RESOLVED = 'resolved', _('Resolved')
        CLOSED = 'closed', _('Closed')

    class Priority(models.TextChoices):
        """Ticket priority levels."""
        LOW = 'low', _('Low')
        MEDIUM = 'medium', _('Medium')
        HIGH = 'high', _('High')
        CRITICAL = 'critical', _('Critical')

    # Basic Information
    title = models.CharField(_('title'), max_length=255, db_index=True)
    description = models.TextField(_('description'))
    
    # Asset Reference
    asset = models.ForeignKey(
        Asset,
        on_delete=models.PROTECT,
        related_name='maintenance_tickets',
        verbose_name=_('asset')
    )
    
    # Assignment
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_tickets',
        verbose_name=_('assigned to')
    )
    assigned_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_tickets_by',
        verbose_name=_('assigned by')
    )
    assigned_at = models.DateTimeField(_('assigned at'), null=True, blank=True)
    
    # Status and Priority
    status = models.CharField(
        _('status'),
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
        db_index=True
    )
    priority = models.CharField(
        _('priority'),
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
        db_index=True
    )
    
    # Resolution
    resolution = models.TextField(_('resolution'), null=True, blank=True)
    resolved_at = models.DateTimeField(_('resolved at'), null=True, blank=True)
    resolved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_tickets',
        verbose_name=_('resolved by')
    )
    
    # SLA Tracking
    due_date = models.DateTimeField(_('due date'), null=True, blank=True)
    sla_breach = models.BooleanField(_('SLA breach'), default=False)
    
    # Location
    location = models.CharField(_('location'), max_length=255, null=True, blank=True)
    
    # Additional Information
    estimated_cost = models.DecimalField(
        _('estimated cost'),
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)]
    )
    actual_cost = models.DecimalField(
        _('actual cost'),
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)]
    )
    metadata = models.JSONField(_('metadata'), default=dict, null=True, blank=True)

    class Meta:
        db_table = 'maintenance_tickets'
        verbose_name = _('maintenance ticket')
        verbose_name_plural = _('maintenance tickets')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['priority']),
            models.Index(fields=['asset']),
            models.Index(fields=['assigned_to']),
            models.Index(fields=['due_date']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.id} - {self.title}"

    def is_closed(self):
        """Check if ticket is closed."""
        return self.status == self.Status.CLOSED

    def is_overdue(self):
        """Check if ticket is overdue."""
        if not self.due_date or self.is_closed():
            return False
        from django.utils import timezone
        return timezone.now() > self.due_date

    def save(self, *args, **kwargs):
        """Override save to enforce immutability of closed tickets."""
        if self.pk:
            old_ticket = MaintenanceTicket.objects.get(pk=self.pk)
            if old_ticket.is_closed():
                raise models.ValidationError(
                    "Cannot modify a closed ticket. Status: {}, comments, and attachments are immutable."
                )
        super().save(*args, **kwargs)


class TicketEvent(BaseModel):
    """
    Events for ticket audit trail (comments, status changes, etc.).
    """
    class EventType(models.TextChoices):
        """Event types."""
        COMMENT = 'comment', _('Comment')
        STATUS_CHANGE = 'status_change', _('Status Change')
        ASSIGNMENT = 'assignment', _('Assignment')
        ATTACHMENT = 'attachment', _('Attachment')
        RESOLUTION = 'resolution', _('Resolution')
        SYSTEM = 'system', _('System')

    ticket = models.ForeignKey(
        MaintenanceTicket,
        on_delete=models.CASCADE,
        related_name='events',
        verbose_name=_('ticket')
    )
    event_type = models.CharField(
        _('event type'),
        max_length=20,
        choices=EventType.choices,
        default=EventType.COMMENT
    )
    author = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ticket_events',
        verbose_name=_('author')
    )
    author_name = models.CharField(_('author name'), max_length=255, null=True, blank=True)
    author_email = models.CharField(_('author email'), max_length=255, null=True, blank=True)
    message = models.TextField(_('message'))
    old_value = models.TextField(_('old value'), null=True, blank=True)
    new_value = models.TextField(_('new value'), null=True, blank=True)
    
    class Meta:
        db_table = 'ticket_events'
        verbose_name = _('ticket event')
        verbose_name_plural = _('ticket events')
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['ticket']),
            models.Index(fields=['event_type']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.ticket.id} - {self.event_type} by {self.author_name}"


class TicketAttachment(BaseModel):
    """
    Attachments for maintenance tickets.
    """
    ticket = models.ForeignKey(
        MaintenanceTicket,
        on_delete=models.CASCADE,
        related_name='attachments',
        verbose_name=_('ticket')
    )
    file = models.FileField(_('file'), upload_to='ticket_attachments/')
    file_name = models.CharField(_('file name'), max_length=255)
    file_type = models.CharField(_('file type'), max_length=100)
    file_size = models.IntegerField(_('file size'))
    description = models.TextField(_('description'), null=True, blank=True)
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ticket_attachments',
        verbose_name=_('uploaded by')
    )

    class Meta:
        db_table = 'ticket_attachments'
        verbose_name = _('ticket attachment')
        verbose_name_plural = _('ticket attachments')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['ticket']),
        ]

    def __str__(self):
        return f"{self.ticket.id} - {self.file_name}"

    def save(self, *args, **kwargs):
        """Override save to enforce immutability of closed tickets."""
        if self.ticket_id:
            ticket = MaintenanceTicket.objects.get(pk=self.ticket_id)
            if ticket.is_closed():
                raise models.ValidationError(
                    "Cannot add attachments to a closed ticket."
                )
        super().save(*args, **kwargs)


class MaintenanceSchedule(BaseModel):
    """
    Scheduled maintenance for assets.
    """
    class Frequency(models.TextChoices):
        """Maintenance frequency."""
        DAILY = 'daily', _('Daily')
        WEEKLY = 'weekly', _('Weekly')
        MONTHLY = 'monthly', _('Monthly')
        QUARTERLY = 'quarterly', _('Quarterly')
        YEARLY = 'yearly', _('Yearly')
        CUSTOM = 'custom', _('Custom')

    asset = models.ForeignKey(
        Asset,
        on_delete=models.CASCADE,
        related_name='maintenance_schedules',
        verbose_name=_('asset')
    )
    name = models.CharField(_('name'), max_length=255)
    description = models.TextField(_('description'), null=True, blank=True)
    frequency = models.CharField(
        _('frequency'),
        max_length=20,
        choices=Frequency.choices,
        default=Frequency.MONTHLY
    )
    start_date = models.DateField(_('start date'))
    end_date = models.DateField(_('end date'), null=True, blank=True)
    last_performed = models.DateField(_('last performed'), null=True, blank=True)
    next_due = models.DateField(_('next due'), db_index=True)
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='scheduled_maintenance',
        verbose_name=_('assigned to')
    )
    estimated_duration_hours = models.DecimalField(
        _('estimated duration (hours)'),
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)]
    )
    is_active = models.BooleanField(_('is active'), default=True, db_index=True)

    class Meta:
        db_table = 'maintenance_schedules'
        verbose_name = _('maintenance schedule')
        verbose_name_plural = _('maintenance schedules')
        ordering = ['next_due']
        indexes = [
            models.Index(fields=['asset']),
            models.Index(fields=['next_due']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.asset.asset_code} - {self.name}"

    def is_overdue(self):
        """Check if maintenance is overdue."""
        if not self.next_due or not self.is_active:
            return False
        from datetime import date
        return date.today() > self.next_due
