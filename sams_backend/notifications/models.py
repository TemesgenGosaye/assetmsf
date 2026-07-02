"""
Notification models for in-app and email notifications.
"""
from django.utils.translation import gettext_lazy as _
from django.db import models
from core.models import BaseModel
from authentication.models import User


class Notification(BaseModel):
    """
    In-app notification for users.
    """
    class Type(models.TextChoices):
        """Notification types."""
        SYSTEM = 'system', _('System')
        ASSET = 'asset', _('Asset')
        APPROVAL = 'approval', _('Approval')
        TICKET = 'ticket', _('Ticket')
        AUDIT = 'audit', _('Audit')
        REPORT = 'report', _('Report')
        QR = 'qr', _('QR Code')

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='notifications',
        verbose_name=_('user')
    )
    title = models.CharField(_('title'), max_length=255, db_index=True)
    message = models.TextField(_('message'))
    type = models.CharField(
        _('type'),
        max_length=20,
        choices=Type.choices,
        default=Type.SYSTEM,
        db_index=True
    )
    read = models.BooleanField(_('read'), default=False, db_index=True)
    user_name = models.CharField(_('user name'), max_length=255, null=True, blank=True)
    action_url = models.URLField(_('action URL'), null=True, blank=True)
    metadata = models.JSONField(_('metadata'), default=dict, null=True, blank=True)

    class Meta:
        db_table = 'notifications'
        verbose_name = _('notification')
        verbose_name_plural = _('notifications')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['read']),
            models.Index(fields=['type']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.title}"
