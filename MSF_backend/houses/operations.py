"""
House operations service — inspections, maintenance, transfers, rentals.
All mutations are transaction-safe and write allocation/audit trails so the
whole housing lifecycle stays traceable end-to-end.
"""
from datetime import timedelta
from decimal import Decimal

from django.db import models, transaction
from django.db.models import Sum
from django.utils import timezone

from .models import (
    House, HouseApplication, HouseInspection, MaintenanceRequest,
    HouseTransfer, RentalContract, RentalInvoice, RentalPayment, AllocationLog,
    Allocation, HouseAuditTrail,
)
from .allocation_engine import (
    allocate_application, terminate_allocation, record_audit,
)

# ── inspections ───────────────────────────────────────────────────────────

def create_inspection(user, house, inspection_type, scheduled_date,
                      inspector=None, findings="", checklist_results=None):
    """Schedule a new inspection for a house."""
    if not isinstance(house, House):
        house = House.objects.get(house_id=house, is_active=True)
    inspection = HouseInspection.objects.create(
        house=house,
        inspector=inspector or user,
        inspection_type=inspection_type,
        status=HouseInspection.Status.SCHEDULED,
        scheduled_date=scheduled_date,
        findings=findings,
        checklist_results=checklist_results or {},
        created_by=user,
    )
    return inspection


def complete_inspection(user, inspection, findings="", damage_costs=None,
                        checklist_results=None, status=HouseInspection.Status.COMPLETED):
    """Close an inspection, optionally syncing damage booleans onto the house."""
    with transaction.atomic():
        inspection = HouseInspection.objects.select_for_update().get(id=inspection.id)
        inspection.status = status
        inspection.completed_date = timezone.now()
        if findings:
            inspection.findings = findings
        if damage_costs is not None:
            inspection.damage_costs = Decimal(str(damage_costs))
        if checklist_results is not None:
            inspection.checklist_results = checklist_results
        inspection.save()

        if status == HouseInspection.Status.COMPLETED and checklist_results:
            damage_flags = {
                "door": "damaged_door", "windows": "damaged_windows",
                "walls": "damaged_walls", "switch": "damaged_switch",
                "bulb": "damaged_bulb", "water": "damaged_water",
            }
            changed = False
            for key, field in damage_flags.items():
                value = checklist_results.get(key, checklist_results.get(field, None))
                if value is not None:
                    setattr(inspection.house, field, bool(value))
                    changed = True
            if changed:
                inspection.house.save(update_fields=[*damage_flags.values(), "updated_at"])
    return inspection

# ── maintenance ───────────────────────────────────────────────────────────

def create_maintenance_request(user, house, title, description, priority="Medium"):
    request_obj = MaintenanceRequest.objects.create(
        house=house,
        requested_by=user,
        title=title,
        description=description,
        priority=priority,
        status=MaintenanceRequest.Status.PENDING,
        created_by=user,
    )
    return request_obj


def update_maintenance_status(user, request_obj, new_status, cost=None,
                              assigned_to="", resolution_note=""):
    """Transitions a maintenance request with validation + audit fields."""
    if request_obj.status == MaintenanceRequest.Status.COMPLETED:
        raise ValueError("Completed maintenance requests cannot be modified.")
    if new_status == "Cancelled" and request_obj.status not in (
            MaintenanceRequest.Status.PENDING, MaintenanceRequest.Status.IN_PROGRESS):
        raise ValueError("Only pending/in-progress requests can be cancelled.")

    request_obj.status = new_status
    if cost is not None:
        request_obj.cost = Decimal(str(cost))
    if assigned_to:
        request_obj.assigned_to = assigned_to
    if new_status == MaintenanceRequest.Status.COMPLETED:
        request_obj.resolved_at = timezone.now()
        if resolution_note:
            request_obj.description = f"{request_obj.description}\n\nResolution: {resolution_note}"
    request_obj.save()
    return request_obj

# ── transfers ─────────────────────────────────────────────────────────────

def request_transfer(user, employee, current_house, target_house, reason):
    """Create a transfer request after validating availability + ownership."""
    if not target_house.is_available:
        raise ValueError(f"Target house {target_house.house_id} is not available.")
    if current_house is None and not employee.house_applications.filter(
            status=HouseApplication.Status.ALLOCATED, is_active=True).exists():
        raise ValueError("Employee has no current allocation to transfer from.")
    with transaction.atomic():
        transfer = HouseTransfer.objects.create(
            employee=employee,
            current_house=current_house,
            target_house=target_house,
            reason=reason,
            status=HouseTransfer.Status.PENDING,
            created_by=user,
        )
    return transfer


def decide_transfer(user, transfer, decision, notes=""):
    """
    Approve / reject a transfer. On approval the employee's current
    allocation is deallocated and the target house is allocated atomically
    (with a TRANSFERRED audit log entry).
    """
    if transfer.status != HouseTransfer.Status.PENDING:
        raise ValueError("Only pending transfers can be decided.")

    with transaction.atomic():
        transfer = HouseTransfer.objects.select_for_update().get(id=transfer.id)
        if decision == "Rejected":
            transfer.status = HouseTransfer.Status.REJECTED
            transfer.approved_by = user
            transfer.save(update_fields=["status", "approved_by", "updated_at"])
            return transfer

        if decision != "Approved":
            raise ValueError("Decision must be 'Approved' or 'Rejected'.")

        target = House.objects.select_for_update().get(id=transfer.target_house_id)
        if not target.is_available:
            raise ValueError(f"Target house {target.house_id} is no longer available.")

        allocation = (
            Allocation.objects
            .filter(application__emp_record=transfer.employee,
                    status=Allocation.Status.ACTIVE, is_active=True)
            .select_for_update()
            .first()
        )
        if allocation is None:
            raise ValueError("Employee has no live allocation to transfer.")

        old_house = allocation.house
        application = allocation.application

        # Preserve the same room when transferring a room-level allocation.
        transfer_room = allocation.room_label if (
            allocation.allocation_unit_type == Allocation.AllocationUnit.ROOM
        ) else ""

        # Terminate the previous allocation (no queue re-entry during a transfer).
        terminate_allocation(allocation, user, f"Transferred to {target.house_id}",
                             move_to_queue=False)
        # Allocate the target house (application may already be 'Allocated').
        new_allocation = allocate_application(
            application, target, user, "Manual",
            notes=f"Transferred to {target.house_id}. {notes}".strip(),
            allow_existing=True, room_label=transfer_room,
        )

        AllocationLog.objects.create(
            application=application,
            application_no=application.application_no,
            employee_name=application.employee_name,
            employee_id=application.employee_id,
            house=target,
            house_hid=target.house_id,
            action=AllocationLog.Action.TRANSFERRED,
            old_status=application.status,
            new_status=application.status,
            priority_score=application.priority_score,
            eligible_category=application.eligible_house_category,
            score_breakdown=application.score_breakdown,
            recommendation_reason=f"House transfer from {old_house.house_id if old_house else 'N/A'} to {target.house_id}",
            notes=notes,
            performed_by=user,
            performed_by_name=user.get_full_name() if user else "",
        )
        record_audit(
            application, HouseAuditTrail.Action.TRANSFERRED, user,
            old_status=application.status, new_status=application.status,
            detail={
                "from_house": old_house.house_id if old_house else None,
                "to_house": target.house_id,
                "allocation_no": new_allocation.allocation_no,
            },
            note=notes,
        )

        transfer.status = HouseTransfer.Status.APPROVED
        transfer.approved_by = user
        transfer.save(update_fields=["status", "approved_by", "updated_at"])
    return transfer


def complete_transfer(user, transfer):
    if transfer.status != HouseTransfer.Status.APPROVED:
        raise ValueError("Only approved transfers can be completed.")
    transfer.status = HouseTransfer.Status.COMPLETED
    transfer.save(update_fields=["status", "updated_at"])
    return transfer

# ── rentals ───────────────────────────────────────────────────────────────

def create_rental_contract(user, tenant, house, start_date, end_date,
                           monthly_rent, security_deposit=0, terms_conditions="",
                           application=None):
    """Create a rental contract, rejecting overlapping active contracts."""
    overlapping = RentalContract.objects.filter(
        house=house, status=RentalContract.Status.ACTIVE,
    )
    if overlapping.exists():
        raise ValueError(f"House {house.house_id} already has an active contract.")
    contract = RentalContract.objects.create(
        tenant=tenant,
        house=house,
        application=application,
        start_date=start_date,
        end_date=end_date,
        monthly_rent=Decimal(str(monthly_rent)),
        security_deposit=Decimal(str(security_deposit)),
        terms_conditions=terms_conditions,
        status=RentalContract.Status.ACTIVE,
        created_by=user,
    )
    return contract


def generate_monthly_invoices(user, billing_month, due_date, contracts=None):
    """Generate one invoice per active contract for the given billing month."""
    if contracts is None:
        contracts = RentalContract.objects.filter(status=RentalContract.Status.ACTIVE)
    created = []
    for contract in contracts:
        if contract.invoices.filter(billing_month=billing_month).exists():
            continue
        invoice = RentalInvoice.objects.create(
            contract=contract,
            tenant=contract.tenant,
            billing_month=billing_month,
            due_date=due_date,
            rent_amount=contract.monthly_rent,
            penalty_amount=Decimal("0.00"),
            paid_amount=Decimal("0.00"),
            balance=contract.monthly_rent,
            status=RentalInvoice.Status.UNPAID,
            created_by=user,
        )
        created.append(invoice)
    return created


def record_payment(user, invoice, amount_paid, method="Bank Transfer",
                   reference_no="", notes=""):
    """Record a rental payment and recompute the invoice balance/status."""
    with transaction.atomic():
        invoice = RentalInvoice.objects.select_for_update().get(id=invoice.id)
        if invoice.status == RentalInvoice.Status.CANCELLED:
            raise ValueError("Cannot pay a cancelled invoice.")
        amount = Decimal(str(amount_paid))
        if amount <= 0:
            raise ValueError("Payment amount must be positive.")
        payment = RentalPayment.objects.create(
            invoice=invoice,
            amount_paid=amount,
            payment_method=method,
            reference_no=reference_no,
            notes=notes,
            recorded_by=user,
            created_by=user,
        )
        total_paid = invoice.payments.aggregate(total=Sum("amount_paid"))["total"] or Decimal("0.00")
        invoice.paid_amount = total_paid
        invoice.save()
        return payment


def cancel_contract(user, contract, reason=""):
    """Terminate a contract and leave the house allocatable again."""
    if contract.status != RentalContract.Status.ACTIVE:
        raise ValueError("Only active contracts can be terminated.")
    contract.status = RentalContract.Status.TERMINATED
    if reason:
        contract.terms_conditions = f"{contract.terms_conditions}\n\nTerminated: {reason}".strip()
    contract.save()
    return contract

def update_overdue_invoices():
    """
    Checks all active invoices with balance > 0.
    If today's date is past the due_date, automatically updates status to OVERDUE.
    """
    today = timezone.now().date()
    unpaid_qs = RentalInvoice.objects.filter(
        is_active=True,
        balance__gt=0,
        due_date__lt=today,
        status__in=[RentalInvoice.Status.UNPAID, RentalInvoice.Status.PARTIAL]
    )
    updated_count = 0
    for inv in unpaid_qs:
        inv.status = RentalInvoice.Status.OVERDUE
        inv.save(update_fields=["status", "updated_at"])
        updated_count += 1
    return updated_count

def get_annual_rent_roll(year):
    """
    Returns annual rent matrix grouped by active contracts and 12 calendar months.
    """
    update_overdue_invoices()

    months = ["January", "February", "March", "April", "May", "June",
              "July", "August", "September", "October", "November", "December"]

    contracts = RentalContract.objects.filter(is_active=True).select_related("tenant", "house")

    rows = []
    annual_total_expected = Decimal("0.00")
    annual_total_collected = Decimal("0.00")
    annual_total_outstanding = Decimal("0.00")
    total_overdue_count = 0

    for contract in contracts:
        c_invoices = RentalInvoice.objects.filter(
            contract=contract,
            is_active=True,
            billing_month__icontains=str(year)
        )
        month_map = {}
        contract_collected = Decimal("0.00")
        contract_balance = Decimal("0.00")
        for m_idx, m_name in enumerate(months, 1):
            m_str_full = f"{m_name} {year}"
            m_str_short = f"{m_name[:3]} {year}"
            m_str_num = f"{year}-{m_idx:02d}"
            inv = c_invoices.filter(
                models.Q(billing_month__iexact=m_str_full) |
                models.Q(billing_month__iexact=m_str_short) |
                models.Q(billing_month__startswith=m_str_num) |
                models.Q(billing_month__icontains=m_name)
            ).first()
            if inv:
                contract_collected += inv.paid_amount
                contract_balance += inv.balance
                if inv.status == RentalInvoice.Status.OVERDUE:
                    total_overdue_count += 1
                month_map[m_name] = {
                    "invoice_id": str(inv.id),
                    "invoice_no": inv.invoice_no,
                    "billing_month": inv.billing_month,
                    "due_date": inv.due_date.isoformat() if inv.due_date else None,
                    "rent_amount": float(inv.rent_amount),
                    "paid_amount": float(inv.paid_amount),
                    "balance": float(inv.balance),
                    "status": inv.status,
                    "is_overdue_30_days": inv.status == RentalInvoice.Status.OVERDUE or (inv.due_date and (timezone.now().date() - inv.due_date).days > 30 and inv.balance > 0)
                }
            else:
                month_map[m_name] = {
                    "invoice_id": None,
                    "invoice_no": None,
                    "billing_month": m_str_full,
                    "due_date": None,
                    "rent_amount": float(contract.monthly_rent),
                    "paid_amount": 0.0,
                    "balance": float(contract.monthly_rent),
                    "status": "Unbilled",
                    "is_overdue_30_days": False
                }
        annual_total_expected += contract.monthly_rent * 12
        annual_total_collected += contract_collected
        annual_total_outstanding += contract_balance
        rows.append({
            "contract_id": str(contract.id),
            "contract_no": contract.contract_no,
            "tenant_id": contract.tenant.employee_id,
            "tenant_name": contract.tenant.full_name,
            "house_hid": contract.house.house_id,
            "house_number": contract.house.house_number,
            "monthly_rent": float(contract.monthly_rent),
            "status": contract.status,
            "months": month_map,
            "total_collected": float(contract_collected),
            "total_balance": float(contract_balance),
        })
    monthly_summaries = []
    for m_name in months:
        m_invoices = RentalInvoice.objects.filter(
            is_active=True,
            billing_month__icontains=str(year)
        ).filter(models.Q(billing_month__icontains=m_name))
        invoiced = m_invoices.aggregate(tot=Sum("rent_amount"))["tot"] or Decimal("0.00")
        collected = m_invoices.aggregate(tot=Sum("paid_amount"))["tot"] or Decimal("0.00")
        balance = m_invoices.aggregate(tot=Sum("balance"))["tot"] or Decimal("0.00")
        overdue_cnt = m_invoices.filter(status=RentalInvoice.Status.OVERDUE).count()
        status_flag = "Unpaid"
        if invoiced > 0 and balance <= 0:
            status_flag = "Paid"
        elif collected > 0 and balance > 0:
            status_flag = "Partial"
        elif overdue_cnt > 0:
            status_flag = "Overdue"
        monthly_summaries.append({
            "month_name": m_name,
            "billing_month": f"{m_name} {year}",
            "total_invoiced": float(invoiced),
            "total_collected": float(collected),
            "total_balance": float(balance),
            "overdue_count": overdue_cnt,
            "status": status_flag,
        })
    return {
        "year": year,
        "contracts_count": len(rows),
        "total_expected": float(annual_total_expected),
        "total_collected": float(annual_total_collected),
        "total_outstanding": float(annual_total_outstanding),
        "overdue_count": total_overdue_count,
        "rows": rows,
        "monthly_summaries": monthly_summaries,
    }
