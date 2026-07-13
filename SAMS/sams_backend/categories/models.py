"""
Category and Item Type models for asset classification.
"""
from django.utils.translation import gettext_lazy as _
from django.db import models
from core.models import BaseModel


class Category(BaseModel):
    """
    Category model for asset categorization.
    """
    name = models.CharField(_('name'), max_length=255, unique=True, db_index=True)
    code = models.CharField(_('code'), max_length=50, unique=True, db_index=True)
    description = models.TextField(_('description'), null=True, blank=True)
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children',
        verbose_name=_('parent category')
    )
    icon = models.CharField(_('icon'), max_length=50, null=True, blank=True)
    color = models.CharField(_('color'), max_length=7, null=True, blank=True)  # Hex color

    class Meta:
        db_table = 'categories'
        verbose_name = _('category')
        verbose_name_plural = _('categories')
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['code']),
            models.Index(fields=['parent']),
        ]

    def __str__(self):
        return self.name


class ItemType(BaseModel):
    """
    Item type model for asset types.
    """
    name = models.CharField(_('name'), max_length=255, unique=True, db_index=True)
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='item_types',
        verbose_name=_('category')
    )
    description = models.TextField(_('description'), null=True, blank=True)
    default_depreciation_rate = models.DecimalField(
        _('default depreciation rate'),
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Annual depreciation rate in percentage')
    )
    default_warranty_period = models.IntegerField(
        _('default warranty period'),
        null=True,
        blank=True,
        help_text=_('Warranty period in months')
    )

    class Meta:
        db_table = 'item_types'
        verbose_name = _('item type')
        verbose_name_plural = _('item types')
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['category']),
        ]

    def __str__(self):
        return self.name
