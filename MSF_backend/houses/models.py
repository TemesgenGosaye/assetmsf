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

    class RoomStatus(models.TextChoices):
        VACANT   = "Vacant",   _("Vacant")
        OCCUPIED = "Occupied", _("Occupied")
        RESERVED = "Reserved", _("Reserved")
        MAINTENANCE = "Maintenance", _("Under Maintenance")

    HOUSE_TYPE_ROOMS = {
        HouseType.STAFF: 3,
        HouseType.TYPE_A: 3,
        HouseType.TYPE_B: 3,
        HouseType.TYPE_C: 2,
        HouseType.TYPE_D: 1,
        HouseType.TYPE_E: 1,
    }
    HOUSE_TYPE_ROOM_LABELS = {
        HouseType.STAFF: ["R1", "R2", "R3"],
        HouseType.TYPE_A: ["R1", "R2", "R3"],
        HouseType.TYPE_B: ["R1", "R2", "R3"],
        HouseType.TYPE_C: ["R1", "R2"],
        HouseType.TYPE_D: ["R1"],
        HouseType.TYPE_E: ["R1"],
    }

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

    room_count = models.PositiveSmallIntegerField(_("room count"), default=1, editable=False)
    room_labels = models.JSONField(_("room labels"), default=list, blank=True, editable=False)

    r1_status = models.CharField(_("R1 status"), max_length=20, choices=RoomStatus.choices, default=RoomStatus.VACANT, blank=True)
    r1_occupant_name = models.CharField(_("R1 occupant"), max_length=255, blank=True, default="")
    r1_occupant_id = models.CharField(_("R1 occupant employee ID"), max_length=50, blank=True, default="")
    r1_notes = models.CharField(_("R1 notes"), max_length=255, blank=True, default="")

    r2_status = models.CharField(_("R2 status"), max_length=20, choices=RoomStatus.choices, default=RoomStatus.VACANT, blank=True)
    r2_occupant_name = models.CharField(_("R2 occupant"), max_length=255, blank=True, default="")
    r2_occupant_id = models.CharField(_("R2 occupant employee ID"), max_length=50, blank=True, default="")
    r2_notes = models.CharField(_("R2 notes"), max_length=255, blank=True, default="")

    r3_status = models.CharField(_("R3 status"), max_length=20, choices=RoomStatus.choices, default=RoomStatus.VACANT, blank=True)
    r3_occupant_name = models.CharField(_("R3 occupant"), max_length=255, blank=True, default="")
    r3_occupant_id = models.CharField(_("R3 occupant employee ID"), max_length=50, blank=True, default="")
    r3_notes = models.CharField(_("R3 notes"), max_length=255, blank=True, default="")

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

        self.room_count = self.HOUSE_TYPE_ROOMS.get(self.house_type, 1)
        self.room_labels = self.HOUSE_TYPE_ROOM_LABELS.get(self.house_type, ["R1"])

        if self.room_count < 3:
            self.r3_status = ""
            self.r3_occupant_name = ""
            self.r3_occupant_id = ""
            self.r3_notes = ""
        if self.room_count < 2:
            self.r2_status = ""
            self.r2_occupant_name = ""
            self.r2_occupant_id = ""
            self.r2_notes = ""

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

    # ── room helpers ──────────────────────────────────────────────────────

    @property
    def rooms(self):
        labels = self.room_labels or []
        result = []
        for i, label in enumerate(labels, start=1):
            status = getattr(self, f"r{i}_status", "") or ""
            if not status:
                continue
            result.append({
                "label": label,
                "index": i,
                "status": status,
                "occupant_name": getattr(self, f"r{i}_occupant_name", "") or "",
                "occupant_id": getattr(self, f"r{i}_occupant_id", "") or "",
                "notes": getattr(self, f"r{i}_notes", "") or "",
            })
        return result

    @property
    def rooms_summary(self):
        total = self.room_count
        occupied = 0
        vacant = 0
        reserved = 0
        maintenance = 0
        for r in self.rooms:
            s = r.get("status", "")
            if s == "Occupied":
                occupied += 1
            elif s == "Vacant":
                vacant += 1
            elif s == "Reserved":
                reserved += 1
            elif s == "Maintenance":
                maintenance += 1
        return {
            "total": total,
            "occupied": occupied,
            "vacant": vacant,
            "reserved": reserved,
            "maintenance": maintenance,
            "labels": [r.get("label", "") for r in self.rooms],
            "details": self.rooms,
        }

    # ── room helpers ──────────────────────────────────────────────────────

    def room_for_label(self, label):
        """Return the room dict {label, index, status, occupant_*} matching `label`."""
        for r in self.rooms:
            if r["label"] == label:
                return r
        return None

    def set_room_status(self, label, status, occupant_name="", occupant_id="", notes=""):
        """Persist a room's physical status/occupant (rN_* columns)."""
        room = self.room_for_label(label)
        if room is None:
            return None
        index = room["index"]
        setattr(self, f"r{index}_status", status)
        setattr(self, f"r{index}_occupant_name", occupant_name)
        setattr(self, f"r{index}_occupant_id", occupant_id)
        setattr(self, f"r{index}_notes", notes)
        return index

    def claim_all_rooms(self, occupant_name="", occupant_id="", notes=""):
        """Mark every room as Occupied by one household (whole-house allocation)."""
        for r in self.rooms:
            self.set_room_status(
                r["label"], self.RoomStatus.OCCUPIED,
                occupant_name=occupant_name, occupant_id=occupant_id, notes=notes,
            )

    def free_room(self, label):
        """Release a single room back to Vacant."""
        return self.set_room_status(label, self.RoomStatus.VACANT)

    def free_all_rooms(self):
        """Release every room back to Vacant (whole-house deallocation)."""
        for r in self.rooms:
            self.free_room(r["label"])

    @property
    def available_rooms(self):
        """Rooms that are physically vacant (available for room-level allocation)."""
        return [r for r in self.rooms if r.get("status") == self.RoomStatus.VACANT]

    @property
    def room_vacant_count(self):
        return len(self.available_rooms)

    # ── allocation helpers ────────────────────────────────────────────────
    @property
    def is_available(self):
        # A house is "available" whenever at least one room is physically
        # vacant AND no live whole-house allocation claims the unit.
        if self.status != self.Status.ACTIVE or self.room_vacant_count <= 0:
            return False
        has_house_claim = self.allocation_records.filter(
            status=Allocation.Status.ACTIVE,
            allocation_unit_type=Allocation.AllocationUnit.HOUSE,
        ).exists()
        return not has_house_claim

    @property
    def is_fully_vacant(self):
        """True when the house holds no live allocation and every room is vacant."""
        return self.current_occupancy == 0 and self.room_vacant_count >= self.room_count

    @property
    def current_occupancy(self):
        # A house is occupied by live Allocation records only — the single
        # authoritative source of truth for occupancy. Historical/terminated
        # allocations never count towards capacity. Each live allocation
        # (whole-house or per-room) counts as one occupied unit.
        return self.allocation_records.filter(status=Allocation.Status.ACTIVE).count()

    @property
    def vacant(self):
        # Vacancy is expressed at the room level (physical truth).
        return self.room_vacant_count

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

    class AllocationMode(models.TextChoices):
        ROOM  = "ROOM_ALLOCATION",  _("Room allocation (single applicant)")
        HOUSE = "HOUSE_ALLOCATION", _("Whole house allocation (family)")

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
    allocation_mode = models.CharField(
        _("allocation mode"),
        max_length=20,
        choices=AllocationMode.choices,
        blank=True,
        default="",
        db_index=True,
        help_text=_("ROOM_ALLOCATION for single applicants (family size 1), HOUSE_ALLOCATION for married/families (family size ≥ 2)."),
    )
    reason_for_request       = models.TextField(_("reason for request"), blank=True)
    preferred_location       = models.CharField(_("preferred location"), max_length=255, blank=True)
    supporting_document      = models.FileField(_("supporting document"), upload_to=application_document_path, null=True, blank=True)

    # ── scoring / queue ───────────────────────────────────────────────────
    priority_score = models.DecimalField(_("priority score"), max_digits=8, decimal_places=4, default=0)
    queue_position = models.PositiveIntegerField(_("queue position"), null=True, blank=True)
    score_breakdown = models.JSONField(_("score breakdown (XAI)"), default=dict, blank=True)
    eligibility_analysis = models.JSONField(
        _("eligibility analysis (XAI)"),
        default=list,
        blank=True,
        help_text=_("Per-rule eligibility breakdown: {rule, house_type, passed, reason}."),
    )
    allocation_confidence = models.DecimalField(
        _("allocation confidence"),
        max_digits=6,
        decimal_places=4,
        default=0,
        help_text=_("Confidence (0-100) of the current/last allocation recommendation."),
    )

    # ── allocation ────────────────────────────────────────────────────────
    allocated_house     = models.ForeignKey(House, on_delete=models.SET_NULL, null=True, blank=True, related_name="allocations")
    allocated_room_label = models.CharField(_("allocated room label"), max_length=20, blank=True, default="")
    allocated_room_number = models.CharField(_("allocated room number"), max_length=50, blank=True, default="")
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

    allocation_unit_type = models.CharField(_("allocation unit"), max_length=20, blank=True, default="")
    room_label           = models.CharField(_("room label"), max_length=20, blank=True, default="")
    room_number          = models.CharField(_("room number"), max_length=50, blank=True, default="")

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


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  HOUSE OPPORTUNITY  (house_opp)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class HouseOpportunity(BaseModel):
    """
    A candidate house matched against an application by the allocation engine.

    Each opportunity records WHY the house is a fit (compatibility score +
    match reasons) and WHERE it stands in the applicant's ranked shortlist,
    giving the review workspace a transparent, explainable house_opp pipeline:

        Generated → Eligible → Ranked → Recommended → Selected → Allocated
                                  (└→ Rejected / Expired / Unavailable)
    """

    class Status(models.TextChoices):
        GENERATED   = "Generated",   _("Generated")
        ELIGIBLE    = "Eligible",    _("Eligible")
        RANKED      = "Ranked",      _("Ranked")
        RECOMMENDED = "Recommended", _("Recommended")
        SELECTED    = "Selected",    _("Selected")
        ALLOCATED   = "Allocated",   _("Allocated")
        REJECTED    = "Rejected",    _("Rejected")
        EXPIRED     = "Expired",     _("Expired")
        UNAVAILABLE = "Unavailable", _("Unavailable")

    class Recommendation(models.TextChoices):
        RECOMMENDED  = "Recommended",  _("Recommended")
        ALTERNATIVE  = "Alternative",  _("Alternative")
        NOT_SUITABLE = "Not Suitable", _("Not Suitable")

    application = models.ForeignKey(HouseApplication, on_delete=models.CASCADE, related_name="opportunities")
    house       = models.ForeignKey(House, on_delete=models.CASCADE, related_name="opportunities")

    allocation_mode = models.CharField(_("allocation mode"), max_length=20, blank=True, default="", db_index=True)
    room_label      = models.CharField(_("room label"), max_length=20, blank=True, default="")
    room_number     = models.CharField(_("room number"), max_length=50, blank=True, default="")

    eligible_category   = models.CharField(_("eligible category"), max_length=10, blank=True, default="")
    compatibility_score = models.DecimalField(_("compatibility score"), max_digits=8, decimal_places=4, default=0)
    priority_score      = models.DecimalField(_("applicant priority score"), max_digits=8, decimal_places=4, default=0)
    match_reasons       = models.JSONField(_("match reasons (XAI)"), default=list, blank=True)
    recommendation      = models.CharField(_("recommendation"), max_length=20, choices=Recommendation.choices, default=Recommendation.ALTERNATIVE, db_index=True)
    recommendation_reason = models.TextField(_("recommendation reason"), blank=True, default="")
    status              = models.CharField(_("status"), max_length=20, choices=Status.choices, default=Status.GENERATED, db_index=True)
    rank                = models.PositiveIntegerField(_("rank in shortlist"), null=True, blank=True)
    notes               = models.TextField(_("notes"), blank=True, default="")

    class Meta:
        db_table = "house_opportunities"
        verbose_name = _("house opportunity")
        verbose_name_plural = _("house opportunities")
        ordering = ["rank", "-compatibility_score", "house__house_id"]
        indexes = [
            models.Index(fields=["application", "status"]),
            models.Index(fields=["house", "status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["application", "house", "room_label"],
                name="uniq_application_house_room_opportunity",
            ),
        ]

    @property
    def resource_label(self):
        """Human-readable allocated resource, e.g. 'S2 — Room R2' or 'A1'."""
        base = self.house.house_number or self.house.house_id
        if self.room_label:
            return f"{base} — Room {self.room_label}"
        return base

    def __str__(self):
        unit = f" · {self.room_label}" if self.room_label else ""
        return f"{self.application.application_no} → {self.house.house_id}{unit} ({self.compatibility_score})"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  ALLOCATION  (Allocated House — authoritative allocation record)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class Allocation(BaseModel):
    """
    Authoritative record of a completed house allocation. The Allocated House
    module is powered by these records; occupancy, availability and audit all
    flow from here (single source of truth).

    `HouseApplication.allocated_house` is kept as a convenience projection of
    the current ACTIVE allocation only — it is synced by the allocation engine
    and never treated as an independent source of truth.
    """

    class AllocationType(models.TextChoices):
        AUTO     = "Auto",     _("Auto")
        MANUAL   = "Manual",   _("Manual")
        OVERRIDE = "Override", _("Override")

    class AllocationUnit(models.TextChoices):
        ROOM  = "ROOM_ALLOCATION",  _("Room (single occupant)")
        HOUSE = "HOUSE_ALLOCATION", _("Whole house (family)")

    class Status(models.TextChoices):
        ACTIVE      = "Active",      _("Active")
        TERMINATED  = "Terminated",  _("Terminated")
        REALLOCATED = "Reallocated", _("Reallocated")

    class Occupancy(models.TextChoices):
        PENDING  = "Pending",  _("Pending")
        OCCUPIED = "Occupied", _("Occupied")
        VACATED  = "Vacated",  _("Vacated")

    allocation_no = models.CharField(_("allocation number"), max_length=20, unique=True, blank=True, db_index=True)
    application   = models.ForeignKey(HouseApplication, on_delete=models.PROTECT, related_name="allocation_records")
    house         = models.ForeignKey(House, on_delete=models.PROTECT, related_name="allocation_records")
    emp_record    = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name="house_allocations")

    # ── allocation unit (room vs whole house) ─────────────────────────────
    allocation_unit_type = models.CharField(
        _("allocation unit"),
        max_length=20,
        choices=AllocationUnit.choices,
        default=AllocationUnit.HOUSE,
        db_index=True,
        help_text=_("ROOM_ALLOCATION for single occupants, HOUSE_ALLOCATION for married/families."),
    )
    room_label    = models.CharField(_("room label"), max_length=20, blank=True, default="")
    room_index    = models.PositiveSmallIntegerField(_("room index"), null=True, blank=True)
    room_number   = models.CharField(_("room number"), max_length=50, blank=True, default="")
    room_status   = models.CharField(_("room status at allocation"), max_length=20, blank=True, default="")
    marital_status = models.CharField(_("marital status"), max_length=20, blank=True, default="")
    family_size   = models.PositiveIntegerField(_("family size"), default=1)

    # ── snapshots (immutable at allocation time) ──────────────────────────
    employee_id   = models.CharField(_("employee ID"), max_length=50)
    employee_name = models.CharField(_("employee name"), max_length=255)

    allocation_type      = models.CharField(_("allocation type"), max_length=20, choices=AllocationType.choices, default=AllocationType.MANUAL, db_index=True)
    priority_score       = models.DecimalField(_("priority score"), max_digits=8, decimal_places=4, default=0)
    recommendation_score = models.DecimalField(_("house compatibility score"), max_digits=8, decimal_places=4, default=0)
    confidence           = models.DecimalField(_("allocation confidence"), max_digits=6, decimal_places=4, default=0)
    recommendation_reason = models.TextField(_("recommendation reason"), blank=True, default="")

    status           = models.CharField(_("status"), max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    occupancy_status = models.CharField(_("occupancy status"), max_length=20, choices=Occupancy.choices, default=Occupancy.PENDING)

    allocated_at  = models.DateTimeField(_("allocated at"), default=timezone.now)
    effective_date = models.DateField(_("effective date"), null=True, blank=True)
    allocated_by  = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="allocation_records")

    override_reason = models.TextField(_("override reason"), blank=True, default="")
    notes           = models.TextField(_("notes"), blank=True, default="")

    previous_allocation = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="successors")

    terminated_at  = models.DateTimeField(_("terminated at"), null=True, blank=True)
    terminated_by  = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="terminated_allocation_records")
    termination_reason = models.TextField(_("termination reason"), blank=True, default="")

    class Meta:
        db_table = "allocations"
        verbose_name = _("allocation")
        verbose_name_plural = _("allocations")
        ordering = ["-allocated_at"]
        indexes = [
            models.Index(fields=["house", "status"]),
            models.Index(fields=["application", "status"]),
            models.Index(fields=["employee_id", "status"]),
        ]

    def __str__(self):
        unit = f" · {self.room_label}" if self.room_label else ""
        return f"{self.allocation_no} – {self.employee_name} → {self.house.house_id}{unit} ({self.status})"

    @property
    def resource(self):
        """Human-readable allocated resource, e.g. 'S2 — Room R2' or 'A1'."""
        base = self.house.house_number or self.house.house_id
        if self.allocation_unit_type == self.AllocationUnit.ROOM and self.room_label:
            return f"{base} — Room {self.room_label}"
        return base

    def save(self, *args, **kwargs):
        if not self.allocation_no:
            last = Allocation.objects.filter(allocation_no__startswith="ALLOC-").order_by("-allocation_no").first()
            num = int(last.allocation_no.split("-")[1]) + 1 if last else 1
            self.allocation_no = f"ALLOC-{num:04d}"
        super().save(*args, **kwargs)

    def sync_application(self):
        """Project this allocation onto the owning application's convenience fields."""
        app = self.application
        if self.status == self.Status.ACTIVE:
            app.status = HouseApplication.Status.ALLOCATED
            app.allocated_house = self.house
            app.allocated_room_label = self.room_label
            app.allocated_room_number = self.room_number
            app.allocated_at = self.allocated_at
            app.allocated_by = self.allocated_by
            app.allocation_notes = self.notes
            app.allocation_mode = self.allocation_unit_type
            app.allocation_confidence = self.confidence
            app.save(update_fields=[
                "status", "allocated_house", "allocated_room_label",
                "allocated_room_number", "allocated_at", "allocated_by",
                "allocation_notes", "allocation_mode", "allocation_confidence",
                "updated_at",
            ])
        elif app.allocated_house_id == self.house_id:
            app.status = HouseApplication.Status.WAITING_FOR_ALLOCATION
            app.allocated_house = None
            app.allocated_room_label = ""
            app.allocated_room_number = ""
            app.allocated_at = None
            app.allocated_by = None
            app.allocation_notes = self.notes or ""
            app.allocation_confidence = 0
            app.deallocation_reason = self.termination_reason
            app.save(update_fields=[
                "status", "allocated_house", "allocated_room_label",
                "allocated_room_number", "allocated_at", "allocated_by",
                "allocation_notes", "allocation_confidence", "deallocation_reason",
                "updated_at",
            ])


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  HOUSE AUDIT TRAIL  (generic workflow audit)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class HouseAuditTrail(BaseModel):
    """Immutable timeline entry for every meaningful housing workflow event.

    Complements `AllocationLog` (allocation-lifecycle specific) with a broader
    audit covering reviews, scoring, opportunity generation/ranking, status
    transitions and allocation actions — powering the per-application timeline.
    """

    class Action(models.TextChoices):
        CREATED                 = "Created",                  _("Created")
        SUBMITTED               = "Submitted",                _("Submitted")
        REVIEW_STARTED          = "Review Started",           _("Review Started")
        VERIFIED                = "Verified",                 _("Verified")
        REJECTED                = "Rejected",                 _("Rejected")
        RETURNED                = "Returned",                 _("Returned")
        SCORE_RECALCULATED      = "Score Recalculated",       _("Score Recalculated")
        OPPORTUNITIES_GENERATED = "Opportunities Generated",  _("Opportunities Generated")
        OPPORTUNITIES_RANKED    = "Opportunities Ranked",     _("Opportunities Ranked")
        AUTO_ALLOCATED          = "Auto-Allocated",           _("Auto-Allocated")
        MANUAL_ALLOCATED        = "Manually Allocated",       _("Manually Allocated")
        OVERRIDE_ALLOCATED      = "Override Allocated",       _("Override Allocated")
        DEALLOCATED             = "Deallocated",              _("Deallocated")
        TERMINATED              = "Allocation Terminated",    _("Allocation Terminated")
        REALLOCATED             = "Reallocated",              _("Reallocated")
        TRANSFERRED             = "Transferred",              _("Transferred")
        STATUS_CHANGED          = "Status Changed",           _("Status Changed")

    application = models.ForeignKey(HouseApplication, on_delete=models.CASCADE, related_name="audit_trail")
    action      = models.CharField(_("action"), max_length=40, choices=Action.choices, db_index=True)
    actor       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="house_audit_entries")
    actor_name  = models.CharField(_("actor name"), max_length=255, blank=True, default="")
    old_status  = models.CharField(_("old status"), max_length=30, blank=True, default="")
    new_status  = models.CharField(_("new status"), max_length=30, blank=True, default="")
    detail      = models.JSONField(_("detail"), default=dict, blank=True)
    note        = models.TextField(_("note"), blank=True, default="")
    ip_address  = models.GenericIPAddressField(_("IP address"), null=True, blank=True)

    class Meta:
        db_table = "house_audit_trail"
        verbose_name = _("house audit entry")
        verbose_name_plural = _("house audit trail")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["application", "-created_at"]),
            models.Index(fields=["action"]),
        ]

    def __str__(self):
        return f"{self.action}: {self.application.application_no} ({self.actor_name})"
