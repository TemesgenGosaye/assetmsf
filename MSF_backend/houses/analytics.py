"""
Housing analytics & intelligence — enterprise command-center payloads.

Provides:
  * build_housing_analytics()      → unified KPI/occupancy/queue/allocation dashboard
  * available_house_insights()     → available units with candidate recommendations
  * detect_conflicts()             → relational-integrity / fairness conflict detection
  * recommend_allocations()        → transparent "what the engine would do" suggestions
  * occupant_register()            → live occupancy snapshot per house

Everything is read-only (no writes, no allocation side effects) so the
command center is safe to poll in real time.
"""
from collections import Counter, defaultdict
from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Sum, Q
from django.utils import timezone

from .models import (
    House, HouseApplication, Allocation, AllocationLog, HouseAuditTrail,
    HouseInspection, MaintenanceRequest, HouseTransfer, RentalContract,
    RentalInvoice,
)
from .allocation_engine import (
    determine_eligible_category, compute_mcda_score, topsis_rank,
    check_allocation_constraints, terminate_allocation, record_audit,
    CATEGORY_ORDER,
)
from .serializers import HouseApplicationDetailSerializer

HOUSE_TYPES = [choice.value for choice in House.HouseType]
CATEGORY_LABELS = {c: c for c in HOUSE_TYPES}

# ── helpers ───────────────────────────────────────────────────────────────

def _int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _num(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _parse_grade(app):
    """Normalise a job-grade string like 'Grade-6', '6', 'VI' → integer grade."""
    raw = (app.job_grade or "").strip()
    try:
        return int(raw)
    except (ValueError, TypeError):
        pass
    import re
    match = re.search(r"(\d+)", raw)
    return _int(match.group(1) if match else 0)


# ── occupancy & availability ──────────────────────────────────────────────

def _occupancy_by_type(houses):
    """Per house-type: total, active, capacity, occupied, vacant, rate."""
    rows = {}
    for htype in HOUSE_TYPES:
        pool = [h for h in houses if h.house_type == htype]
        if not pool:
            rows[htype] = {
                "total": 0, "active": 0, "capacity": 0, "occupied": 0,
                "vacant": 0, "occupancy_rate": 0.0,
            }
            continue
        capacity = sum(h.capacity for h in pool)
        occupied = sum(h.current_occupancy for h in pool)
        rows[htype] = {
            "total": len(pool),
            "active": sum(1 for h in pool if h.status == House.Status.ACTIVE),
            "capacity": capacity,
            "occupied": occupied,
            "vacant": max(capacity - occupied, 0),
            "occupancy_rate": round((occupied / capacity * 100) if capacity else 0.0, 1),
        }
    return rows


def _wait_time_stats(applications):
    waitings = [
        (timezone.now() - app.submitted_at).days
        for app in applications
        if app.submitted_at and app.status not in (HouseApplication.Status.ALLOCATED,)
    ]
    if not waitings:
        return {"count": 0, "avg_days": 0, "max_days": 0, "longest": None}
    return {
        "count": len(waitings),
        "avg_days": round(sum(waitings) / len(waitings), 1),
        "max_days": max(waitings),
        "longest": max(waitings),
    }


def _allocation_trend(days=30):
    """Allocations per day for the last N days (auto vs manual vs override)."""
    since = timezone.now() - timedelta(days=days)
    logs = AllocationLog.objects.filter(
        created_at__gte=since,
        action__in=[AllocationLog.Action.ALLOCATED, AllocationLog.Action.AUTO_ALLOCATED,
                    AllocationLog.Action.MANUAL_OVERRIDE, AllocationLog.Action.TRANSFERRED],
    )
    by_day = defaultdict(lambda: {"auto": 0, "manual": 0, "override": 0, "transfer": 0, "total": 0})
    for log in logs:
        key = log.created_at.strftime("%Y-%m-%d")
        action = str(log.action)
        if action == AllocationLog.Action.AUTO_ALLOCATED:
            by_day[key]["auto"] += 1
        elif action == AllocationLog.Action.MANUAL_OVERRIDE:
            by_day[key]["override"] += 1
        elif action == AllocationLog.Action.ALLOCATED:
            by_day[key]["manual"] += 1
        elif action == AllocationLog.Action.TRANSFERRED:
            by_day[key]["transfer"] += 1
        by_day[key]["total"] += 1

    ordered = []
    for offset in range(days - 1, -1, -1):
        day = (since + timedelta(days=offset)).date()
        key = day.strftime("%Y-%m-%d")
        row = by_day.get(key, {"auto": 0, "manual": 0, "override": 0, "transfer": 0, "total": 0})
        ordered.append({"date": key, **row})
    return ordered


def _alerts(houses, applications, contracts, invoices, inspections, maintenance, transfers):
    """Operational alerts surfaced in the command center."""
    alerts = []
    now = timezone.now()

    # 1. Long-waiting applicants (unallocated, submitted ≥ 60 days).
    for app in applications:
        if app.status not in ("Allocated", "Rejected", "Returned", "Draft") and app.submitted_at:
            days = (now - app.submitted_at).days
            if days >= 60:
                alerts.append({
                    "severity": "warning" if days < 120 else "critical",
                    "kind": "long_wait",
                    "title": f"Long wait: {app.employee_name} ({app.application_no})",
                    "detail": f"Waiting {days} days in '{app.status}' status.",
                    "application_id": str(app.id),
                })

    # 2. Disabled applicants still waiting.
    for app in applications:
        if app.has_disability and app.status not in ("Allocated", "Rejected", "Returned", "Draft"):
            alerts.append({
                "severity": "warning",
                "kind": "disability_pending",
                "title": f"Disability priority pending: {app.employee_name}",
                "detail": "Applicant flagged with a disability is awaiting allocation.",
                "application_id": str(app.id),
            })

    # 3. Vacant houses vs waiting applicants by category (supply/demand gap).
    waiting = [a for a in applications if a.status == "Waiting for Allocation"]
    demand = Counter(a.eligible_house_category or a.requested_house_category for a in waiting)
    available_pool = [h for h in houses if h.is_available]
    for htype in HOUSE_TYPES:
        vacant = sum(1 for h in available_pool if h.house_type == htype)
        want = demand.get(htype, 0)
        if want > 0 and vacant == 0:
            alerts.append({
                "severity": "info",
                "kind": "supply_gap",
                "title": f"No vacant {CATEGORY_LABELS[htype]} units",
                "detail": f"{want} waiting applicant(s) eligible for {CATEGORY_LABELS[htype]} but none available.",
            })

    # 4. Damaged / inactive houses awaiting repair.
    damaged = [h for h in houses if h.status == House.Status.INACTIVE and h.damaged_items]
    for h in damaged[:5]:
        alerts.append({
            "severity": "warning",
            "kind": "damaged_house",
            "title": f"Damaged unit: {h.house_id}",
            "detail": f"{h.location} – {', '.join(h.damaged_items)} need(s) repair before re-allocation.",
            "house_id": str(h.id),
        })

    # 5. Overdue maintenance requests.
    for req in maintenance:
        if req.status == MaintenanceRequest.Status.IN_PROGRESS and req.created_at < now - timedelta(days=7):
            alerts.append({
                "severity": "warning",
                "kind": "maintenance_overdue",
                "title": f"Maintenance overdue: {req.title}",
                "detail": f"{req.house.house_id} · open {max((now - req.created_at).days, 1)} days ({req.priority} priority).",
                "request_id": str(req.id),
            })

    # 6. Upcoming / overdue inspections.
    for insp in inspections:
        if insp.status == HouseInspection.Status.SCHEDULED:
            delta = insp.scheduled_date - now
            if delta < timedelta(hours=0):
                alerts.append({
                    "severity": "warning",
                    "kind": "inspection_due",
                    "title": f"Inspection overdue: {insp.house.house_id}",
                    "detail": f"'{insp.inspection_type}' was scheduled for {insp.scheduled_date.strftime('%b %d, %Y %H:%M')}.",
                })
            elif delta < timedelta(days=3):
                alerts.append({
                    "severity": "info",
                    "kind": "inspection_upcoming",
                    "title": f"Inspection upcoming: {insp.house.house_id}",
                    "detail": f"'{insp.inspection_type}' due {insp.scheduled_date.strftime('%b %d, %H:%M')}.",
                })

    # 7. Contracts expiring within 30 days.
    horizon = now.date() + timedelta(days=30)
    for contract in contracts:
        if contract.status == RentalContract.Status.ACTIVE and contract.end_date:
            if contract.end_date <= horizon:
                alerts.append({
                    "severity": "warning",
                    "kind": "contract_expiring",
                    "title": f"Contract expiring: {contract.contract_no}",
                    "detail": f"{contract.tenant.full_name} · {contract.house.house_id} expires {contract.end_date}.",
                })

    # 8. Overdue invoices.
    for inv in invoices:
        if inv.status in (RentalInvoice.Status.UNPAID, RentalInvoice.Status.PARTIAL) and inv.due_date and inv.due_date < now.date():
            days = (now.date() - inv.due_date).days
            alerts.append({
                "severity": "warning" if days < 30 else "critical",
                "kind": "invoice_overdue",
                "title": f"Invoice {inv.invoice_no} overdue ({days}d)",
                "detail": f"Balance {inv.balance} for {inv.tenant.full_name}.",
            })

    # 9. Pending transfer requests.
    for tr in transfers:
        if tr.status == HouseTransfer.Status.PENDING:
            alerts.append({
                "severity": "info",
                "kind": "transfer_pending",
                "title": f"Transfer pending: {tr.employee.full_name}",
                "detail": f"{tr.current_house.house_id if tr.current_house else 'N/A'} → {tr.target_house.house_id}",
            })

    alerts.sort(key=lambda a: {"critical": 0, "warning": 1, "info": 2}[a["severity"]])
    return {
        "critical": sum(1 for a in alerts if a["severity"] == "critical"),
        "warning": sum(1 for a in alerts if a["severity"] == "warning"),
        "info": sum(1 for a in alerts if a["severity"] == "info"),
        "items": alerts[:30],
    }


# ── public builders ───────────────────────────────────────────────────────

def build_housing_analytics(user=None):
    """
    Unified enterprise command-center payload.
    Scoped to active records; requester/applicant users see a personal view.
    """
    houses = list(House.objects.filter(is_active=True).select_related("created_by"))

    apps_qs = HouseApplication.objects.filter(is_active=True)
    if user is not None and user.is_requester():
        apps_qs = apps_qs.filter(requester=user)
    applications = list(apps_qs.select_related("requester", "allocated_house"))

    total_capacity = sum(h.capacity for h in houses)
    occupied = sum(h.current_occupancy for h in houses)
    vacant_total = max(total_capacity - occupied, 0)

    status_counts = Counter(app.status for app in applications)
    active_houses = [h for h in houses if h.status == House.Status.ACTIVE]
    available = [h for h in active_houses if h.is_available]

    eligible_by_category = Counter(
        app.eligible_house_category or app.requested_house_category
        for app in applications
        if app.status in (HouseApplication.Status.VERIFIED,
                          HouseApplication.Status.WAITING_FOR_ALLOCATION)
    )

    contracts = list(RentalContract.objects.filter(status=RentalContract.Status.ACTIVE))
    invoices = list(RentalInvoice.objects.select_related("tenant"))
    inspections = list(HouseInspection.objects.filter(
        status=HouseInspection.Status.SCHEDULED,
        scheduled_date__lte=timezone.now() + timedelta(days=3),
    ))
    maintenance = list(MaintenanceRequest.objects.exclude(
        status__in=[MaintenanceRequest.Status.COMPLETED, MaintenanceRequest.Status.CANCELLED],
    ))
    transfers = list(HouseTransfer.objects.filter(status=HouseTransfer.Status.PENDING))

    contract_revenue = sum(float(c.monthly_rent) for c in contracts)
    outstanding = sum(_num(inv.balance) for inv in invoices)

    return {
        "kpis": {
            "total_houses": len(houses),
            "active_houses": len(active_houses),
            "inactive_houses": len(houses) - len(active_houses),
            "total_capacity": total_capacity,
            "occupied_units": occupied,
            "vacant_units": vacant_total,
            "occupancy_rate": round((occupied / total_capacity * 100) if total_capacity else 0.0, 1),
            "available_houses": len(available),
            "total_applications": len(applications),
            "waiting_for_allocation": status_counts.get("Waiting for Allocation", 0),
            "allocated": status_counts.get("Allocated", 0),
            "under_review": status_counts.get("Under Review", 0),
            "verified": status_counts.get("Verified", 0),
            "submitted": status_counts.get("Submitted", 0),
            "rejected": status_counts.get("Rejected", 0),
            "guest_houses": sum(1 for h in houses if h.allocation_category == House.AllocationCategory.GUEST),
            "active_contracts": len(contracts),
            "monthly_rent_revenue": round(contract_revenue, 2),
            "outstanding_rent": round(outstanding, 2),
            "open_maintenance": len(maintenance),
            "pending_transfers": len(transfers),
        },
        "occupancy_by_type": _occupancy_by_type(houses),
        "applications_by_status": dict(status_counts),
        "eligible_by_category": dict(eligible_by_category),
        "queue_stats": {
            "waiting": status_counts.get("Waiting for Allocation", 0),
            "verified": status_counts.get("Verified", 0),
            **_wait_time_stats(applications),
        },
        "allocation_trend_30d": _allocation_trend(days=30),
        "allocation_actions": dict(
            AllocationLog.objects.values_list("action")
            .annotate(count=Count("id"))
            .values_list("action", "count")
        ),
        "alerts": _alerts(houses, applications, contracts, invoices, inspections, maintenance, transfers),
    }


def available_house_insights():
    """Available regular/guest units with live occupancy + condition + best candidate."""
    houses = [
        h for h in House.objects.filter(
            is_active=True, status=House.Status.ACTIVE,
        ).select_related("created_by")
        if h.is_available
    ]
    config = None
    from .models import ScoringConfig
    config = ScoringConfig.objects.filter(is_active=True).first()

    # Get IDs or employee identifiers of employees who already hold an active allocation
    allocated_employee_ids = set(
        Allocation.objects.filter(status=Allocation.Status.ACTIVE)
        .exclude(emp_record=None)
        .values_list("emp_record_id", flat=True)
    )
    allocated_employee_names = set(
        Allocation.objects.filter(status=Allocation.Status.ACTIVE)
        .values_list("employee_id", flat=True)
    )

    insights = []
    for house in sorted(houses, key=lambda h: (h.allocation_category, h.house_type, h.house_id)):
        candidates = []
        for c in HouseApplication.objects.filter(
            status__in=[
                HouseApplication.Status.VERIFIED,
                HouseApplication.Status.WAITING_FOR_ALLOCATION,
            ],
            is_active=True,
        ).select_related("requester", "allocated_house", "emp_record"):
            # Exclude employees who already have an active house allocation
            if c.emp_record_id and c.emp_record_id in allocated_employee_ids:
                continue
            if c.employee_id and c.employee_id in allocated_employee_names:
                continue
            candidates.append(c)
        eligible = []
        for c in candidates:
            ec, _ = determine_eligible_category(c)
            if CATEGORY_ORDER.get(house.house_type, 0) <= CATEGORY_ORDER.get(ec, 0):
                eligible.append(c)
        ranked = topsis_rank(eligible, config) if eligible else []
        best = None
        if ranked:
            top_app, top_score, top_breakdown, top_reasons, top_cc = ranked[0]
            ok, constraint_reason = check_allocation_constraints(top_app, house)
            best = {
                "application_id": str(top_app.id),
                "application_no": top_app.application_no,
                "employee_id": top_app.employee_id,
                "employee_name": top_app.employee_name,
                "eligible_category": top_app.eligible_house_category,
                "score": round(_num(top_score), 2),
                "closeness": round(_num(top_cc), 4),
                "constraint_ok": ok,
                "constraint_reason": constraint_reason,
                "reasons": top_reasons[:6],
            }
        insights.append({
            "house_id": str(house.id),
            "hid": house.house_id,
            "house_number": house.house_number,
            "house_type": house.house_type,
            "location": house.location,
            "capacity": house.capacity,
            "current_occupancy": house.current_occupancy,
            "vacant": house.vacant,
            "allocation_category": house.allocation_category,
            "damaged_items": house.damaged_items if house.status == House.Status.INACTIVE else [],
            "recommended_candidate": best,
        })
    return insights


def detect_conflicts(user=None):
    """
    Detect data-integrity / fairness conflicts before they turn into
    operational incidents. Returns grouped findings (never auto-fixes).
    """
    conflicts = []
    now = timezone.now()

    # 1. Duplicate active applications for the same employee.
    apps = list(HouseApplication.objects.filter(is_active=True).select_related("requester", "allocated_house"))
    by_employee = defaultdict(list)
    for app in apps:
        if app.status not in (HouseApplication.Status.REJECTED,
                              HouseApplication.Status.RETURNED,
                              HouseApplication.Status.DRAFT):
            by_employee[app.employee_id].append(app)
    for emp_id, group in by_employee.items():
        if len(group) > 1:
            conflicts.append({
                "type": "duplicate_application",
                "severity": "warning",
                "employee_id": emp_id,
                "employee_name": group[0].employee_name,
                "detail": f"{len(group)} live applications (one should be closed before allocation).",
                "applications": [{"id": str(a.id), "no": a.application_no, "status": a.status} for a in group],
            })

    # 2. Allocated applications whose house field is missing.
    for app in apps:
        if app.status == HouseApplication.Status.ALLOCATED and app.allocated_house is None:
            conflicts.append({
                "type": "orphaned_allocation",
                "severity": "critical",
                "employee_id": app.employee_id,
                "employee_name": app.employee_name,
                "detail": f"Application {app.application_no} is 'Allocated' but has no house reference.",
                "applications": [{"id": str(app.id), "no": app.application_no, "status": app.status}],
            })

    # 3. Capacity breach: more live allocations than capacity.
    houses = list(House.objects.filter(is_active=True))
    for house in houses:
        live = house.allocations.filter(status="Allocated", is_active=True).count()
        if live > house.capacity:
            conflicts.append({
                "type": "capacity_breach",
                "severity": "critical",
                "house_id": str(house.id),
                "hid": house.house_id,
                "detail": f"House has {live} allocations but capacity is {house.capacity}.",
            })

    # 4. Active rental contract overlapping another on the same house.
    contracts = list(RentalContract.objects.filter(status=RentalContract.Status.ACTIVE))
    by_house = defaultdict(list)
    for c in contracts:
        by_house[c.house_id].append(c)
    for hid, group in by_house.items():
        if len(group) > 1:
            conflicts.append({
                "type": "overlapping_contract",
                "severity": "critical",
                "house_id": str(group[0].house_id),
                "hid": group[0].house.house_id,
                "detail": f"{len(group)} active contracts on one house.",
                "contracts": [{"no": c.contract_no, "tenant": c.tenant.full_name} for c in group],
            })

    # 5. Transfer targeting a house that is already full.
    for tr in HouseTransfer.objects.filter(status=HouseTransfer.Status.PENDING).select_related("target_house", "current_house", "employee"):
        if not tr.target_house.is_available and tr.status == HouseTransfer.Status.PENDING:
            conflicts.append({
                "type": "transfer_target_full",
                "severity": "warning",
                "transfer_id": str(tr.id),
                "employee_name": tr.employee.full_name,
                "detail": f"Transfer to {tr.target_house.house_id} — target is at capacity.",
            })

    # 6. Applicant holds an allocation but has another active non-terminal application.
    allocated = [a for a in apps if a.status == HouseApplication.Status.ALLOCATED]
    allocated_ids = {a.employee_id for a in allocated}
    for app in apps:
        if (app.status in (HouseApplication.Status.SUBMITTED,
                           HouseApplication.Status.UNDER_REVIEW,
                           HouseApplication.Status.VERIFIED,
                           HouseApplication.Status.WAITING_FOR_ALLOCATION)
                and app.employee_id in allocated_ids):
            conflicts.append({
                "type": "already_allocated",
                "severity": "warning",
                "employee_id": app.employee_id,
                "employee_name": app.employee_name,
                "detail": f"{app.employee_name} already has an allocation but application {app.application_no} is still live.",
                "applications": [{"id": str(app.id), "no": app.application_no, "status": app.status}],
            })

    return sorted(conflicts, key=lambda c: {"critical": 0, "warning": 1}[c["severity"]])


# ── conflict resolution (opt-in, audited) ──────────────────────────────────
# `detect_conflicts` is deliberately read-only. These resolvers are the
# explicit "fix it" actions an admin can invoke from the command center; every
# mutation is audited via HouseAuditTrail + AllocationLog so nothing happens
# silently.

def _reset_application_to_queue(app, user, note):
    """Reset a misplaced application to the allocation queue (no house ref)."""
    old_status = app.status
    app.status = HouseApplication.Status.WAITING_FOR_ALLOCATION
    app.allocated_house = None
    app.allocated_at = None
    app.allocated_by = None
    app.allocation_notes = ""
    app.allocation_confidence = 0
    app.deallocation_reason = note
    app.save(update_fields=[
        "status", "allocated_house", "allocated_at", "allocated_by",
        "allocation_notes", "allocation_confidence", "deallocation_reason",
        "updated_at",
    ])
    AllocationLog.objects.create(
        application=app,
        house=None,
        application_no=app.application_no,
        employee_name=app.employee_name,
        employee_id=app.employee_id,
        action=AllocationLog.Action.STATUS_CHANGED,
        old_status=old_status,
        new_status=app.status,
        notes=note,
        performed_by=user,
        performed_by_name=getattr(user, "name", "") or getattr(user, "username", ""),
    )
    record_audit(app, HouseAuditTrail.Action.STATUS_CHANGED, user,
                 old_status=old_status, new_status=app.status,
                 note=f"Conflict resolution: {note}")


def _return_application(app, user, note):
    """Close a redundant live application (Returned) with full audit."""
    old_status = app.status
    app.status = HouseApplication.Status.RETURNED
    app.returned_reason = note
    app.save(update_fields=["status", "returned_reason", "updated_at"])
    AllocationLog.objects.create(
        application=app,
        house=None,
        application_no=app.application_no,
        employee_name=app.employee_name,
        employee_id=app.employee_id,
        action=AllocationLog.Action.STATUS_CHANGED,
        old_status=old_status,
        new_status=app.status,
        notes=note,
        performed_by=user,
        performed_by_name=getattr(user, "name", "") or getattr(user, "username", ""),
    )
    record_audit(app, HouseAuditTrail.Action.STATUS_CHANGED, user,
                 old_status=old_status, new_status=app.status, note=note)


def resolve_orphaned_allocation(app_id, user):
    """Application says 'Allocated' but carries no house reference."""
    app = HouseApplication.objects.filter(id=app_id, is_active=True).first()
    if app is None:
        raise ValueError("Application not found")
    if app.status != HouseApplication.Status.ALLOCATED:
        raise ValueError("Application is not in Allocated status")
    if app.allocated_house is not None:
        raise ValueError("Application already has a house reference")
    _reset_application_to_queue(app, user, "Orphaned allocation fixed — returned to allocation queue.")
    return app


def resolve_capacity_breach(house_id, user):
    """More live 'Allocated' applications than capacity → free the extras."""
    house = House.objects.filter(id=house_id, is_active=True).first()
    if house is None:
        house = House.objects.filter(house_id=house_id, is_active=True).first()
    if house is None:
        raise ValueError("House not found")

    live = list(
        house.allocations
        .filter(status=HouseApplication.Status.ALLOCATED, is_active=True)
        .order_by("allocated_at", "created_at")
    )
    overflow = live[house.capacity:]
    if not overflow:
        raise ValueError("House is not over capacity")

    freed = []
    for app in overflow:
        allocation = app.allocation_records.filter(status=Allocation.Status.ACTIVE).first()
        try:
            if allocation is not None:
                terminate_allocation(
                    allocation, user,
                    reason=f"Capacity breach resolved on {house.house_id}",
                    move_to_queue=True,
                )
            else:
                _reset_application_to_queue(
                    app, user,
                    f"Capacity breach resolved on {house.house_id} — no Allocation record.",
                )
            freed.append(app.application_no)
        except ValueError:
            continue
    return {"house_id": house.house_id, "freed": freed}


def resolve_duplicate_applications(keep_app_id, user):
    """Keep the selected application; return every other live one for the employee."""
    keep = HouseApplication.objects.filter(id=keep_app_id, is_active=True).first()
    if keep is None:
        raise ValueError("Application not found")

    duplicates = HouseApplication.objects.filter(
        employee_id=keep.employee_id,
        is_active=True,
    ).exclude(id=keep.id).exclude(status__in=[
        HouseApplication.Status.REJECTED,
        HouseApplication.Status.RETURNED,
        HouseApplication.Status.DRAFT,
        HouseApplication.Status.ALLOCATED,
    ])
    returned = []
    for app in duplicates:
        _return_application(
            app, user,
            "Duplicate application auto-returned during conflict resolution.",
        )
        returned.append(app.application_no)
    return {"kept": keep.application_no, "returned": returned}


def resolve_already_allocated(app_id, user):
    """Employee already holds an allocation — return the extra live application."""
    app = HouseApplication.objects.filter(id=app_id, is_active=True).first()
    if app is None:
        raise ValueError("Application not found")
    if app.status in (HouseApplication.Status.ALLOCATED,
                      HouseApplication.Status.REJECTED,
                      HouseApplication.Status.RETURNED,
                      HouseApplication.Status.DRAFT):
        raise ValueError("Application is not a live duplicate")
    _return_application(
        app, user,
        "Employee already allocated — redundant application returned.",
    )
    return {"application_no": app.application_no, "status": app.status}


def resolve_conflict(conflict_type, target_id, user):
    """Dispatch a conflict-resolution request. Raises ValueError when the
    conflict type is not safely auto-resolvable or the target is invalid."""
    kind = (conflict_type or "").strip()
    if kind == "orphaned_allocation":
        app = resolve_orphaned_allocation(target_id, user)
        return {"action": "orphaned_allocation", "application_no": app.application_no, "status": app.status}
    if kind == "capacity_breach":
        return {"action": "capacity_breach", **resolve_capacity_breach(target_id, user)}
    if kind == "duplicate_application":
        return {"action": "duplicate_application", **resolve_duplicate_applications(target_id, user)}
    if kind == "already_allocated":
        return {"action": "already_allocated", **resolve_already_allocated(target_id, user)}
    raise ValueError(f"Conflict type '{conflict_type}' is not auto-resolvable")


def recommend_allocations(limit=None):
    """
    Transparent recommendations: for every vacant regular house (strictly not already allocated/occupied),
    the top eligible candidate (strictly without an existing active allocation) plus an explainable reason.
    Nothing is executed.
    """
    from .models import ScoringConfig
    config = ScoringConfig.objects.filter(is_active=True).first()
    
    # Get all employees who already have an active allocation
    allocated_emp_ids = set(
        HouseApplication.objects.filter(status=HouseApplication.Status.ALLOCATED, is_active=True)
        .exclude(emp_record_id__isnull=True)
        .values_list("emp_record_id", flat=True)
    )
    allocated_emp_names = set(
        HouseApplication.objects.filter(status=HouseApplication.Status.ALLOCATED, is_active=True)
        .values_list("employee_name", flat=True)
    )

    waiting = list(
        HouseApplication.objects.filter(
            status__in=[
                HouseApplication.Status.VERIFIED,
                HouseApplication.Status.WAITING_FOR_ALLOCATION,
            ],
            is_active=True,
        ).exclude(emp_record_id__in=allocated_emp_ids)
         .exclude(employee_name__in=allocated_emp_names)
         .select_related("requester", "allocated_house")
    )
    if not waiting:
        return []

    # Strict vacancy filter: house must be active, not guest, and have 0 current occupancy with no active allocations
    vacant_houses = [
        h for h in House.objects.filter(is_active=True, status=House.Status.ACTIVE)
        .exclude(allocation_category=House.AllocationCategory.GUEST)
        .prefetch_related("allocations")
        if h.is_available and h.current_occupancy == 0 and not h.allocations.filter(status="Allocated", is_active=True).exists()
    ]

    # Pre-compute scores once so ranking is consistent across houses.
    scored = {}
    for app in waiting:
        cat, _ = determine_eligible_category(app)
        total, breakdown, reasons = compute_mcda_score(app, config)
        scored[app.id] = (cat, total, breakdown, reasons)

    recommendations = []
    for house in sorted(vacant_houses, key=lambda h: (h.house_type, h.house_id)):
        candidates = []
        for app in waiting:
            cat, total, breakdown, reasons = scored[app.id]
            if CATEGORY_ORDER.get(house.house_type, 0) <= CATEGORY_ORDER.get(cat, 0):
                ok, constraint_reason = check_allocation_constraints(app, house)
                if ok:  # Only consider candidates satisfying all hard constraints
                    candidates.append((app, total, breakdown, reasons, ok, constraint_reason))
        if not candidates:
            recommendations.append({
                "house_id": str(house.id),
                "hid": house.house_id,
                "house_number": house.house_number,
                "house_type": house.house_type,
                "location": house.location,
                "candidate": None,
                "reason": "No eligible unallocated applicants in the live pool for this unit.",
            })
            continue

        candidates.sort(key=lambda c: c[1], reverse=True)
        top = candidates[0]
        app, total, breakdown, reasons, ok, constraint_reason = top
        reasons_text = "; ".join(reasons) if reasons else "Highest weighted priority score."
        recommendations.append({
            "house_id": str(house.id),
            "hid": house.house_id,
            "house_number": house.house_number,
            "house_type": house.house_type,
            "location": house.location,
            "candidate": {
                "application_id": str(app.id),
                "application_no": app.application_no,
                "employee_id": app.employee_id,
                "employee_name": app.employee_name,
                "eligible_category": app.eligible_house_category or scored[app.id][0],
                "score": round(_num(total), 2),
                "waiting_days": app.waiting_days,
                "has_disability": app.has_disability,
                "family_size": app.family_size,
            },
            "constraint_ok": ok,
            "reason": reasons_text,
        })
    return recommendations if limit is None else recommendations[:limit]


def occupant_register():
    """
    Live occupancy snapshot — every house with its current occupants.
    """
    houses = list(
        House.objects.filter(is_active=True).select_related("created_by")
        .prefetch_related("allocations")
    )
    register = []
    for house in houses:
        occupants = list(
            house.allocations.filter(status="Allocated", is_active=True)
            .select_related("requester", "allocated_by")
        )
        register.append({
            "house_id": str(house.id),
            "hid": house.house_id,
            "house_number": house.house_number,
            "house_type": house.house_type,
            "location": house.location,
            "allocation_category": house.allocation_category,
            "status": house.status,
            "capacity": house.capacity,
            "current_occupancy": len(occupants),
            "vacant": max(house.capacity - len(occupants), 0),
            "occupants": [
                {
                    "application_id": str(o.id),
                    "application_no": o.application_no,
                    "employee_id": o.employee_id,
                    "employee_name": o.employee_name,
                    "allocated_at": o.allocated_at.isoformat() if o.allocated_at else None,
                    "allocated_by": o.allocated_by.get_full_name() if o.allocated_by else None,
                }
                for o in occupants
            ],
        })
    return register
