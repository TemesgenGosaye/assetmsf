"""
House model – tracks individual housing units, allocation queue, and scoring.
"""

import os

from core.models import BaseModel
from django.conf import settings
from django.db import models, transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


def application_document_path(instance, filename):
    ext = filename.split(".")[-1] if "." in filename else ""
    return os.path.join(
        "house_applications",
        f"app_{instance.application_no or 'new'}_{instance.requester_id}_.{ext}",
    )


# ── Job Grade → Eligible House Category mapping ──────────────────────
GRADE_CATEGORY_MAP = {
    (1, 5): "E",
    (6, 9): "D",
    (10, 12): "C",
    (13, 15): "A",
}


def get_eligible_category(job_grade: str) -> str:
    """Determine eligible house category from job grade string."""
    try:
        grade = int(str(job_grade).strip())
    except (ValueError, TypeError):
        return "E"
    for (lo, hi), cat in GRADE_CATEGORY_MAP.items():
        if lo <= grade <= hi:
            return cat
    return "Staff" if grade > 15 else "E"


class House(BaseModel):
    """
    Represents a physical housing unit available for staff allocation.
    HID is auto-generated in the 90-000-00 format.
    """

    class HouseType(models.TextChoices):
        STAFF = "Staff", _("Staff")
        TYPE_A = "A", _("Type A")
        TYPE_B = "B", _("Type B")
        TYPE_C = "C", _("Type C")
        TYPE_D = "D", _("Type D")
        TYPE_E = "E", _("Type E (Barrack)")

    class Status(models.TextChoices):
        ACTIVE = "Active", _("Active")
        INACTIVE = "Inactive", _("Inactive")

    # Auto-generated human-readable ID e.g. 90-000-00
    house_id = models.CharField(
        _("house ID"),
        max_length=20,
        unique=True,
        blank=True,
        db_index=True,
    )

    # Auto-generated per-type sequential number e.g. A1, A2, B1, Staff1
    house_number = models.CharField(
        _("house number"),
        max_length=20,
        unique=True,
        blank=True,
        db_index=True,
        help_text=_("Auto-generated sequential number per house type, e.g. A1, B3, Staff2."),
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
    damaged_door = models.BooleanField(_("damaged door"), default=False)
    damaged_windows = models.BooleanField(_("damaged windows"), default=False)
    damaged_walls = models.BooleanField(_("damaged walls"), default=False)
    damaged_switch = models.BooleanField(_("damaged switch"), default=False)
    damaged_bulb = models.BooleanField(_("damaged bulb"), default=False)
    damaged_water = models.BooleanField(_("damaged water"), default=False)

    # Optional extra fields
    inside_items = models.JSONField(
        _("inside items"),
        default=list,
        blank=True,
        help_text=_("List of inside items for the house, e.g., Bed, Chair.")
    )
    description = models.TextField(_("description"), blank=True, default="")
    class AllocationCategory(models.TextChoices):
        REGULAR = "R", _("Regular")
        GUEST = "G", _("Guest")

    capacity = models.PositiveSmallIntegerField(
        _("capacity"),
        default=1,
        help_text=_("Maximum number of residents this unit can hold."),
    )

    allocation_category = models.CharField(
        _("allocation category"),
        max_length=1,
        choices=AllocationCategory.choices,
        default=AllocationCategory.REGULAR,
        db_index=True,
        help_text=_("R = Regular, G = Guest."),
    )

    class Meta:
        db_table = "houses"
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
    # Auto-generate house_id and house_number before first save
    # ------------------------------------------------------------------
    def save(self, *args, **kwargs):
        if not self.house_id or not self.house_number:
            # transaction.atomic() + select_for_update() together create a
            # serialisable isolation boundary.  If two concurrent requests
            # try to create "A3" at the same time, the second one will
            # block at select_for_update() until the first commits, then
            # re-read the refreshed row and correctly see "A3" already
            # taken, producing "A4" instead.
            with transaction.atomic():
                # ----------------------------------------------------------
                # 1) house_id  –  format 90-NNN-00
                # ----------------------------------------------------------
                if not self.house_id:
                    # Lock + read the row with the highest existing ID so
                    # no other transaction can slip in between our read
                    # and write.
                    last = (
                        House.objects
                        .select_for_update()
                        .filter(house_id__regex=r"^90-\d{3}-00$")
                        .order_by("-house_id")
                        .first()
                    )
                    if last:
                        try:
                            # "90-005-00".split("-") → ["90", "005", "00"]
                            # Take index [1] → "005", int("005") → 5, +1 → 6
                            seq = int(last.house_id.split("-")[1]) + 1
                        except (IndexError, ValueError):
                            seq = 0
                    else:
                        seq = 0
                    # :03d pads to 3 digits → "000", "001", …, "099", "100"
                    self.house_id = f"90-{seq:03d}-00"

                # ----------------------------------------------------------
                # 2) house_number  –  prefix + sequential int  (e.g. A1, B3, S1)
                # ----------------------------------------------------------
                if not self.house_number:
                    HOUSE_NUMBER_PREFIX = {
                        "Staff": "S",
                        "A": "A",
                        "B": "B",
                        "C": "C",
                        "D": "D",
                        "E": "E",
                    }
                    prefix = HOUSE_NUMBER_PREFIX.get(self.house_type, self.house_type[0])

                    # Lock every row whose house_number starts with this
                    # prefix so the read → increment → write is atomic.
                    #   house_number__regex=^A\d+$  matches  A1, A2, A12
                    #   but NOT  A  alone or  AB3  (wrong prefix).
                    existing_numbers = list(
                        House.objects
                        .select_for_update()
                        .filter(house_number__regex=rf"^{prefix}\d+$")
                        .values_list("house_number", flat=True)
                    )
                    if existing_numbers:
                        # Sort numerically, not alphabetically
                        nums = []
                        for hn in existing_numbers:
                            try:
                                nums.append(int(hn[len(prefix):]))
                            except ValueError:
                                pass
                        seq = max(nums) + 1 if nums else 1
                    else:
                        # First record for this prefix → start at 1.
                        seq = 1

                    self.house_number = f"{prefix}{seq}"

            super().save(*args, **kwargs)
        else:
            super().save(*args, **kwargs)

class HouseApplication(BaseModel):
    """
    Represents a house allocation application submitted by a requester.
    """

    class Gender(models.TextChoices):
        MALE = "Male", _("Male")
        FEMALE = "Female", _("Female")

    class MaritalStatus(models.TextChoices):
        SINGLE = "Single", _("Single")
        MARRIED = "Married", _("Married")
        DIVORCED = "Divorced", _("Divorced")
        WIDOWED = "Widowed", _("Widowed")

    class PositionType(models.TextChoices):
        PERMANENT = "Permanent", _("Permanent")
        SEASONAL = "Seasonal", _("Seasonal")
        HALF_PERMANENT = "Half Permanent", _("Half Permanent")
        PPL = "PPL", _("PPL")

    class Status(models.TextChoices):
        DRAFT = "Draft", _("Draft")
        SUBMITTED = "Submitted", _("Submitted")
        UNDER_REVIEW = "Under Review", _("Under Review")
        VERIFIED = "Verified", _("Verified")
        WAITING_FOR_ALLOCATION = "Waiting for Allocation", _("Waiting for Allocation")
        ALLOCATED = "Allocated", _("Allocated")
        REJECTED = "Rejected", _("Rejected")
        RETURNED = "Returned", _("Returned")

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

    job_type = models.CharField(
        _("job type"),
        max_length=20,
        choices=[
            ("Permanent", _("Permanent")),
            ("Semi Permanent", _("Semi Permanent")),
            ("Seasonal", _("Seasonal")),
        ],
        default="Permanent",
        blank=True,
    )

    position_type = models.CharField(
        _("position type"),
        max_length=20,
        choices=PositionType.choices,
        default=PositionType.PERMANENT,
        blank=True,
        help_text=_("Employment type: Permanent, Seasonal, Half Permanent, or PPL."),
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

    eligible_house_category = models.CharField(
        _("eligible house category"),
        max_length=10,
        choices=House.HouseType.choices,
        blank=True,
        help_text=_("Auto-determined from job grade."),
    )

    priority_score = models.DecimalField(
        _("priority score"),
        max_digits=8,
        decimal_places=2,
        default=0,
        db_index=True,
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

    allocated_house = models.ForeignKey(
        House,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="allocations",
        verbose_name=_("allocated house"),
    )

    allocated_at = models.DateTimeField(
        _("allocated at"),
        null=True,
        blank=True,
    )

    allocated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="allocated_applications",
        verbose_name=_("allocated by"),
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
            models.Index(fields=["priority_score"]),
            models.Index(fields=["eligible_house_category"]),
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
        # Auto-determine eligible category from job grade
        if self.job_grade and not self.eligible_house_category:
            self.eligible_house_category = get_eligible_category(self.job_grade)
        super().save(*args, **kwargs)


class ScoringConfig(BaseModel):
    """
    Configurable scoring weights for the house allocation priority engine.
    Only one active record should exist at a time.
    """

    name = models.CharField(
        _("configuration name"),
        max_length=100,
        default="Default",
    )

    job_grade_weight = models.DecimalField(
        _("job grade weight"),
        max_digits=5,
        decimal_places=2,
        default=30,
        help_text=_("Weight for job grade scoring (0-100)."),
    )

    years_of_service_weight = models.DecimalField(
        _("years of service weight"),
        max_digits=5,
        decimal_places=2,
        default=25,
        help_text=_("Weight for years of service scoring (0-100)."),
    )

    family_size_weight = models.DecimalField(
        _("family size weight"),
        max_digits=5,
        decimal_places=2,
        default=20,
        help_text=_("Weight for family size scoring (0-100)."),
    )

    disability_weight = models.DecimalField(
        _("disability weight"),
        max_digits=5,
        decimal_places=2,
        default=15,
        help_text=_("Weight for disability status scoring (0-100)."),
    )

    fifo_weight = models.DecimalField(
        _("FIFO weight"),
        max_digits=5,
        decimal_places=2,
        default=10,
        help_text=_("Weight for application date (FIFO) scoring (0-100)."),
    )

    is_active = models.BooleanField(
        _("is active"),
        default=True,
        db_index=True,
    )

    class Meta:
        db_table = "scoring_config"
        verbose_name = _("scoring configuration")
        verbose_name_plural = _("scoring configurations")
        ordering = ["-created_at"]

    def __str__(self):
        return f"Scoring Config: {self.name} (active={self.is_active})"

    @property
    def total_weight(self):
        return (
            self.job_grade_weight
            + self.years_of_service_weight
            + self.family_size_weight
            + self.disability_weight
            + self.fifo_weight
        )

    def save(self, *args, **kwargs):
        # Enforce single active config: deactivate all others when activating
        if self.is_active:
            ScoringConfig.objects.filter(is_active=True).exclude(pk=self.pk).update(is_active=False)
        super().save(*args, **kwargs)


class AllocationLog(BaseModel):
    """
    Audit trail for house allocations. Records every automatic or manual allocation.
    """

    application = models.ForeignKey(
        HouseApplication,
        on_delete=models.CASCADE,
        related_name="allocation_logs",
        verbose_name=_("application"),
    )

    house = models.ForeignKey(
        House,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="allocation_logs",
        verbose_name=_("house"),
    )

    action = models.CharField(
        _("action"),
        max_length=30,
        choices=[
            ("auto_allocated", _("Auto Allocated")),
            ("manual_allocated", _("Manual Allocated")),
            ("deallocated", _("Deallocated")),
            ("reallocated", _("Reallocated")),
        ],
    )

    priority_score = models.DecimalField(
        _("priority score at time of action"),
        max_digits=8,
        decimal_places=2,
        default=0,
    )

    eligible_category = models.CharField(
        _("eligible category at time of action"),
        max_length=10,
        blank=True,
    )

    notes = models.TextField(
        _("notes"),
        blank=True,
    )

    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name=_("performed by"),
    )

    class Meta:
        db_table = "allocation_logs"
        verbose_name = _("allocation log")
        verbose_name_plural = _("allocation logs")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["application"]),
            models.Index(fields=["house"]),
            models.Index(fields=["action"]),
        ]

    def __str__(self):
        return f"{self.action} – {self.application.application_no} ({self.created_at})"


class HouseInspection(BaseModel):
    """Tracks physical property inspections for housing units."""

    class InspectionType(models.TextChoices):
        MOVE_IN = "Move-In", _("Move-In")
        MOVE_OUT = "Move-Out", _("Move-Out")
        ROUTINE = "Routine", _("Routine")
        DAMAGE = "Damage Assessment", _("Damage Assessment")

    class Status(models.TextChoices):
        PASSED = "Passed", _("Passed")
        NEEDS_REPAIR = "Needs Repair", _("Needs Repair")
        FAILED = "Failed", _("Failed")

    house = models.ForeignKey(
        House,
        on_delete=models.CASCADE,
        related_name="inspections",
        verbose_name=_("house"),
    )
    inspector = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name=_("inspector"),
    )
    inspection_date = models.DateField(_("inspection date"), default=timezone.now)
    inspection_type = models.CharField(
        _("type"),
        max_length=30,
        choices=InspectionType.choices,
        default=InspectionType.ROUTINE,
    )
    status = models.CharField(
        _("status"),
        max_length=20,
        choices=Status.choices,
        default=Status.PASSED,
    )
    findings = models.JSONField(_("findings"), default=dict, blank=True)
    notes = models.TextField(_("notes"), blank=True)

    class Meta:
        db_table = "house_inspections"
        verbose_name = _("house inspection")
        verbose_name_plural = _("house inspections")
        ordering = ["-inspection_date"]

    def __str__(self):
        return f"{self.house.house_id} – {self.inspection_type} ({self.inspection_date})"


class HouseMaintenanceRequest(BaseModel):
    """Tracks housing maintenance issues and repair requests."""

    class Category(models.TextChoices):
        PLUMBING = "Plumbing", _("Plumbing")
        ELECTRICAL = "Electrical", _("Electrical")
        STRUCTURAL = "Structural", _("Structural")
        APPLIANCE = "Appliance", _("Appliance")
        HVAC = "HVAC", _("HVAC")
        OTHER = "Other", _("Other")

    class Priority(models.TextChoices):
        LOW = "Low", _("Low")
        MEDIUM = "Medium", _("Medium")
        HIGH = "High", _("High")
        URGENT = "Urgent", _("Urgent")

    class Status(models.TextChoices):
        OPEN = "Open", _("Open")
        IN_PROGRESS = "In Progress", _("In Progress")
        RESOLVED = "Resolved", _("Resolved")
        CANCELLED = "Cancelled", _("Cancelled")

    house = models.ForeignKey(
        House,
        on_delete=models.CASCADE,
        related_name="maintenance_requests",
        verbose_name=_("house"),
    )
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name=_("reported by"),
    )
    issue_title = models.CharField(_("issue title"), max_length=255)
    category = models.CharField(
        _("category"),
        max_length=30,
        choices=Category.choices,
        default=Category.OTHER,
    )
    priority = models.CharField(
        _("priority"),
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    status = models.CharField(
        _("status"),
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
    )
    estimated_cost = models.DecimalField(
        _("estimated cost"),
        max_digits=10,
        decimal_places=2,
        default=0,
    )
    description = models.TextField(_("description"), blank=True)
    resolved_at = models.DateTimeField(_("resolved at"), null=True, blank=True)

    class Meta:
        db_table = "house_maintenance_requests"
        verbose_name = _("house maintenance request")
        verbose_name_plural = _("house maintenance requests")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.house.house_id} – {self.issue_title} ({self.status})"


class HouseTransfer(BaseModel):
    """Tracks relocation/transfer requests between housing units."""

    class Status(models.TextChoices):
        PENDING = "Pending", _("Pending")
        APPROVED = "Approved", _("Approved")
        REJECTED = "Rejected", _("Rejected")
        COMPLETED = "Completed", _("Completed")

    transfer_no = models.CharField(_("transfer number"), max_length=20, unique=True, blank=True)
    employee_id = models.CharField(_("employee ID"), max_length=50)
    employee_name = models.CharField(_("employee name"), max_length=255)
    current_house = models.ForeignKey(
        House,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transfers_from",
        verbose_name=_("current house"),
    )
    target_house = models.ForeignKey(
        House,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transfers_to",
        verbose_name=_("target house"),
    )
    reason = models.TextField(_("reason for transfer"), blank=True)
    priority_score = models.DecimalField(_("priority score"), max_digits=8, decimal_places=2, default=0)
    status = models.CharField(_("status"), max_length=20, choices=Status.choices, default=Status.PENDING)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_transfers",
        verbose_name=_("approved by"),
    )
    completed_at = models.DateTimeField(_("completed at"), null=True, blank=True)

    class Meta:
        db_table = "house_transfers"
        verbose_name = _("house transfer")
        verbose_name_plural = _("house transfers")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.transfer_no} – {self.employee_name} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.transfer_no:
            last = HouseTransfer.objects.order_by("-created_at").first()
            num = HouseTransfer.objects.count() + 1
            self.transfer_no = f"TRF-{num:04d}"
        super().save(*args, **kwargs)


class HouseNotification(BaseModel):
    """In-app notifications for house allocation updates and alerts."""

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="house_notifications",
        verbose_name=_("recipient"),
    )
    title = models.CharField(_("title"), max_length=255)
    message = models.TextField(_("message"))
    notification_type = models.CharField(_("type"), max_length=50, default="info")
    is_read = models.BooleanField(_("is read"), default=False)
    link = models.CharField(_("link"), max_length=255, blank=True, default="")

    class Meta:
        db_table = "house_notifications"
        verbose_name = _("house notification")
        verbose_name_plural = _("house notifications")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.recipient.username} – {self.title}"
