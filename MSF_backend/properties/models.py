"""
Property model for location management.
"""
from django.utils.translation import gettext_lazy as _
from django.db import models
from core.models import BaseModel
from authentication.models import User


class Property(BaseModel):
    """
    Property model for physical locations where assets are stored.
    """
    class Status(models.TextChoices):
        """Property status."""
        ACTIVE = 'active', _('Active')
        INACTIVE = 'inactive', _('Inactive')
        UNDER_MAINTENANCE = 'under_maintenance', _('Under Maintenance')

    class Type(models.TextChoices):
        """Property type."""
        OFFICE = 'office', _('Office')
        STORAGE = 'storage', _('Storage')
        MANUFACTURING = 'manufacturing', _('Manufacturing')
        SITE_OFFICE = 'site_office', _('Site Office')
        OTHER = 'other', _('Other')

    id = models.CharField(_('property code'), max_length=50, primary_key=True)
    name = models.CharField(_('name'), max_length=255, db_index=True)
    type = models.CharField(
        _('type'),
        max_length=20,
        choices=Type.choices,
        default=Type.OFFICE,
        db_index=True,
    )
    address = models.TextField(_('address'), null=True, blank=True)
    city = models.CharField(_('city'), max_length=100, null=True, blank=True, db_index=True)
    state = models.CharField(_('state'), max_length=100, null=True, blank=True)
    country = models.CharField(_('country'), max_length=100, null=True, blank=True)
    postal_code = models.CharField(_('postal code'), max_length=20, null=True, blank=True)
    latitude = models.DecimalField(_('latitude'), max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(_('longitude'), max_digits=9, decimal_places=6, null=True, blank=True)
    status = models.CharField(
        _('status'),
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True
    )
    manager = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='managed_properties',
        verbose_name=_('property manager')
    )
    contact_email = models.EmailField(_('contact email'), null=True, blank=True)
    contact_phone = models.CharField(_('contact phone'), max_length=20, null=True, blank=True)
    total_area = models.DecimalField(_('total area'), max_digits=10, decimal_places=2, null=True, blank=True)
    description = models.TextField(_('description'), null=True, blank=True)

    class Meta:
        db_table = 'properties'
        verbose_name = _('property')
        verbose_name_plural = _('properties')
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['city']),
            models.Index(fields=['status']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.id} - {self.name}"

    def get_full_address(self):
        """Get the full address of the property."""
        parts = [self.address, self.city, self.state, self.postal_code, self.country]
        return ', '.join(filter(None, parts))
