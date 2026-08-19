"""
Department model for organizational structure.

The Department model is the authoritative master for all department data in the
system.  The code field is the stable business identifier; the hierarchy is
expressed via parent FK, level (0 = top-level), and sort_order (official
display order within the parent).
"""
from django.utils.translation import gettext_lazy as _
from django.db import models
from core.models import BaseModel
from authentication.models import User


class Department(BaseModel):
    """
    Department model for organizing assets, employees and users.

    Fields:
        name         – Official department name (unique).
        code         – Stable business identifier (unique, indexed).
        description  – Optional description.
        parent       – FK to parent department (null for top-level).
        level        – Hierarchy depth: 0 = top-level, 1 = sub-dept, 2 = sub-sub-dept.
        sort_order   – Integer controlling display order within the parent.
        head         – Optional department head (User FK).
        location     – Optional physical location.
        contact_email / contact_phone – Optional contact info.
    """
    name = models.CharField(_('name'), max_length=255, db_index=True)
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
    level = models.PositiveSmallIntegerField(
        _('hierarchy level'),
        default=0,
        help_text=_('0 = top-level, 1 = sub-department, 2 = sub-sub-department'),
    )
    sort_order = models.IntegerField(
        _('sort order'),
        default=0,
        help_text=_('Controls display order within the parent.'),
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
        ordering = ['sort_order', 'name']
        unique_together = [['parent', 'name']]
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['code']),
            models.Index(fields=['parent']),
            models.Index(fields=['level']),
            models.Index(fields=['sort_order']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.code} {self.name}" if self.code else self.name

    def get_hierarchy(self):
        """Get the full hierarchy path of this department."""
        parts = [self.name]
        parent = self.parent
        while parent:
            parts.insert(0, parent.name)
            parent = parent.parent
        return ' > '.join(parts)

    @property
    def children_count(self):
        return self.children.filter(is_active=True).count()

    def get_descendants(self, include_self=False):
        """Return all descendant departments (recursive)."""
        descendants = Department.objects.none()
        children = self.children.filter(is_active=True)
        if include_self:
            descendants = Department.objects.filter(pk=self.pk)
        return descendants | children | Department.objects.filter(
            parent__in=list(children.values_list('pk', flat=True)),
            is_active=True,
        )
