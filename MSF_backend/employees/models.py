"""
Employee model for HR / workforce management.
"""
from django.utils.translation import gettext_lazy as _
from django.db import models
from core.models import BaseModel
from departments.models import Department


def employee_cv_upload_path(instance, filename):
    return f"employee_cvs/{instance.employee_id}/{filename}"


class Employee(BaseModel):
    """
    Employee model – tracks HR data for all staff members.
    """

    class Status(models.TextChoices):
        ACTIVE = "Active", _("Active")
        ON_LEAVE = "On Leave", _("On Leave")
        TERMINATED = "Terminated", _("Terminated")

    class MaritalStatus(models.TextChoices):
        SINGLE = "Single", _("Single")
        MARRIED = "Married", _("Married")
        DIVORCED = "Divorced", _("Divorced")
        WIDOWED = "Widowed", _("Widowed")

    # Unique human-readable ID – manually entered by HR, never auto-generated
    employee_id = models.CharField(
        _("employee ID"),
        max_length=20,
        unique=True,
        db_index=True,
        help_text=_("Manually assigned employee code (e.g. EMP-00001). Entered by HR, never auto-generated."),
    )

    full_name = models.CharField(_("full name"), max_length=255, db_index=True)
    national_id = models.CharField(
        _("national ID"),
        max_length=50,
        unique=True,
        db_index=True,
    )
    class JobType(models.TextChoices):
        PERMANENT = "Permanent", _("Permanent")
        SEMI_PERMANENT = "Semi Permanent", _("Semi Permanent")
        SEASONAL = "Seasonal", _("Seasonal")

    job_position = models.CharField(_("job position"), max_length=255)
    job_grade = models.CharField(_("job grade"), max_length=50, blank=True, default="")
    job_type = models.CharField(
        _("job type"),
        max_length=20,
        choices=JobType.choices,
        default=JobType.PERMANENT,
        blank=True,
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employees",
        verbose_name=_("department"),
    )
    hire_date = models.DateField(_("hire date"), null=True, blank=True)
    family_size = models.PositiveIntegerField(_("family size"), default=0)
    marital_status = models.CharField(
        _("marital status"),
        max_length=20,
        choices=MaritalStatus.choices,
        default=MaritalStatus.SINGLE,
        blank=True,
    )
    has_disability = models.BooleanField(_("has disability"), default=False)
    status = models.CharField(
        _("status"),
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    cv_file = models.FileField(
        _("CV file"),
        upload_to=employee_cv_upload_path,
        null=True,
        blank=True,
    )

    class Meta:
        db_table = "employees"
        verbose_name = _("employee")
        verbose_name_plural = _("employees")
        ordering = ["employee_id"]
        indexes = [
            models.Index(fields=["employee_id"]),
            models.Index(fields=["national_id"]),
            models.Index(fields=["status"]),
            models.Index(fields=["department"]),
        ]

    def __str__(self):
        return f"{self.employee_id} – {self.full_name}"

    # ------------------------------------------------------------------
    # Computed properties
    # ------------------------------------------------------------------
    @property
    def service_years(self):
        """Return the number of complete years since hire_date, based on today's date."""
        if not self.hire_date:
            return 0
        import datetime as _dt
        today = _dt.date.today()
        hire = self.hire_date if isinstance(self.hire_date, _dt.date) else _dt.date.fromisoformat(str(self.hire_date))
        years = today.year - hire.year
        if (today.month, today.day) < (hire.month, hire.day):
            years -= 1
        return max(years, 0)

    @property
    def service_duration(self):
        """Human-readable service duration since hire_date, e.g. '6 yrs 7 mo 2 days'."""
        if not self.hire_date:
            return ""
        import datetime as _dt
        today = _dt.date.today()
        hire = self.hire_date if isinstance(self.hire_date, _dt.date) else _dt.date.fromisoformat(str(self.hire_date))
        if today < hire:
            return ""
        years = today.year - hire.year
        months = today.month - hire.month
        days = today.day - hire.day
        if days < 0:
            days += (today.replace(day=1) - _dt.timedelta(days=1)).day
            months -= 1
        if months < 0:
            months += 12
            years -= 1
        parts = []
        if years:
            parts.append(f"{years} yr{'s' if years != 1 else ''}")
        if months:
            parts.append(f"{months} mo")
        if days:
            parts.append(f"{days} day{'s' if days != 1 else ''}")
        return " ".join(parts) if parts else "0 days"
