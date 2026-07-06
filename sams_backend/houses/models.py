"""
House model – tracks individual housing units.
"""
from django.utils.translation import gettext_lazy as _
from django.db import models
from core.models import BaseModel


class House(BaseModel):
    """
    Represents a physical housing unit available for staff allocation.
    HID is auto-generated (HID-0001 format).
    """

    class HouseType(models.TextChoices):
        STAFF  = "Staff",  _("Staff")
        TYPE_A = "A",      _("Type A")
        TYPE_B = "B",      _("Type B")
        TYPE_C = "C",      _("Type C")
        TYPE_D = "D",      _("Type D")

    class Status(models.TextChoices):
        ACTIVE   = "Active",   _("Active")
        INACTIVE = "Inactive", _("Inactive")

    # Auto-generated human-readable ID  e.g. HID-0001
    house_id = models.CharField(
        _("house ID"),
        max_length=20,
        unique=True,
        blank=True,
        db_index=True,
    )

    location = models.CharField(
        _("location"),
        max_length=255,
        db_index=True,
        help_text=_("Physical address or compound name of the house."),
    )

    house_type = models.CharField(
        _("type"),
        max_length=10,
        choices=HouseType.choices,
        default=HouseType.STAFF,
        db_index=True,
    )

    status = models.CharField(
        _("status"),
        max_length=10,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )

    # Optional extra fields
    description = models.TextField(_("description"), blank=True, default="")
    capacity     = models.PositiveSmallIntegerField(
        _("capacity"), default=1,
        help_text=_("Maximum number of residents this unit can hold.")
    )

    class Meta:
        db_table     = "houses"
        verbose_name = _("house")
        verbose_name_plural = _("houses")
        ordering = ["house_id"]
        indexes = [
            models.Index(fields=["house_id"]),
            models.Index(fields=["house_type"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.house_id} – {self.location} ({self.house_type})"

    # ------------------------------------------------------------------
    # Auto-generate house_id before first save
    # ------------------------------------------------------------------
    def save(self, *args, **kwargs):
        if not self.house_id:
            last = (
                House.objects.filter(house_id__startswith="HID-")
                .order_by("-house_id")
                .first()
            )
            if last:
                try:
                    num = int(last.house_id.split("-")[1]) + 1
                except (IndexError, ValueError):
                    num = 1
            else:
                num = 1
            self.house_id = f"HID-{num:04d}"
        super().save(*args, **kwargs)
