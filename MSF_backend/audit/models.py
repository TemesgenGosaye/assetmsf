"""
Audit module models for audit sessions and reports.
"""
from django.utils.translation import gettext_lazy as _
from django.db import models
from core.models import BaseModel
from authentication.models import User
from properties.models import Property


class AuditSession(BaseModel):
    """
    Audit session for tracking asset audits.
    """
    class Status(models.TextChoices):
        """Audit session status."""
        SCHEDULED = 'scheduled', _('Scheduled')
        IN_PROGRESS = 'in_progress', _('In Progress')
        COMPLETED = 'completed', _('Completed')
        CANCELLED = 'cancelled', _('Cancelled')

    class Frequency(models.TextChoices):
        """Audit frequency."""
        DAILY = 'daily', _('Daily')
        WEEKLY = 'weekly', _('Weekly')
        MONTHLY = 'monthly', _('Monthly')
        QUARTERLY = 'quarterly', _('Quarterly')
        YEARLY = 'yearly', _('Yearly')
        AD_HOC = 'ad_hoc', _('Ad Hoc')

    id = models.CharField(_('session ID'), max_length=50, primary_key=True)
    name = models.CharField(_('name'), max_length=255, db_index=True)
    description = models.TextField(_('description'), null=True, blank=True)
    
    # Property
    property = models.ForeignKey(
        Property,
        on_delete=models.PROTECT,
        related_name='audit_sessions',
        verbose_name=_('property')
    )
    
    # Status and Frequency
    status = models.CharField(
        _('status'),
        max_length=20,
        choices=Status.choices,
        default=Status.SCHEDULED,
        db_index=True
    )
    frequency = models.CharField(
        _('frequency'),
        max_length=20,
        choices=Frequency.choices,
        default=Frequency.MONTHLY
    )
    
    # Dates
    scheduled_date = models.DateField(_('scheduled date'), db_index=True)
    start_date = models.DateTimeField(_('start date'), null=True, blank=True)
    end_date = models.DateTimeField(_('end date'), null=True, blank=True)
    
    # Initiated By
    initiated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='initiated_audits',
        verbose_name=_('initiated by')
    )
    
    # Statistics
    total_assets = models.IntegerField(_('total assets'), default=0)
    verified_assets = models.IntegerField(_('verified assets'), default=0)
    damaged_assets = models.IntegerField(_('damaged assets'), default=0)
    missing_assets = models.IntegerField(_('missing assets'), default=0)
    
    # Additional Information
    notes = models.TextField(_('notes'), null=True, blank=True)
    metadata = models.JSONField(_('metadata'), default=dict, null=True, blank=True)

    class Meta:
        db_table = 'audit_sessions'
        verbose_name = _('audit session')
        verbose_name_plural = _('audit sessions')
        ordering = ['-scheduled_date']
        indexes = [
            models.Index(fields=['property']),
            models.Index(fields=['status']),
            models.Index(fields=['scheduled_date']),
        ]

    def __str__(self):
        return f"{self.id} - {self.name}"

    def get_completion_percentage(self):
        """Get the completion percentage of the audit."""
        if self.total_assets == 0:
            return 0
        return (self.verified_assets / self.total_assets) * 100


class AuditAssignment(BaseModel):
    """
    Department assignments for audit sessions.
    """
    session = models.ForeignKey(
        AuditSession,
        on_delete=models.CASCADE,
        related_name='assignments',
        verbose_name=_('session')
    )
    department = models.CharField(_('department'), max_length=255, db_index=True)
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_assignments',
        verbose_name=_('assigned to')
    )
    assigned_at = models.DateTimeField(_('assigned at'), auto_now_add=True)
    status = models.CharField(
        _('status'),
        max_length=20,
        default='pending',
        choices=[
            ('pending', _('Pending')),
            ('in_progress', _('In Progress')),
            ('completed', _('Completed')),
        ],
        db_index=True
    )

    class Meta:
        db_table = 'audit_assignments'
        verbose_name = _('audit assignment')
        verbose_name_plural = _('audit assignments')
        unique_together = ['session', 'department']
        indexes = [
            models.Index(fields=['session']),
            models.Index(fields=['department']),
            models.Index(fields=['assigned_to']),
        ]

    def __str__(self):
        return f"{self.session.id} - {self.department}"


class AuditReview(BaseModel):
    """
    Review submissions for audit assignments.
    """
    assignment = models.ForeignKey(
        AuditAssignment,
        on_delete=models.CASCADE,
        related_name='reviews',
        verbose_name=_('assignment')
    )
    reviewer = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_reviews',
        verbose_name=_('reviewer')
    )
    assets_reviewed = models.IntegerField(_('assets reviewed'), default=0)
    verified_count = models.IntegerField(_('verified count'), default=0)
    damaged_count = models.IntegerField(_('damaged count'), default=0)
    missing_count = models.IntegerField(_('missing count'), default=0)
    notes = models.TextField(_('notes'), null=True, blank=True)
    submitted_at = models.DateTimeField(_('submitted at'), auto_now_add=True)

    class Meta:
        db_table = 'audit_reviews'
        verbose_name = _('audit review')
        verbose_name_plural = _('audit reviews')
        ordering = ['-submitted_at']
        indexes = [
            models.Index(fields=['assignment']),
            models.Index(fields=['reviewer']),
        ]

    def __str__(self):
        return f"{self.assignment.session.id} - {self.assignment.department} Review"


class AuditReport(BaseModel):
    """
    Generated reports for audit sessions.
    """
    session = models.ForeignKey(
        AuditSession,
        on_delete=models.CASCADE,
        related_name='reports',
        verbose_name=_('session')
    )
    report_type = models.CharField(
        _('report type'),
        max_length=50,
        default='summary'
    )
    file_url = models.URLField(_('file URL'), null=True, blank=True)
    generated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='generated_audit_reports',
        verbose_name=_('generated by')
    )
    generated_at = models.DateTimeField(_('generated at'), auto_now_add=True)
    summary = models.JSONField(_('summary'), default=dict, null=True, blank=True)

    class Meta:
        db_table = 'audit_reports'
        verbose_name = _('audit report')
        verbose_name_plural = _('audit reports')
        ordering = ['-generated_at']
        indexes = [
            models.Index(fields=['session']),
        ]

    def __str__(self):
        return f"{self.session.id} - {self.report_type}"


class AuditIncharge(BaseModel):
    """
    Incharge assignments for audit sessions.
    """
    session = models.ForeignKey(
        AuditSession,
        on_delete=models.CASCADE,
        related_name='incharges',
        verbose_name=_('session')
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='audit_incharges',
        verbose_name=_('user')
    )
    role = models.CharField(
        _('role'),
        max_length=50,
        default='incharge'
    )
    assigned_at = models.DateTimeField(_('assigned at'), auto_now_add=True)

    class Meta:
        db_table = 'audit_incharge'
        verbose_name = _('audit incharge')
        verbose_name_plural = _('audit incharges')
        unique_together = ['session', 'user']
        indexes = [
            models.Index(fields=['session']),
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return f"{self.session.id} - {self.user.email}"


class AuditScan(BaseModel):
    """
    QR scan records during audit sessions.
    """
    class Status(models.TextChoices):
        """Scan status."""
        VERIFIED = 'verified', _('Verified')
        DAMAGED = 'damaged', _('Damaged')
        MISSING = 'missing', _('Missing')

    session = models.ForeignKey(
        AuditSession,
        on_delete=models.CASCADE,
        related_name='scans',
        verbose_name=_('session')
    )
    asset_id = models.CharField(_('asset ID'), max_length=50, db_index=True)
    property_id = models.CharField(_('property ID'), max_length=50, null=True, blank=True)
    department = models.CharField(_('department'), max_length=255)
    status = models.CharField(
        _('status'),
        max_length=20,
        choices=Status.choices,
        default=Status.VERIFIED
    )
    scanned_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_scans',
        verbose_name=_('scanned by')
    )
    scanned_by_name = models.CharField(_('scanned by name'), max_length=255, null=True, blank=True)
    scanned_by_email = models.CharField(_('scanned by email'), max_length=255, null=True, blank=True)
    comment = models.TextField(_('comment'), null=True, blank=True)
    scanned_at = models.DateTimeField(_('scanned at'), auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'audit_scans'
        verbose_name = _('audit scan')
        verbose_name_plural = _('audit scans')
        ordering = ['-scanned_at']
        indexes = [
            models.Index(fields=['session']),
            models.Index(fields=['asset_id']),
            models.Index(fields=['scanned_by']),
            models.Index(fields=['scanned_at']),
        ]

    def __str__(self):
        return f"{self.session.id} - {self.asset_id}"
