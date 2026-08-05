"""
Report models for generated reports.
"""
from django.utils.translation import gettext_lazy as _
from django.db import models
from core.models import BaseModel
from authentication.models import User


class Report(BaseModel):
    """
    Generated report records.
    """
    class Type(models.TextChoices):
        """Report types."""
        ASSET = 'asset', _('Asset Report')
        MAINTENANCE = 'maintenance', _('Maintenance Report')
        AUDIT = 'audit', _('Audit Report')
        APPROVAL = 'approval', _('Approval Report')
        USER = 'user', _('User Report')
        PROPERTY = 'property', _('Property Report')
        DEPARTMENT = 'department', _('Department Report')

    class Format(models.TextChoices):
        """Report formats."""
        PDF = 'pdf', _('PDF')
        EXCEL = 'excel', _('Excel')
        CSV = 'csv', _('CSV')

    class Status(models.TextChoices):
        """Report status."""
        PENDING = 'pending', _('Pending')
        PROCESSING = 'processing', _('Processing')
        COMPLETED = 'completed', _('Completed')
        FAILED = 'failed', _('Failed')

    name = models.CharField(_('name'), max_length=255, db_index=True)
    type = models.CharField(
        _('type'),
        max_length=20,
        choices=Type.choices,
        db_index=True
    )
    format = models.CharField(
        _('format'),
        max_length=10,
        choices=Format.choices,
        default=Format.PDF
    )
    status = models.CharField(
        _('status'),
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True
    )
    date_from = models.DateField(_('date from'), null=True, blank=True)
    date_to = models.DateField(_('date to'), null=True, blank=True)
    file_url = models.URLField(_('file URL'), null=True, blank=True)
    file_size = models.IntegerField(_('file size'), null=True, blank=True)
    
    # Filter metadata
    filter_session_id = models.CharField(_('filter session ID'), max_length=50, null=True, blank=True)
    filter_department = models.CharField(_('filter department'), max_length=255, null=True, blank=True)
    filter_property = models.CharField(_('filter property'), max_length=50, null=True, blank=True)
    filter_asset_type = models.CharField(_('filter asset type'), max_length=255, null=True, blank=True)
    
    # Creator information
    created_by_name = models.CharField(_('created by name'), max_length=255, null=True, blank=True)
    
    # Error information
    error_message = models.TextField(_('error message'), null=True, blank=True)

    class Meta:
        db_table = 'reports'
        verbose_name = _('report')
        verbose_name_plural = _('reports')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['type']),
            models.Index(fields=['status']),
            models.Index(fields=['date_from']),
            models.Index(fields=['date_to']),
        ]

    def __str__(self):
        return f"{self.name} - {self.type}"
