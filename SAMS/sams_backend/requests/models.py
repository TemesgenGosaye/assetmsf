"""
Approval workflow models for various request types.
"""
from django.utils.translation import gettext_lazy as _
from django.db import models
from core.models import BaseModel
from authentication.models import User
from assets.models import Asset


class ApprovalRequest(BaseModel):
    """
    Approval request for various actions (asset requests, transfers, etc.).
    """
    class RequestType(models.TextChoices):
        """Types of approval requests."""
        ASSET_REQUEST = 'asset_request', _('Asset Request')
        TRANSFER_REQUEST = 'transfer_request', _('Transfer Request')
        MAINTENANCE_REQUEST = 'maintenance_request', _('Maintenance Request')
        PURCHASE_REQUEST = 'purchase_request', _('Purchase Request')
        DISPOSAL_REQUEST = 'disposal_request', _('Disposal Request')

    class Status(models.TextChoices):
        """Approval status."""
        PENDING = 'pending', _('Pending')
        UNDER_REVIEW = 'under_review', _('Under Review')
        APPROVED = 'approved', _('Approved')
        REJECTED = 'rejected', _('Rejected')
        CANCELLED = 'cancelled', _('Cancelled')
        COMPLETED = 'completed', _('Completed')

    # Request Details
    request_type = models.CharField(
        _('request type'),
        max_length=30,
        choices=RequestType.choices,
        db_index=True
    )
    title = models.CharField(_('title'), max_length=255, db_index=True)
    description = models.TextField(_('description'))
    
    # Asset Reference (if applicable)
    asset = models.ForeignKey(
        Asset,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='approval_requests',
        verbose_name=_('asset')
    )
    
    # Requester
    requester = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='approval_requests',
        verbose_name=_('requester')
    )
    requester_department = models.CharField(_('requester department'), max_length=255, null=True, blank=True)
    
    # Current Approver
    current_approver = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pending_approvals',
        verbose_name=_('current approver')
    )
    
    # Status
    status = models.CharField(
        _('status'),
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True
    )
    
    # Decision
    decision = models.TextField(_('decision'), null=True, blank=True)
    decided_at = models.DateTimeField(_('decided at'), null=True, blank=True)
    decided_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='decided_approvals',
        verbose_name=_('decided by')
    )
    
    # Forwarding
    forwarded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='forwarded_approvals',
        verbose_name=_('forwarded by')
    )
    forwarded_at = models.DateTimeField(_('forwarded at'), null=True, blank=True)
    
    # Additional Data
    request_data = models.JSONField(_('request data'), default=dict, null=True, blank=True)
    metadata = models.JSONField(_('metadata'), default=dict, null=True, blank=True)

    class Meta:
        db_table = 'approval_requests'
        verbose_name = _('approval request')
        verbose_name_plural = _('approval requests')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['request_type']),
            models.Index(fields=['status']),
            models.Index(fields=['requester']),
            models.Index(fields=['current_approver']),
            models.Index(fields=['asset']),
        ]

    def __str__(self):
        return f"{self.id} - {self.title}"

    def is_pending(self):
        """Check if request is pending approval."""
        return self.status in [self.Status.PENDING, self.Status.UNDER_REVIEW]

    def can_be_forwarded(self):
        """Check if request can be forwarded to admin."""
        return self.status == self.Status.UNDER_REVIEW


class ApprovalEvent(BaseModel):
    """
    Audit trail for approval actions.
    """
    class ActionType(models.TextChoices):
        """Action types."""
        SUBMITTED = 'submitted', _('Submitted')
        UNDER_REVIEW = 'under_review', _('Under Review')
        FORWARDED = 'forwarded', _('Forwarded')
        APPROVED = 'approved', _('Approved')
        REJECTED = 'rejected', _('Rejected')
        CANCELLED = 'cancelled', _('Cancelled')
        COMPLETED = 'completed', _('Completed')
        COMMENT = 'comment', _('Comment')

    approval = models.ForeignKey(
        ApprovalRequest,
        on_delete=models.CASCADE,
        related_name='events',
        verbose_name=_('approval')
    )
    action = models.CharField(
        _('action'),
        max_length=20,
        choices=ActionType.choices
    )
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approval_events',
        verbose_name=_('actor')
    )
    actor_name = models.CharField(_('actor name'), max_length=255, null=True, blank=True)
    actor_email = models.CharField(_('actor email'), max_length=255, null=True, blank=True)
    notes = models.TextField(_('notes'), null=True, blank=True)
    old_status = models.CharField(_('old status'), max_length=20, null=True, blank=True)
    new_status = models.CharField(_('new status'), max_length=20, null=True, blank=True)

    class Meta:
        db_table = 'approval_events'
        verbose_name = _('approval event')
        verbose_name_plural = _('approval events')
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['approval']),
            models.Index(fields=['action']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.approval.id} - {self.action} by {self.actor_name}"
