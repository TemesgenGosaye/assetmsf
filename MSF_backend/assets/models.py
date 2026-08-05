"""
Asset model for asset lifecycle management.
"""
from django.utils.translation import gettext_lazy as _
from django.db import models
from django.core.validators import MinValueValidator
from core.models import BaseModel
from authentication.models import User
from properties.models import Property
from categories.models import Category, ItemType


class Asset(BaseModel):
    """
    Asset model for tracking physical assets throughout their lifecycle.
    """
    class Status(models.TextChoices):
        """Asset lifecycle status."""
        ACTIVE = 'active', _('Active')
        INACTIVE = 'inactive', _('Inactive')
        DISPOSED = 'disposed', _('Disposed')
        LOST = 'lost', _('Lost')
        DAMAGED = 'damaged', _('Damaged')
        UNDER_MAINTENANCE = 'under_maintenance', _('Under Maintenance')
        RETIRED = 'retired', _('Retired')

    class Condition(models.TextChoices):
        """Asset condition."""
        EXCELLENT = 'excellent', _('Excellent')
        GOOD = 'good', _('Good')
        FAIR = 'fair', _('Fair')
        POOR = 'poor', _('Poor')
        DAMAGED = 'damaged', _('Damaged')

    # Identification
    asset_code = models.CharField(_('asset code'), max_length=50, unique=True, db_index=True)
    barcode = models.CharField(_('barcode'), max_length=100, unique=True, null=True, blank=True, db_index=True)
    qr_code = models.CharField(_('QR code'), max_length=100, unique=True, null=True, blank=True, db_index=True)
    rfid = models.CharField(_('RFID'), max_length=100, unique=True, null=True, blank=True, db_index=True)
    serial_number = models.CharField(_('serial number'), max_length=100, unique=True, null=True, blank=True, db_index=True)
    
    # Basic Information
    name = models.CharField(_('name'), max_length=255, db_index=True)
    description = models.TextField(_('description'), null=True, blank=True)
    
    # Classification
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='assets',
        verbose_name=_('category')
    )
    item_type = models.ForeignKey(
        ItemType,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='assets',
        verbose_name=_('item type')
    )
    subcategory = models.CharField(_('subcategory'), max_length=255, null=True, blank=True)
    
    # Manufacturer and Model
    manufacturer = models.CharField(_('manufacturer'), max_length=255, null=True, blank=True)
    model = models.CharField(_('model'), max_length=255, null=True, blank=True)
    
    # Location and Ownership
    property = models.ForeignKey(
        Property,
        on_delete=models.PROTECT,
        related_name='assets',
        verbose_name=_('property')
    )
    department = models.CharField(_('department'), max_length=255, db_index=True)
    location = models.CharField(_('location'), max_length=255, null=True, blank=True)
    owner = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_assets',
        verbose_name=_('owner')
    )
    
    # Purchase Information
    purchase_date = models.DateField(_('purchase date'), null=True, blank=True)
    purchase_cost = models.DecimalField(
        _('purchase cost'),
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)]
    )
    po_number = models.CharField(_('PO number'), max_length=100, null=True, blank=True)
    vendor = models.CharField(_('vendor'), max_length=255, null=True, blank=True)
    invoice_number = models.CharField(_('invoice number'), max_length=100, null=True, blank=True)
    
    # Warranty
    warranty_start_date = models.DateField(_('warranty start date'), null=True, blank=True)
    warranty_expiry = models.DateField(_('warranty expiry'), null=True, blank=True)
    warranty_provider = models.CharField(_('warranty provider'), max_length=255, null=True, blank=True)
    warranty_notes = models.TextField(_('warranty notes'), null=True, blank=True)
    
    # Depreciation
    class DepreciationMethod(models.TextChoices):
        STRAIGHT_LINE = 'straight_line', _('Straight Line')
        REDUCING_BALANCE = 'reducing_balance', _('Reducing Balance')
        NO_DEPRECIATION = 'no_depreciation', _('No Depreciation')

    depreciation_method = models.CharField(
        _('depreciation method'),
        max_length=30,
        choices=DepreciationMethod.choices,
        default=DepreciationMethod.STRAIGHT_LINE,
        db_index=True
    )
    useful_life_years = models.DecimalField(
        _('useful life years'),
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Expected useful life in years'),
        validators=[MinValueValidator(0)]
    )
    salvage_value = models.DecimalField(
        _('salvage value'),
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Estimated residual value at end of useful life'),
        validators=[MinValueValidator(0)]
    )
    current_value = models.DecimalField(
        _('current value'),
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)]
    )
    depreciation_rate = models.DecimalField(
        _('depreciation rate'),
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Annual depreciation rate in percentage')
    )
    accumulated_depreciation = models.DecimalField(
        _('accumulated depreciation'),
        max_digits=15,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)]
    )
    
    # Status and Condition
    status = models.CharField(
        _('status'),
        max_length=30,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True
    )
    condition = models.CharField(
        _('condition'),
        max_length=20,
        choices=Condition.choices,
        default=Condition.GOOD,
        db_index=True
    )
    
    # AMC (Annual Maintenance Contract)
    amc_enabled = models.BooleanField(_('AMC enabled'), default=False)
    amc_provider = models.CharField(_('AMC provider'), max_length=255, null=True, blank=True)
    amc_start_date = models.DateField(_('AMC start date'), null=True, blank=True)
    amc_end_date = models.DateField(_('AMC end date'), null=True, blank=True)
    amc_cost = models.DecimalField(
        _('AMC cost'),
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)]
    )
    
    # Quantity (for bulk items)
    quantity = models.IntegerField(_('quantity'), default=1, validators=[MinValueValidator(1)])
    
    # Additional Information
    expiry_date = models.DateField(_('expiry date'), null=True, blank=True)
    notes = models.TextField(_('notes'), null=True, blank=True)
    metadata = models.JSONField(_('metadata'), default=dict, null=True, blank=True)
    
    # Attachments
    image = models.ImageField(_('image'), upload_to='asset_images/', null=True, blank=True)
    documents = models.JSONField(_('documents'), default=list, null=True, blank=True)

    class Meta:
        db_table = 'assets'
        verbose_name = _('asset')
        verbose_name_plural = _('assets')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['asset_code']),
            models.Index(fields=['barcode']),
            models.Index(fields=['qr_code']),
            models.Index(fields=['rfid']),
            models.Index(fields=['serial_number']),
            models.Index(fields=['status']),
            models.Index(fields=['condition']),
            models.Index(fields=['property']),
            models.Index(fields=['department']),
            models.Index(fields=['category']),
            models.Index(fields=['item_type']),
            models.Index(fields=['owner']),
            models.Index(fields=['is_active']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(quantity__gte=1),
                name='check_quantity_positive'
            ),
        ]

    def __str__(self):
        return f"{self.asset_code} - {self.name}"

    def calculate_depreciation(self):
        """Calculate accumulated depreciation based on method, life, and dates."""
        if not self.purchase_date or not self.purchase_cost:
            return 0
        if self.depreciation_method == self.DepreciationMethod.NO_DEPRECIATION:
            return 0

        from datetime import date
        years = max(0, (date.today() - self.purchase_date).days / 365.25)
        purchase_cost = float(self.purchase_cost)
        salvage = float(self.salvage_value or 0)
        depreciable_base = max(0, purchase_cost - salvage)

        if self.depreciation_method == self.DepreciationMethod.STRAIGHT_LINE and self.useful_life_years:
            life = float(self.useful_life_years)
            if life > 0:
                annual = depreciable_base / life
                return min(depreciable_base, annual * years)

        if self.depreciation_method == self.DepreciationMethod.REDUCING_BALANCE:
            rate = float(self.depreciation_rate or 0) / 100
            if rate > 0:
                depreciation = purchase_cost * (1 - (1 - rate) ** years)
                return max(0, min(depreciable_base, depreciation))

        # Fallback: rate-based annual percentage over elapsed years
        rate = float(self.depreciation_rate or 0)
        if rate > 0:
            depreciation = purchase_cost * (rate / 100) * years
            return min(depreciable_base, depreciation)
        return 0

    def get_current_value(self):
        """Get the current value after depreciation."""
        if self.purchase_cost:
            return max(0, self.purchase_cost - self.accumulated_depreciation)
        return 0

    def annual_depreciation_value(self):
        """Get the annual depreciation amount for the chosen method."""
        if not self.purchase_cost or self.depreciation_method == self.DepreciationMethod.NO_DEPRECIATION:
            return 0
        purchase_cost = float(self.purchase_cost)
        salvage = float(self.salvage_value or 0)
        depreciable_base = max(0, purchase_cost - salvage)
        if self.depreciation_method == self.DepreciationMethod.STRAIGHT_LINE and self.useful_life_years:
            life = float(self.useful_life_years)
            if life > 0:
                return depreciable_base / life
        if self.depreciation_method == self.DepreciationMethod.REDUCING_BALANCE:
            rate = float(self.depreciation_rate or 0) / 100
            if rate > 0:
                return purchase_cost * rate
        rate = float(self.depreciation_rate or 0) / 100
        return purchase_cost * rate

    def is_under_warranty(self):
        """Check if asset is still under warranty."""
        if not self.warranty_expiry:
            return False
        from datetime import date
        return date.today() <= self.warranty_expiry

    def is_amc_active(self):
        """Check if AMC is currently active."""
        if not self.amc_enabled or not self.amc_start_date or not self.amc_end_date:
            return False
        from datetime import date
        return self.amc_start_date <= date.today() <= self.amc_end_date


class AssetAttachment(BaseModel):
    """
    Attachments for assets (documents, images, etc.).
    """
    asset = models.ForeignKey(
        Asset,
        on_delete=models.CASCADE,
        related_name='attachments',
        verbose_name=_('asset')
    )
    file = models.FileField(_('file'), upload_to='asset_attachments/')
    file_name = models.CharField(_('file name'), max_length=255)
    file_type = models.CharField(_('file type'), max_length=100)
    file_size = models.IntegerField(_('file size'))
    description = models.TextField(_('description'), null=True, blank=True)
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_attachments',
        verbose_name=_('uploaded by')
    )

    class Meta:
        db_table = 'asset_attachments'
        verbose_name = _('asset attachment')
        verbose_name_plural = _('asset attachments')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['asset']),
        ]

    def __str__(self):
        return f"{self.asset.asset_code} - {self.file_name}"


class AssetTransfer(BaseModel):
    """
    Asset transfer request tracking asset movement between departments,
    properties, and owners.
    """
    class Status(models.TextChoices):
        PENDING = 'pending', _('Pending')
        APPROVED = 'approved', _('Approved')
        REJECTED = 'rejected', _('Rejected')
        COMPLETED = 'completed', _('Completed')
        CANCELLED = 'cancelled', _('Cancelled')

    transfer_code = models.CharField(_('transfer code'), max_length=50, unique=True, db_index=True)

    # Asset being transferred
    asset = models.ForeignKey(
        Asset,
        on_delete=models.CASCADE,
        related_name='transfers',
        verbose_name=_('asset')
    )

    # From (snapshot at request time)
    from_department = models.CharField(_('from department'), max_length=255, blank=True, default='')
    from_owner = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='asset_transfers_from',
        verbose_name=_('from owner')
    )
    from_owner_name = models.CharField(_('from owner name'), max_length=255, null=True, blank=True)
    from_owner_email = models.EmailField(_('from owner email'), max_length=255, null=True, blank=True)
    from_property = models.ForeignKey(
        Property,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='asset_transfers_from',
        verbose_name=_('from property')
    )
    from_property_name = models.CharField(_('from property name'), max_length=255, null=True, blank=True)
    from_location = models.CharField(_('from location'), max_length=255, null=True, blank=True)

    # To (requested destination)
    to_department = models.CharField(_('to department'), max_length=255, null=True, blank=True)
    to_owner = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='asset_transfers_to',
        verbose_name=_('to owner')
    )
    to_owner_name = models.CharField(_('to owner name'), max_length=255, null=True, blank=True)
    to_owner_email = models.EmailField(_('to owner email'), max_length=255, null=True, blank=True)
    to_property = models.ForeignKey(
        Property,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='asset_transfers_to',
        verbose_name=_('to property')
    )
    to_property_name = models.CharField(_('to property name'), max_length=255, null=True, blank=True)
    to_location = models.CharField(_('to location'), max_length=255, null=True, blank=True)

    reason = models.TextField(_('reason'))
    notes = models.TextField(_('notes'), null=True, blank=True)
    quantity = models.IntegerField(_('quantity'), default=1, validators=[MinValueValidator(1)])

    status = models.CharField(
        _('status'),
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True
    )

    # Request metadata
    requested_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='asset_transfers_requested',
        verbose_name=_('requested by')
    )
    requested_by_name = models.CharField(_('requested by name'), max_length=255, null=True, blank=True)
    requested_by_email = models.EmailField(_('requested by email'), max_length=255, null=True, blank=True)
    requested_at = models.DateTimeField(_('requested at'), auto_now_add=True)

    # Approval metadata
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='asset_transfers_approved',
        verbose_name=_('approved by')
    )
    approved_by_name = models.CharField(_('approved by name'), max_length=255, null=True, blank=True)
    approved_at = models.DateTimeField(_('approved at'), null=True, blank=True)

    # Completion metadata
    completed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='asset_transfers_completed',
        verbose_name=_('completed by')
    )
    completed_by_name = models.CharField(_('completed by name'), max_length=255, null=True, blank=True)
    completed_at = models.DateTimeField(_('completed at'), null=True, blank=True)

    # Rejection / cancellation
    rejection_reason = models.TextField(_('rejection reason'), null=True, blank=True)
    cancelled_at = models.DateTimeField(_('cancelled at'), null=True, blank=True)

    class Meta:
        db_table = 'asset_transfers'
        verbose_name = _('asset transfer')
        verbose_name_plural = _('asset transfers')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['transfer_code']),
            models.Index(fields=['status']),
            models.Index(fields=['asset']),
        ]

    def __str__(self):
        return f"{self.transfer_code} - {self.asset.asset_code}"

    @property
    def status_display(self):
        return self.get_status_display()
