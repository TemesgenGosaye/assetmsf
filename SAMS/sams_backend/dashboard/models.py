"""
Dashboard models for metrics and activity tracking.
"""
from django.utils.translation import gettext_lazy as _
from django.db import models
from core.models import BaseModel
from authentication.models import User


class RecentActivity(BaseModel):
    """
    Recent activity feed for dashboard.
    """
    class Type(models.TextChoices):
        """Activity types."""
        SYSTEM = 'system', _('System')
        ASSET_CREATED = 'asset_created', _('Asset Created')
        ASSET_UPDATED = 'asset_updated', _('Asset Updated')
        ASSET_DELETED = 'asset_deleted', _('Asset Deleted')
        QR_GENERATED = 'qr_generated', _('QR Generated')
        REPORT = 'report', _('Report')
        APPROVAL = 'approval', _('Approval')
        TICKET = 'ticket', _('Ticket')
        AUDIT = 'audit', _('Audit')
        USER = 'user', _('User')

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='activities',
        verbose_name=_('user')
    )
    type = models.CharField(
        _('type'),
        max_length=30,
        choices=Type.choices,
        default=Type.SYSTEM,
        db_index=True
    )
    message = models.TextField(_('message'))
    user_name = models.CharField(_('user name'), max_length=255, null=True, blank=True)
    metadata = models.JSONField(_('metadata'), default=dict, null=True, blank=True)

    class Meta:
        db_table = 'recent_activity'
        verbose_name = _('recent activity')
        verbose_name_plural = _('recent activities')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['type']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.type}"


class SystemSettings(BaseModel):
    """
    System-wide settings (singleton).
    """
    id = models.BooleanField(_('id'), primary_key=True, default=True)
    timezone = models.CharField(_('timezone'), max_length=50, default='UTC')
    language = models.CharField(_('language'), max_length=10, default='en')
    backup_frequency = models.CharField(
        _('backup frequency'),
        max_length=20,
        choices=[
            ('hourly', _('Hourly')),
            ('daily', _('Daily')),
            ('weekly', _('Weekly')),
            ('monthly', _('Monthly')),
        ],
        default='daily'
    )
    auto_backup = models.BooleanField(_('auto backup'), default=True)
    appearance = models.JSONField(_('appearance'), default=dict, null=True, blank=True)

    class Meta:
        db_table = 'system_settings'
        verbose_name = _('system settings')
        verbose_name_plural = _('system settings')

    def __str__(self):
        return "System Settings"


class PropertyLicense(BaseModel):
    """
    Property-based license limits.
    """
    class Plan(models.TextChoices):
        """License plans."""
        FREE = 'free', _('Free')
        STANDARD = 'standard', _('Standard')
        PRO = 'pro', _('Pro')
        BUSINESS = 'business', _('Business')

    property_id = models.CharField(_('property ID'), max_length=50, unique=True, db_index=True)
    asset_limit = models.IntegerField(_('asset limit'), default=0, help_text=_('0 = unlimited'))
    plan = models.CharField(
        _('plan'),
        max_length=20,
        choices=Plan.choices,
        null=True,
        blank=True
    )

    class Meta:
        db_table = 'property_license'
        verbose_name = _('property license')
        verbose_name_plural = _('property licenses')
        indexes = [
            models.Index(fields=['property_id']),
        ]

    def __str__(self):
        return f"{self.property_id} - {self.asset_limit or 'Unlimited'}"


class LicenseMeta(BaseModel):
    """
    Global license metadata.
    """
    key = models.CharField(_('key'), max_length=50, unique=True, db_index=True)
    value = models.JSONField(_('value'))

    class Meta:
        db_table = 'license_meta'
        verbose_name = _('license metadata')
        verbose_name_plural = _('license metadata')

    def __str__(self):
        return self.key
