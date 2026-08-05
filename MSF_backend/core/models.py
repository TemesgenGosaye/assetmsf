"""
Base Model and shared model utilities.
"""
import uuid

from django.conf import settings
from django.db import models


class BaseModel(models.Model):
    """
    Abstract base model with common fields for all models.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(class)s_created",
        verbose_name="Created By",
    )

    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(class)s_updated",
        verbose_name="Updated By",
    )

    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        abstract = True
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["created_at"]),
            models.Index(fields=["updated_at"]),
            models.Index(fields=["is_active"]),
        ]

    def soft_delete(self, user=None):
        self.is_active = False
        if user:
            self.updated_by = user
        self.save(update_fields=["is_active", "updated_by", "updated_at"])

    def restore(self, user=None):
        self.is_active = True
        if user:
            self.updated_by = user
        self.save(update_fields=["is_active", "updated_by", "updated_at"])