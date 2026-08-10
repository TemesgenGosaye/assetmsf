"""
House models — tracks housing units, applications, allocations,
scoring configuration, eligibility rules, allocation logs,
inspections, maintenance, transfers, and rental billing.
"""

import os
import math
import datetime as _dt
from decimal import Decimal

from core.models import BaseModel
from django.conf import settings
from django.db import models, transaction
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
from employees.models import Employee

# Register the HouseNumberGenerator model with Django so its table is migrated.
from houses import numbering as _house_numbering  # noqa: F401  (also: from houses.numbering import HouseNumberGenerator)


# ── helper ────────────────────────────────────────────────────────────────
def application_document_path(instance, filename):
    ext = filename.split(".")[-1] if "." in filename else ""
    return os.path.join(
        "house_applications",
        f"app_{instance.application_no or 'new'}_{instance.requester_id}_.{ext}",
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  HOUSE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class House(BaseModel):
    """Physical housing unit available for staff allocation (HID 90-XXX-00)."""

    class HouseType(models.TextChoices):
        STAFF  = "Staff", _("Staff")
        TYPE_A = "A",     _("Type A")
        TYPE_B = "B",     _("Type B")
        TYPE_C = "C",     _("Type C")
        TYPE_D = "D",     _("Type D")
        TYPE_E = "E",     _("Type E (Barrack)")

    class Status(models.TextChoices):
        ACTIVE   = "Active",   _("Active")
        INACTIVE = "Inactive", _("Inactive")

    class AllocationCategory(models.TextChoices):
        REGULAR = "R", _("Regular")
        GUEST   = "G", _("Guest")

    house_id = models.CharField(_("house ID"), max_length=20, unique=True, blank=True, db_index=True)
    house_number = models.CharField(
        _("house number"),
        max_length=20,
        unique=True,
        blank=True,
        db_index=True,
        help_text=_("Auto-generated sequential number per house type, e.g. A1, B3, Staff2."),
    )
    location = models.CharField(_("location"), max_length=255, db_index=True)
    house_type = models.CharField(_("type"), max_length=10, choices=HouseType.choices, default=HouseType.STAFF, db_index=True)
    status = models.CharField(_("status"), max_length=10, choices=Status.choices, default=Status.ACTIVE, db_index=True)

    damaged_door    = models.BooleanField(_("damaged door"), default=False)
    damaged_windows = models.BooleanField(_("damaged windows"), default=False)
    damaged_walls   = models.BooleanField(_("damaged walls"), default=False)
    damaged_switch  = models.BooleanField(_("damaged switch"), default=False)
    damaged_bulb    = models.BooleanField(_("damaged bulb"), default=False)
    damaged_water   = models.BooleanField(_("damaged water"), default=False)

    inside_items = models.JSONField(_("inside items"), default=list, blank=True)
    description  = models.TextField(_("description"), blank=True, default="")
    capacity     = models.PositiveSmallIntegerField(_("capacity"), default=1)

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

    def save(self, *args, **kwargs):
        needs_id     = not self.house_id
        needs_number = not self.house_number

        if needs_id or needs_number:
            if needs_id:
                last = House.objects.filter(house_id__regex=r"^90-\d{3}-00$").order_by("-house_id").first()
                if last:
                    try:
                        seq = int(last.house_id.split("-")[1]) + 1
                    except (IndexError, ValueError):
                        seq = 0
                else:
                    seq = 0
                self.house_id = f"90-{seq:03d}-00"

            if needs_number:
                prefix = {
                    "Staff": "S", "A": "A", "B": "B",
                    "C": "C", "D": "D", "E": "E",
                }.get(self.house_type, self.house_type[:1].upper() or "X")
                last = (
                    House.objects
                    .filter(house_number__startswith=prefix)
                    .order_by("-house_number")
                    .first()
                )
                if last:
                    try:
                        num = int(last.house_number[len(prefix):]) + 1
                    except (IndexError, ValueError):
                        num = 1
                else:
                    num = 1
                self.house_number = f"{prefix}{num}"
        super().save(*args, **kwargs)

    # ── allocation helpers ────────────────────────────────────────────────
    @property
    def is_available(self):
        return self.status == self.Status.ACTIVE and self.current_occupancy < self.capacity

    @property
    def current_occupancy(self):
        # A house is occupied by live "Allocated" applications only.
        # (Deallocated applications have allocated_house=None and never count.)
        return self.allocations.filter(status="Allocated", is_active=True).count()

    @property
    def vacant(self):
        return max(self.capacity - self.current_occupancy, 0)

    @property
    def damaged_items(self):
        """Human-readable list of damaged fixtures (used by analytics/insights)."""
        return [
            label for field, label in [
                ("damaged_door", "door"), ("damaged_windows", "windows"),
                ("damaged_walls", "walls"), ("damaged_switch", "switch"),
                ("damaged_bulb", "bulb"), ("damaged_water", "water"),
            ]
            if getattr(self, field, False)
        ]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  ELIGIBILITY RULE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class EligibilityRule(BaseModel):
    """
    Configurable job-grade → house-type mapping.
    Default (Metehara Sugar Factory):
        Above 17 → Staff, 15–17 → A, 12–14 → B,
        10–11 → C, 7–9 → D, Below 7 → E (Barracks).
    """

    class GenderEligibility(models.TextChoices):
        BOTH       = "Both",      _("Both")
        MALE_ONLY  = "Male",      _("Male Only")
        FEMALE_ONLY = "Female",   _("Female Only")

    min_grade       = models.IntegerField(_("minimum grade (inclusive)"), default=0)
    max_grade       = models.IntegerField(_("maximum grade (inclusive)"), default=30)
    house_type      = models.CharField(_("house type"), max_length=10, choices=House.HouseType.choices)
    gender_eligibility = models.CharField(_("gender eligibility"), max_length=10, choices=GenderEligibility.choices, default=GenderEligibility.BOTH)
    requires_family = models.BooleanField(_("requires family (married)"), default=False, help_text=_("If true, only married employees qualify"))
    min_family_size = models.PositiveIntegerField(_("minimum family size"), default=0)
    description     = models.TextField(_("description"), blank=True)
    priority        = models.PositiveIntegerField(_("evaluation order"), default=0, help_text=_("Lower = evaluated first"))
    is_active       = models.BooleanField(_("active"), default=True, db_index=True)

    class Meta:
        db_table = "eligibility_rules"
        verbose_name = _("eligibility rule")
        verbose_name_plural = _("eligibility rules")
        ordering = ["priority", "min_grade"]

    def __str__(self):
        return f"Grade {self.min_grade}-{self.max_grade} → {self.house_type}"

    def is_eligible(self, application):
        """Return (eligible: bool, reason: str)."""
        try:
            grade = int(application.job_grade)
        except (ValueError, TypeError):
            grade = 0

        if not (self.min_grade <= grade <= self.max_grade):
            return False, f"Grade {grade} outside range {self.min_grade}-{self.max_grade}"

        if self.gender_eligibility != self.GenderEligibility.BOTH:
            if application.gender != self.gender_eligibility:
                return False, f"Gender mismatch: {application.gender} not eligible for {self.gender_eligibility}"

        if self.requires_family and application.marital_status != "Married":
            return False, "Must be married"

        if self.min_family_size and application.family_size < self.min_family_size:
            return False, f"Family size {application.family_size} < minimum {self.min_family_size}"

        return True, "Eligible"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  SCORING CONFIGURATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class ScoringConfig(BaseModel):
    """
    Configurable MCDA scoring weights (must sum to 100 for clarity).
    """
    name = models.CharField(_("configuration name"), max_length=100, default="Default Config")

    job_grade_weight        = models.PositiveIntegerField(_("job grade weight %"), default=30)
    years_of_service_weight = models.PositiveIntegerField(_("years of service weight %"), default=25)
    family_size_weight      = models.PositiveIntegerField(_("family size weight %"), default=20)
    disability_weight       = models.PositiveIntegerField(_("disability priority weight %"), default=10)
    fifo_weight             = models.PositiveIntegerField(_("FIFO / waiting time weight %"), default=15)
    marital_status_weight   = models.PositiveIntegerField(_("marital status weight %"), default=0)
    employment_type_weight  = models.PositiveIntegerField(_("employment type weight %"), default=0)
    medical_priority_weight = models.PositiveIntegerField(_("medical priority weight %"), default=0)

    is_active = models.BooleanField(_("active config"), default=True, db_index=True)

    class Meta:
        db_table = "scoring_configs"
        verbose_name = _("scoring config")
        verbose_name_plural = _("scoring configs")
        ordering = ["-is_active", "-created_at"]

    def __str__(self):
        total = self.total_weight
        return f"{self.name} ({'valid' if total == 100 else f'sum={total}'})"

    @property
    def total_weight(self):
        return sum([
            self.job_grade_weight, self.years_of_service_weight,
            self.family_size_weight, self.disability_weight, self.fifo_weight,
            self.marital_status_weight, self.employment_type_weight,
            self.medical_priority_weight,
        ])

    @property
    def weight_map(self):
        return {
            "job_grade":        self.job_grade_weight,
            "years_of_service": self.years_of_service_weight,
            "family_size":      self.family_size_weight,
            "disability":       self.disability_weight,
            "fifo":             self.fifo_weight,
            "marital_status":   self.marital_status_weight,
            "employment_type":  self.employment_type_weight,
            "medical_priority": self.medical_priority_weight,
        }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  HOUSE APPLICATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class HouseApplication(BaseModel):
    """Application submitted by an employee for housing."""

    class Gender(models.TextChoices):
        MALE   = "Male",   _("Male")
        FEMALE = "Female", _("Female")

    class MaritalStatus(models.TextChoices):
        SINGLE   = "Single",   _("Single")
        MARRIED  = "Married",  _("Married")
        DIVORCED = "Divorced", _("Divorced")
        WIDOWED  = "Widowed",  _("Widowed")

    class PositionType(models.TextChoices):
        PERMANENT      = "Permanent",      _("Permanent")
        SEASONAL       = "Seasonal",       _("Seasonal")
        HALF_PERMANENT = "Half Permanent", _("Half Permanent")
        PPL            = "PPL",            _("PPL")

    class Status(models.TextChoices):
        DRAFT                    = "Draft",                    _("Draft")
        SUBMITTED                = "Submitted",                _("Submitted")
        UNDER_REVIEW             = "Under Review",             _("Under Review")
        VERIFIED                 = "Verified",                 _("Verified")
        WAITING_FOR_ALLOCATION   = "Waiting for Allocation",   _("Waiting for Allocation")
        ALLOCATED                = "Allocated",                _("Allocated")
        REJECTED                 = "Rejected",                 _("Rejected")
        RETURNED                 = "Returned",                 _("Returned")

    # ── identifiers ───────────────────────────────────────────────────────
    application_no = models.CharField(_("application number"), max_length=20, unique=True, blank=True, db_index=True)
    requester      = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="house_applications")
    emp_record     = models.ForeignKey(Employee, on_delete=models.PROTECT, null=True, blank=True, related_name="house_applications")

    # ── employee snapshot ─────────────────────────────────────────────────
    employee_id   = models.CharField(_("employee ID"), max_length=50)
    employee_name = models.CharField(_("employee name"), max_length=255)
    national_id   = models.CharField(_("national ID"), max_length=50, unique=True, db_index=True)
    gender        = models.CharField(_("gender"), max_length=10, choices=Gender.choices)
    job_position  = models.CharField(_("job position"), max_length=255)
    job_grade     = models.CharField(_("job grade"), max_length=50, blank=True)
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
    years_of_service  = models.IntegerField(_("years of service"), default=0)
    marital_status    = models.CharField(_("marital status"), max_length=20, choices=MaritalStatus.choices, default=MaritalStatus.SINGLE)
    has_disability     = models.BooleanField(_("has disability"), default=False)
    family_size       = models.PositiveIntegerField(_("family size"), default=1)
    number_of_children = models.PositiveIntegerField(_("number of children"), default=0)

    # ── request details ───────────────────────────────────────────────────
    requested_house_category = models.CharField(_("requested house category"), max_length=10, choices=House.HouseType.choices, default=House.HouseType.STAFF)
    eligible_house_category  = models.CharField(_("eligible house category"), max_length=10, blank=True, default="")
    reason_for_request       = models.TextField(_("reason for request"), blank=True)
    preferred_location       = models.CharField(_("preferred location"), max_length=255, blank=True)
    supporting_document      = models.FileField(_("supporting document"), upload_to=application_document_path, null=True, blank=True)

    # ── scoring / queue ───────────────────────────────────────────────────
    priority_score = models.DecimalField(_("priority score"), max_digits=8, decimal_places=4, default=0)
    queue_position = models.PositiveIntegerField(_("queue position"), null=True, blank=True)
    score_breakdown = models.JSONField(_("score breakdown (XAI)"), default=dict, blank=True)

    # ── allocation ────────────────────────────────────────────────────────
    allocated_house     = models.ForeignKey(House, on_delete=models.SET_NULL, null=True, blank=True, related_name="allocations")
    allocated_at        = models.DateTimeField(_("allocated at"), null=True, blank=True)
    allocated_by        = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="allocated_applications")
    allocation_notes    = models.TextField(_("allocation notes"), blank=True)
    deallocation_reason = models.TextField(_("deallocation reason"), blank=True)

    # ── workflow ──────────────────────────────────────────────────────────
    status           = models.CharField(_("status"), max_length=30, choices=Status.choices, default=Status.DRAFT, db_index=True)
    submitted_at     = models.DateTimeField(_("submitted at"), null=True, blank=True)
    reviewed_at      = models.DateTimeField(_("reviewed at"), null=True, blank=True)
    reviewed_by      = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_applications")
    rejection_reason = models.TextField(_("rejection reason"), blank=True)
    returned_reason  = models.TextField(_("returned reason"), blank=True)

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
        ]

    def __str__(self):
        return f"{self.application_no} – {self.employee_name} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.application_no:
            last = HouseApplication.objects.filter(application_no__startswith="HAPP-").order_by("-application_no").first()
            if last:
                try:
                    num = int(last.application_no.split("-")[1]) + 1
                except (IndexError, ValueError):
                    num = 1
            else:
                num = 1
            self.application_no = f"HAPP-{num:04d}"
        super().save(*args, **kwargs)

    @property
    def waiting_days(self):
        if not self.submitted_at:
            return 0
        delta = timezone.now() - self.submitted_at
        return delta.days


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  ALLOCATION LOG  (audit trail)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class AllocationLog(BaseModel):
    """Immutable audit record for every allocation action."""

    class Action(models.TextChoices):
        ALLOCATED       = "Allocated",        _("Allocated")
        DEALLOCATED     = "Deallocated",      _("Deallocated")
        TRANSFERRED     = "Transferred",      _("Transferred")
        AUTO_ALLOCATED  = "Auto-Allocated",   _("Auto-Allocated")
        MANUAL_OVERRIDE = "Manual Override",   _("Manual Override")
        QUEUE_JOINED    = "Queue Joined",      _("Queue Joined")
        QUEUE_LEFT      = "Queue Left",        _("Queue Left")
        STATUS_CHANGED  = "Status Changed",    _("Status Changed")

    application    = models.ForeignKey(HouseApplication, on_delete=models.CASCADE, related_name="allocation_logs")
    application_no = models.CharField(_("application number"), max_length=20, db_index=True)
    employee_name  = models.CharField(_("employee name"), max_length=255)
    employee_id    = models.CharField(_("employee ID"), max_length=50)
    house          = models.ForeignKey(House, on_delete=models.SET_NULL, null=True, blank=True, related_name="allocation_logs")
    house_hid      = models.CharField(_("house ID"), max_length=20, blank=True, default="")

    action           = models.CharField(_("action"), max_length=20, choices=Action.choices)
    old_status       = models.CharField(_("old status"), max_length=30, blank=True, default="")
    new_status       = models.CharField(_("new status"), max_length=30, blank=True, default="")
    priority_score   = models.DecimalField(_("priority score"), max_digits=8, decimal_places=4, default=0)
    eligible_category = models.CharField(_("eligible category"), max_length=10, blank=True, default="")
    score_breakdown  = models.JSONField(_("score breakdown (XAI)"), default=dict, blank=True)
    recommendation_reason = models.TextField(_("recommendation reason"), blank=True, default="")
    notes            = models.TextField(_("notes"), blank=True)
    performed_by     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    performed_by_name = models.CharField(_("performed by name"), max_length=255, blank=True, default="")

    class Meta:
        db_table = "allocation_logs"
        verbose_name = _("allocation log")
        verbose_name_plural = _("allocation logs")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["application"]),
            models.Index(fields=["action"]),
            models.Index(fields=["employee_id"]),
        ]

    def __str__(self):
        return f"{self.action}: {self.employee_name} ({self.application_no})"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  HOUSE INSPECTION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class HouseInspection(BaseModel):

    class InspectionType(models.TextChoices):
        MOVE_IN          = "Move-In",          _("Move-In")
        MOVE_OUT         = "Move-Out",         _("Move-Out")
        ROUTINE          = "Routine",          _("Routine")
        DAMAGE_ASSESSMENT = "Damage Assessment", _("Damage Assessment")

    class Status(models.TextChoices):
        SCHEDULED = "Scheduled", _("Scheduled")
        COMPLETED = "Completed", _("Completed")
        FAILED    = "Failed",    _("Failed")

    house          = models.ForeignKey(House, on_delete=models.CASCADE, related_name="inspections")
    inspector      = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="conducted_inspections")
    inspection_type = models.CharField(_("type"), max_length=30, choices=InspectionType.choices, default=InspectionType.ROUTINE)
    status          = models.CharField(_("status"), max_length=20, choices=Status.choices, default=Status.SCHEDULED)
    scheduled_date  = models.DateTimeField(_("scheduled date"))
    completed_date  = models.DateTimeField(_("completed date"), null=True, blank=True)
    findings        = models.TextField(_("findings"), blank=True)
    damage_costs    = models.DecimalField(_("damage costs"), max_digits=10, decimal_places=2, default=0.00)
    checklist_results = models.JSONField(_("checklist results"), default=dict, blank=True)

    class Meta:
        db_table = "house_inspections"
        ordering = ["-scheduled_date"]

    def __str__(self):
        return f"Inspection ({self.inspection_type}) for {self.house.house_id}"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  MAINTENANCE REQUEST
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class MaintenanceRequest(BaseModel):

    class Priority(models.TextChoices):
        LOW      = "Low",      _("Low")
        MEDIUM   = "Medium",   _("Medium")
        HIGH     = "High",     _("High")
        EMERGENCY = "Emergency", _("Emergency")

    class Status(models.TextChoices):
        PENDING     = "Pending",     _("Pending")
        IN_PROGRESS = "In Progress", _("In Progress")
        COMPLETED   = "Completed",   _("Completed")
        CANCELLED   = "Cancelled",   _("Cancelled")

    house        = models.ForeignKey(House, on_delete=models.CASCADE, related_name="maintenance_requests")
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="maintenance_requests")
    title        = models.CharField(_("title"), max_length=255)
    description  = models.TextField(_("description"))
    priority     = models.CharField(_("priority"), max_length=20, choices=Priority.choices, default=Priority.MEDIUM)
    status       = models.CharField(_("status"), max_length=20, choices=Status.choices, default=Status.PENDING)
    cost         = models.DecimalField(_("cost"), max_digits=10, decimal_places=2, default=0.00)
    assigned_to  = models.CharField(_("assigned to"), max_length=255, blank=True)
    resolved_at  = models.DateTimeField(_("resolved at"), null=True, blank=True)

    class Meta:
        db_table = "maintenance_requests"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.house.house_id})"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  HOUSE TRANSFER
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class HouseTransfer(BaseModel):

    class Status(models.TextChoices):
        PENDING   = "Pending",   _("Pending")
        APPROVED  = "Approved",  _("Approved")
        REJECTED  = "Rejected",  _("Rejected")
        COMPLETED = "Completed", _("Completed")

    employee      = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="house_transfers")
    current_house = models.ForeignKey(House, on_delete=models.SET_NULL, null=True, blank=True, related_name="transfers_from")
    target_house  = models.ForeignKey(House, on_delete=models.CASCADE, related_name="transfers_to")
    reason        = models.TextField(_("reason"))
    status        = models.CharField(_("status"), max_length=20, choices=Status.choices, default=Status.PENDING)
    approved_by   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_transfers")

    class Meta:
        db_table = "house_transfers"
        ordering = ["-created_at"]

    def __str__(self):
        curr = self.current_house.house_id if self.current_house else "None"
        return f"Transfer {self.employee.full_name}: {curr} -> {self.target_house.house_id}"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  RENTAL MODULE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class RentalContract(BaseModel):

    class Status(models.TextChoices):
        ACTIVE     = "Active",     _("Active")
        PENDING    = "Pending",    _("Pending")
        EXPIRED    = "Expired",    _("Expired")
        TERMINATED = "Terminated", _("Terminated")
        RENEWED    = "Renewed",    _("Renewed")

    contract_no     = models.CharField(_("contract number"), max_length=30, unique=True, blank=True, db_index=True)
    tenant          = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="rental_contracts")
    house           = models.ForeignKey(House, on_delete=models.PROTECT, related_name="rental_contracts")
    application     = models.ForeignKey(HouseApplication, on_delete=models.SET_NULL, null=True, blank=True, related_name="rental_contracts")
    start_date      = models.DateField(_("start date"))
    end_date        = models.DateField(_("end date"))
    monthly_rent    = models.DecimalField(_("monthly rent"), max_digits=10, decimal_places=2)
    security_deposit = models.DecimalField(_("security deposit"), max_digits=10, decimal_places=2, default=0.00)
    status          = models.CharField(_("status"), max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    terms_conditions = models.TextField(_("terms & conditions"), blank=True)

    class Meta:
        db_table = "rental_contracts"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Contract {self.contract_no} – {self.tenant.full_name}"

    def save(self, *args, **kwargs):
        if not self.contract_no:
            last = RentalContract.objects.filter(contract_no__startswith="RC-").order_by("-contract_no").first()
            num = int(last.contract_no.split("-")[1]) + 1 if last else 1
            self.contract_no = f"RC-{num:04d}"
        super().save(*args, **kwargs)


class RentalInvoice(BaseModel):

    class Status(models.TextChoices):
        UNPAID    = "Unpaid",           _("Unpaid")
        PARTIAL   = "Partially Paid",   _("Partially Paid")
        PAID      = "Paid",             _("Paid")
        OVERDUE   = "Overdue",          _("Overdue")
        CANCELLED = "Cancelled",        _("Cancelled")

    invoice_no   = models.CharField(_("invoice number"), max_length=30, unique=True, blank=True, db_index=True)
    contract     = models.ForeignKey(RentalContract, on_delete=models.CASCADE, related_name="invoices")
    tenant       = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="rental_invoices")
    billing_month = models.CharField(_("billing month"), max_length=20)
    due_date     = models.DateField(_("due date"))
    rent_amount  = models.DecimalField(_("rent amount"), max_digits=10, decimal_places=2)
    penalty_amount = models.DecimalField(_("late penalty"), max_digits=10, decimal_places=2, default=0.00)
    paid_amount  = models.DecimalField(_("paid amount"), max_digits=10, decimal_places=2, default=0.00)
    balance      = models.DecimalField(_("balance"), max_digits=10, decimal_places=2)
    status       = models.CharField(_("status"), max_length=20, choices=Status.choices, default=Status.UNPAID, db_index=True)

    class Meta:
        db_table = "rental_invoices"
        ordering = ["-due_date"]

    def __str__(self):
        return f"Invoice {self.invoice_no} – {self.tenant.full_name}: {self.balance}"

    def save(self, *args, **kwargs):
        if not self.invoice_no:
            last = RentalInvoice.objects.filter(invoice_no__startswith="INV-").order_by("-invoice_no").first()
            num = int(last.invoice_no.split("-")[1]) + 1 if last else 1
            self.invoice_no = f"INV-{num:04d}"
        self.balance = (self.rent_amount + self.penalty_amount) - self.paid_amount
        if self.balance <= 0:
            self.status = self.Status.PAID
        elif self.paid_amount > 0:
            self.status = self.Status.PARTIAL
        super().save(*args, **kwargs)


class RentalPayment(BaseModel):

    class PaymentMethod(models.TextChoices):
        BANK_TRANSFER = "Bank Transfer",   _("Bank Transfer")
        CASH          = "Cash",            _("Cash")
        DEDUCTION     = "Payroll Deduction", _("Payroll Deduction")
        MOBILE_MONEY  = "Mobile Money",    _("Mobile Money")

    receipt_no    = models.CharField(_("receipt number"), max_length=30, unique=True, blank=True, db_index=True)
    invoice       = models.ForeignKey(RentalInvoice, on_delete=models.CASCADE, related_name="payments")
    amount_paid   = models.DecimalField(_("amount paid"), max_digits=10, decimal_places=2)
    payment_method = models.CharField(_("method"), max_length=30, choices=PaymentMethod.choices, default=PaymentMethod.BANK_TRANSFER)
    reference_no  = models.CharField(_("reference number"), max_length=100, blank=True)
    notes         = models.TextField(_("notes"), blank=True)
    recorded_by   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = "rental_payments"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Receipt {self.receipt_no} – {self.amount_paid}"

    def save(self, *args, **kwargs):
        if not self.receipt_no:
            last = RentalPayment.objects.filter(receipt_no__startswith="RCT-").order_by("-receipt_no").first()
            num = int(last.receipt_no.split("-")[1]) + 1 if last else 1
            self.receipt_no = f"RCT-{num:04d}"
        super().save(*args, **kwargs)
        inv = self.invoice
        from django.db.models import Sum
        total_paid = inv.payments.aggregate(total=Sum('amount_paid'))['total'] or Decimal('0.00')
        inv.paid_amount = total_paid
        inv.save()
