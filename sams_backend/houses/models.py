"""
House model – tracks individual housing units.
"""
import os
from django.utils.translation import gettext_lazy as _
from django.db import models
from core.models import BaseModel
from django.conf import settings


def application_document_path(instance, filename):
    ext = filename.split('.')[-1] if '.' in filename else ''
    return os.path.join(
        'house_applications',
        f'app_{instance.application_no or "new"}_{instance.requester_id}_.{ext}'
    )


class House(BaseModel):
    """
    Represents a physical housing unit available for staff allocation.
    HID is auto-generated (HID-0001 format).
    """

    class HouseType(models.TextChoices):
        STAFF    = "Staff",   _("Staff")
        TYPE_A   = "A",       _("Type A")
        TYPE_B   = "B",       _("Type B")
        TYPE_C   = "C",       _("Type C")
        TYPE_D   = "D",       _("Type D")
        TYPE_E   = "E",       _("Type E (Barrack)")

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

    # Damage assessment (only relevant when status == Inactive)
    damaged_door    = models.BooleanField(_("damaged door"),    default=False)
    damaged_windows = models.BooleanField(_("damaged windows"), default=False)
    damaged_walls   = models.BooleanField(_("damaged walls"),   default=False)
    damaged_switch  = models.BooleanField(_("damaged switch"),  default=False)
    damaged_bulb    = models.BooleanField(_("damaged bulb"),    default=False)
    damaged_water   = models.BooleanField(_("damaged water"),   default=False)

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
                    num = 9
            else:
                num = 9
            self.house_id = f"HID-{num:04d}"
        super().save(*args, **kwargs)


class HouseApplication(BaseModel):
    """
    Represents a house allocation application submitted by a requester.
    """

    class Gender(models.TextChoices):
        MALE   = "Male",   _("Male")
        FEMALE = "Female", _("Female")

    class MaritalStatus(models.TextChoices):
        SINGLE   = "Single",   _("Single")
        MARRIED  = "Married",  _("Married")
        DIVORCED = "Divorced", _("Divorced")
        WIDOWED  = "Widowed",  _("Widowed")

    class Status(models.TextChoices):
        DRAFT                  = "Draft",                  _("Draft")
        SUBMITTED              = "Submitted",              _("Submitted")
        UNDER_REVIEW           = "Under Review",           _("Under Review")
        VERIFIED               = "Verified",               _("Verified")
        WAITING_FOR_ALLOCATION = "Waiting for Allocation", _("Waiting for Allocation")
        ALLOCATED              = "Allocated",              _("Allocated")
        REJECTED               = "Rejected",               _("Rejected")
        RETURNED               = "Returned",               _("Returned")

    application_no = models.CharField(
        _("application number"),
        max_length=20,
        unique=True,
        blank=True,
        db_index=True,
    )

    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="house_applications",
        verbose_name=_("requester"),
    )

    employee_id = models.CharField(
        _("employee ID"),
        max_length=50,
    )

    employee_name = models.CharField(
        _("employee name"),
        max_length=255,
    )

    national_id = models.CharField(
        _("national ID"),
        max_length=50,
        unique=True,
        db_index=True,
    )

    gender = models.CharField(
        _("gender"),
        max_length=10,
        choices=Gender.choices,
    )

    job_position = models.CharField(
        _("job position"),
        max_length=255,
    )

    job_grade = models.CharField(
        _("job grade"),
        max_length=50,
        blank=True,
    )

    years_of_service = models.IntegerField(
        _("years of service"),
        default=0,
    )

    marital_status = models.CharField(
        _("marital status"),
        max_length=20,
        choices=MaritalStatus.choices,
        default=MaritalStatus.SINGLE,
    )

    has_disability = models.BooleanField(
        _("has disability"),
        default=False,
    )

    family_size = models.PositiveIntegerField(
        _("family size"),
        default=1,
    )

    number_of_children = models.PositiveIntegerField(
        _("number of children"),
        default=0,
    )

    requested_house_category = models.CharField(
        _("requested house category"),
        max_length=10,
        choices=House.HouseType.choices,
        default=House.HouseType.STAFF,
    )

    reason_for_request = models.TextField(
        _("reason for request"),
        blank=True,
    )

    preferred_location = models.CharField(
        _("preferred location"),
        max_length=255,
        blank=True,
    )

    supporting_document = models.FileField(
        _("supporting document"),
        upload_to=application_document_path,
        null=True,
        blank=True,
    )

    status = models.CharField(
        _("status"),
        max_length=30,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )

    submitted_at = models.DateTimeField(
        _("submitted at"),
        null=True,
        blank=True,
    )

    reviewed_at = models.DateTimeField(
        _("reviewed at"),
        null=True,
        blank=True,
    )

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_applications",
        verbose_name=_("reviewed by"),
    )

    rejection_reason = models.TextField(
        _("rejection reason"),
        blank=True,
    )

    returned_reason = models.TextField(
        _("returned reason"),
        blank=True,
    )

    class Meta:
        db_table = "house_applications"
        verbose_name = _("house application")
        verbose_name_plural = _("house applications")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["application_no"]),
            models.Index(fields=["national_id"]),
            models.Index(fields=["status"]),
            models.Index(fields=["requester"]),
        ]

    def __str__(self):
        return f"{self.application_no} – {self.employee_name} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.application_no:
            last = (
                HouseApplication.objects.filter(application_no__startswith="HAPP-")
                .order_by("-application_no")
                .first()
            )
            if last:
                try:
                    num = int(last.application_no.split("-")[1]) + 1
                except (IndexError, ValueError):
                    num = 1
            else:
                num = 1
            self.application_no = f"HAPP-{num:04d}"
        super().save(*args, **kwargs)
