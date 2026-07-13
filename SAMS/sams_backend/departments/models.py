"""
Department model for organizational structure.
"""
from django.utils.translation import gettext_lazy as _
from django.db import models
from core.models import BaseModel
from authentication.models import User


class Department(BaseModel):
    """
    Department model for organizing assets and users.
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
        verbose_name=_('parent department')
    )
    head = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='headed_departments',
        verbose_name=_('department head')
    )
    location = models.CharField(_('location'), max_length=255, null=True, blank=True)
    contact_email = models.EmailField(_('contact email'), null=True, blank=True)
    contact_phone = models.CharField(_('contact phone'), max_length=20, null=True, blank=True)

    class Meta:
        db_table = 'departments'
        verbose_name = _('department')
        verbose_name_plural = _('departments')
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['code']),
            models.Index(fields=['parent']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return self.name

    def get_hierarchy(self):
        """Get the full hierarchy path of this department."""
        parts = [self.name]
        parent = self.parent
        while parent:
            parts.insert(0, parent.name)
            parent = parent.parent
        return ' > '.join(parts)
