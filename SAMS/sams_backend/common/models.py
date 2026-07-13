"""
Common models for shared functionality.
"""
from django.utils.translation import gettext_lazy as _
from django.db import models
from core.models import BaseModel


class QRCode(BaseModel):
    """
    QR code records for assets.
    """
    class Status(models.TextChoices):
        """QR code status."""
        ACTIVE = 'active', _('Active')
        PRINTED = 'printed', _('Printed')
        EXPIRED = 'expired', _('Expired')

    asset_id = models.CharField(_('asset ID'), max_length=50, db_index=True)
    asset_name = models.CharField(_('asset name'), max_length=255, null=True, blank=True)
    property = models.CharField(_('property'), max_length=50, null=True, blank=True)
    generated_date = models.DateField(_('generated date'), db_index=True)
    status = models.CharField(
        _('status'),
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True
    )
    printed = models.BooleanField(_('printed'), default=False)
    image_url = models.URLField(_('image URL'), null=True, blank=True)

    class Meta:
        db_table = 'qr_codes'
        verbose_name = _('QR code')
        verbose_name_plural = _('QR codes')
        ordering = ['-generated_date']
        indexes = [
            models.Index(fields=['asset_id']),
            models.Index(fields=['property']),
            models.Index(fields=['generated_date']),
        ]

    def __str__(self):
        return f"{self.asset_id} - {self.generated_date}"


class Vendor(BaseModel):
    """
    Vendor model for asset suppliers and service providers.
    """
    class Status(models.TextChoices):
        """Vendor status."""
        ACTIVE = 'active', _('Active')
        INACTIVE = 'inactive', _('Inactive')
        BLACKLISTED = 'blacklisted', _('Blacklisted')

    name = models.CharField(_('name'), max_length=255, unique=True, db_index=True)
    code = models.CharField(_('code'), max_length=50, unique=True, db_index=True)
    contact_person = models.CharField(_('contact person'), max_length=255, null=True, blank=True)
    email = models.EmailField(_('email'), null=True, blank=True)
    phone = models.CharField(_('phone'), max_length=20, null=True, blank=True)
    address = models.TextField(_('address'), null=True, blank=True)
    city = models.CharField(_('city'), max_length=100, null=True, blank=True)
    state = models.CharField(_('state'), max_length=100, null=True, blank=True)
    country = models.CharField(_('country'), max_length=100, null=True, blank=True)
    postal_code = models.CharField(_('postal code'), max_length=20, null=True, blank=True)
    status = models.CharField(
        _('status'),
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True
    )
    tax_id = models.CharField(_('tax ID'), max_length=50, null=True, blank=True)
    payment_terms = models.CharField(_('payment terms'), max_length=255, null=True, blank=True)
    notes = models.TextField(_('notes'), null=True, blank=True)

    class Meta:
        db_table = 'vendors'
        verbose_name = _('vendor')
        verbose_name_plural = _('vendors')
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['code']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"
