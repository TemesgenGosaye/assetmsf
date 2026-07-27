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

    # Unique human-readable ID, auto-generated on save (0001 format)
    employee_id = models.CharField(
        _("employee ID"),
        max_length=20,
        unique=True,
        blank=True,
        db_index=True,
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
    # Auto-generate employee_id before first save (numeric format: 0001)
    # ------------------------------------------------------------------
    def save(self, *args, **kwargs):
        if not self.employee_id:
            last = (
                Employee.objects.exclude(employee_id="")
                .order_by("-employee_id")
                .first()
            )
            if last and last.employee_id.isdigit():
                num = int(last.employee_id) + 1
            else:
                num = 1
            self.employee_id = f"{num:04d}"
        super().save(*args, **kwargs)

    # ------------------------------------------------------------------
    # Computed property
    # ------------------------------------------------------------------
    @property
    def service_years(self):
        """Return the number of full years since hire_date."""
        if not self.hire_date:
            return 0
        import datetime as _dt
        today = _dt.date.today()
        hire = self.hire_date if isinstance(self.hire_date, _dt.date) else _dt.date.fromisoformat(str(self.hire_date))
        return (today - hire).days // 365
