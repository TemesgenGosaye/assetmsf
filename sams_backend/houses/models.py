"""
House model – tracks individual housing units.
"""

import os

from core.models import BaseModel
from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _
from employees.models import Employee


def application_document_path(instance, filename):
    ext = filename.split(".")[-1] if "." in filename else ""
    return os.path.join(
        "house_applications",
        f"app_{instance.application_no or 'new'}_{instance.requester_id}_.{ext}",
    )


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
        help_text=_("List of items inside house: Bed, Chair, Table, Locker"),
    )
    description = models.TextField(_("description"), blank=True, default="")
    capacity = models.PositiveSmallIntegerField(
        _("capacity"),
        default=1,
        help_text=_("Maximum number of residents this unit can hold."),
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
    # Auto-generate house_id before first save
    # ------------------------------------------------------------------
    def save(self, *args, **kwargs):
        if not self.house_id:
            last = (
                House.objects.filter(house_id__regex=r"^90-\d{3}-00$")
                .order_by("-house_id")
                .first()
            )
            if last:
                try:
                    seq = int(last.house_id.split("-")[1]) + 1
                except (IndexError, ValueError):
                    seq = 0
            else:
                seq = 0
            self.house_id = f"90-{seq:03d}-00"
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

    emp_record = models.ForeignKey(
        Employee,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="house_applications",
        verbose_name=_("employee record"),
        help_text=_("Must reference a valid, active employee record."),
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

    def clean(self):
        super().clean()
        if self.employee_id:
            try:
                emp = Employee.objects.get(employee_id=self.employee_id, status="Active")
            except Employee.DoesNotExist:
                from django.core.exceptions import ValidationError
                raise ValidationError(
                    {"employee_id": f"Employee '{self.employee_id}' does not exist or is not active."}
                )
            self.emp_record = emp

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


class HouseInspection(BaseModel):
    """
    Tracks inspection reports for houses (move-in, move-out, routine, damage).
    """
    class InspectionType(models.TextChoices):
        MOVE_IN = "Move-In", _("Move-In")
        MOVE_OUT = "Move-Out", _("Move-Out")
        ROUTINE = "Routine", _("Routine")
        DAMAGE_ASSESSMENT = "Damage Assessment", _("Damage Assessment")

    class Status(models.TextChoices):
        SCHEDULED = "Scheduled", _("Scheduled")
        COMPLETED = "Completed", _("Completed")
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
        related_name="conducted_inspections",
        verbose_name=_("inspector"),
    )
    inspection_type = models.CharField(
        _("inspection type"),
        max_length=30,
        choices=InspectionType.choices,
        default=InspectionType.ROUTINE,
    )
    status = models.CharField(
        _("status"),
        max_length=20,
        choices=Status.choices,
        default=Status.SCHEDULED,
    )
    scheduled_date = models.DateTimeField(_("scheduled date"))
    completed_date = models.DateTimeField(_("completed date"), null=True, blank=True)
    findings = models.TextField(_("findings"), blank=True)
    damage_costs = models.DecimalField(_("damage costs"), max_digits=10, decimal_places=2, default=0.00)
    checklist_results = models.JSONField(_("checklist results"), default=dict, blank=True)

    class Meta:
        db_table = "house_inspections"
        verbose_name = _("house inspection")
        verbose_name_plural = _("house inspections")
        ordering = ["-scheduled_date"]

    def __str__(self):
        return f"Inspection ({self.inspection_type}) for {self.house.house_id} - {self.status}"


class MaintenanceRequest(BaseModel):
    """
    Tracks maintenance and repair requests for houses.
    """
    class Priority(models.TextChoices):
        LOW = "Low", _("Low")
        MEDIUM = "Medium", _("Medium")
        HIGH = "High", _("High")
        EMERGENCY = "Emergency", _("Emergency")

    class Status(models.TextChoices):
        PENDING = "Pending", _("Pending")
        IN_PROGRESS = "In Progress", _("In Progress")
        COMPLETED = "Completed", _("Completed")
        CANCELLED = "Cancelled", _("Cancelled")

    house = models.ForeignKey(
        House,
        on_delete=models.CASCADE,
        related_name="maintenance_requests",
        verbose_name=_("house"),
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="maintenance_requests",
        verbose_name=_("requested by"),
    )
    title = models.CharField(_("title"), max_length=255)
    description = models.TextField(_("description"))
    priority = models.CharField(_("priority"), max_length=20, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(_("status"), max_length=20, choices=Status.choices, default=Status.PENDING)
    cost = models.DecimalField(_("cost"), max_digits=10, decimal_places=2, default=0.00)
    assigned_to = models.CharField(_("assigned to"), max_length=255, blank=True)
    resolved_at = models.DateTimeField(_("resolved at"), null=True, blank=True)

    class Meta:
        db_table = "maintenance_requests"
        verbose_name = _("maintenance request")
        verbose_name_plural = _("maintenance requests")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.house.house_id}) - {self.status}"


class HouseTransfer(BaseModel):
    """
    Tracks requests and approvals for transferring employees between houses.
    """
    class Status(models.TextChoices):
        PENDING = "Pending", _("Pending")
        APPROVED = "Approved", _("Approved")
        REJECTED = "Rejected", _("Rejected")
        COMPLETED = "Completed", _("Completed")

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="house_transfers",
        verbose_name=_("employee"),
    )
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
        on_delete=models.CASCADE,
        related_name="transfers_to",
        verbose_name=_("target house"),
    )
    reason = models.TextField(_("reason"))
    status = models.CharField(_("status"), max_length=20, choices=Status.choices, default=Status.PENDING)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_transfers",
        verbose_name=_("approved by"),
    )

    class Meta:
        db_table = "house_transfers"
        verbose_name = _("house transfer")
        verbose_name_plural = _("house transfers")
        ordering = ["-created_at"]

    def __str__(self):
        curr = self.current_house.house_id if self.current_house else "None"
        return f"Transfer {self.employee.employee_name}: {curr} -> {self.target_house.house_id} ({self.status})"


class RentalContract(BaseModel):
    """
    Manages rental contracts, lease agreements, security deposits, and rent terms.
    """
    class Status(models.TextChoices):
        ACTIVE = "Active", _("Active")
        PENDING = "Pending", _("Pending")
        EXPIRED = "Expired", _("Expired")
        TERMINATED = "Terminated", _("Terminated")
        RENEWED = "Renewed", _("Renewed")

    contract_no = models.CharField(_("contract number"), max_length=30, unique=True, blank=True, db_index=True)
    tenant = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="rental_contracts", verbose_name=_("tenant"))
    house = models.ForeignKey(House, on_delete=models.PROTECT, related_name="rental_contracts", verbose_name=_("house"))
    application = models.ForeignKey(HouseApplication, on_delete=models.SET_NULL, null=True, blank=True, related_name="rental_contracts", verbose_name=_("source application"))
    
    start_date = models.DateField(_("start date"))
    end_date = models.DateField(_("end date"))
    monthly_rent = models.DecimalField(_("monthly rent"), max_digits=10, decimal_places=2)
    security_deposit = models.DecimalField(_("security deposit"), max_digits=10, decimal_places=2, default=0.00)
    status = models.CharField(_("status"), max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    terms_conditions = models.TextField(_("terms & conditions"), blank=True)

    class Meta:
        db_table = "rental_contracts"
        verbose_name = _("rental contract")
        verbose_name_plural = _("rental contracts")
        ordering = ["-created_at"]

    def __str__(self):
        return f"Contract {self.contract_no} - {self.tenant.employee_name} ({self.house.house_id})"

    def save(self, *args, **kwargs):
        if not self.contract_no:
            last = RentalContract.objects.filter(contract_no__startswith="RC-").order_by("-contract_no").first()
            num = int(last.contract_no.split("-")[1]) + 1 if last else 1
            self.contract_no = f"RC-{num:04d}"
        super().save(*args, **kwargs)


class RentalInvoice(BaseModel):
    """
    Tracks monthly rent billing, penalties, and outstanding balances.
    """
    class Status(models.TextChoices):
        UNPAID = "Unpaid", _("Unpaid")
        PARTIAL = "Partially Paid", _("Partially Paid")
        PAID = "Paid", _("Paid")
        OVERDUE = "Overdue", _("Overdue")
        CANCELLED = "Cancelled", _("Cancelled")

    invoice_no = models.CharField(_("invoice number"), max_length=30, unique=True, blank=True, db_index=True)
    contract = models.ForeignKey(RentalContract, on_delete=models.CASCADE, related_name="invoices", verbose_name=_("rental contract"))
    tenant = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="rental_invoices", verbose_name=_("tenant"))
    
    billing_month = models.CharField(_("billing month"), max_length=20)
    due_date = models.DateField(_("due date"))
    rent_amount = models.DecimalField(_("rent amount"), max_digits=10, decimal_places=2)
    penalty_amount = models.DecimalField(_("late penalty"), max_digits=10, decimal_places=2, default=0.00)
    paid_amount = models.DecimalField(_("paid amount"), max_digits=10, decimal_places=2, default=0.00)
    balance = models.DecimalField(_("balance"), max_digits=10, decimal_places=2)
    status = models.CharField(_("status"), max_length=20, choices=Status.choices, default=Status.UNPAID, db_index=True)

    class Meta:
        db_table = "rental_invoices"
        verbose_name = _("rental invoice")
        verbose_name_plural = _("rental invoices")
        ordering = ["-due_date"]

    def __str__(self):
        return f"Invoice {self.invoice_no} ({self.billing_month}) - {self.tenant.employee_name}: ₦{self.balance} due"

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
    """
    Records rental payments, receipt generation, and payment methods.
    """
    class PaymentMethod(models.TextChoices):
        BANK_TRANSFER = "Bank Transfer", _("Bank Transfer")
        CASH = "Cash", _("Cash")
        DEDUCTION = "Payroll Deduction", _("Payroll Deduction")
        MOBILE_MONEY = "Mobile Money", _("Mobile Money")

    receipt_no = models.CharField(_("receipt number"), max_length=30, unique=True, blank=True, db_index=True)
    invoice = models.ForeignKey(RentalInvoice, on_delete=models.CASCADE, related_name="payments", verbose_name=_("invoice"))
    amount_paid = models.DecimalField(_("amount paid"), max_digits=10, decimal_places=2)
    payment_method = models.CharField(_("payment method"), max_length=30, choices=PaymentMethod.choices, default=PaymentMethod.BANK_TRANSFER)
    reference_no = models.CharField(_("reference number"), max_length=100, blank=True)
    notes = models.TextField(_("notes"), blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, verbose_name=_("recorded by"))

    class Meta:
        db_table = "rental_payments"
        verbose_name = _("rental payment")
        verbose_name_plural = _("rental payments")
        ordering = ["-created_at"]

    def __str__(self):
        return f"Receipt {self.receipt_no} - ₦{self.amount_paid} ({self.invoice.invoice_no})"

    def save(self, *args, **kwargs):
        if not self.receipt_no:
            last = RentalPayment.objects.filter(receipt_no__startswith="RCT-").order_by("-receipt_no").first()
            num = int(last.receipt_no.split("-")[1]) + 1 if last else 1
            self.receipt_no = f"RCT-{num:04d}"
        super().save(*args, **kwargs)
        inv = self.invoice
        from django.db.models import Sum
        total_paid = inv.payments.aggregate(total=Sum('amount_paid'))['total'] or 0.00
        inv.paid_amount = total_paid
        inv.save()



