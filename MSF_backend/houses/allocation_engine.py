"""
Allocation Engine — hybrid MCDA + TOPSIS + FIFO + Constraint Satisfaction
powering the enterprise house review/allocation pipeline.

Pipeline:
  1. analyze_eligibility      → per-rule XAI eligibility breakdown
  2. compute_mcda_score       → weighted MCDA priority score (configurable)
  3. topsis_rank              → TOPSIS closeness ranking over the queue
  4. compute_house_compatibility → house_opp fit score for an applicant
  5. generate_opportunities   → materialise HouseOpportunity (house_opp) rows
  6. rank_opportunities       → ranked shortlist with recommendations
  7. allocate_application     → atomic allocation (row locks, double-allocation
                               prevention, allocation record, audit, XAI)

Every allocation writes an authoritative `Allocation` record (single source of
truth for occupancy), syncs the application projection, updates the house_opp
lifecycle, and appends to both AllocationLog (legacy) and HouseAuditTrail.
"""
import math
from collections import defaultdict
from decimal import Decimal
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import (
    House, HouseApplication, EligibilityRule,
    ScoringConfig, AllocationLog, HouseOpportunity, Allocation, HouseAuditTrail,
)


# ── constants ─────────────────────────────────────────────────────────────

GRADE_ORDER = {
    "Staff": 6, "A": 5, "B": 4, "C": 3, "D": 2, "E": 1,
}

CATEGORY_ORDER = {"Staff": 6, "A": 5, "B": 4, "C": 3, "D": 2, "E": 1}

ALLOCATION_MODE_ROOM = "ROOM_ALLOCATION"
ALLOCATION_MODE_HOUSE = "HOUSE_ALLOCATION"

ALLOCATION_MODE_LABELS = {
    ALLOCATION_MODE_ROOM: "Room (single applicant)",
    ALLOCATION_MODE_HOUSE: "Whole house (family)",
}


def determine_allocation_mode(application):
    """
    Auto-detect the allocation unit for an application:
      * Single applicants with family size ≤ 1 → ROOM_ALLOCATION
        (recommend/allocate House Number + Room Number).
      * Married (or family size ≥ 2)          → HOUSE_ALLOCATION
        (recommend/allocate the whole house).

    Returns (mode, reason).
    """
    try:
        family_size = int(application.family_size or 1)
    except (TypeError, ValueError):
        family_size = 1
    marital = str(application.marital_status or "").strip()

    if marital.lower() == "single" and family_size <= 1:
        mode = ALLOCATION_MODE_ROOM
        reason = (
            f"Single applicant ({marital or 'Single'}) with family size {family_size} "
            "— allocate a single room within a house."
        )
    else:
        mode = ALLOCATION_MODE_HOUSE
        reason = (
            f"{marital or 'Unknown'} with family size {family_size} "
            "— allocate the whole house."
        )
    return mode, reason


def resource_label(house, room_label=""):
    """Human-readable resource string, e.g. 'S2 — Room R2' or 'A1'."""
    base = house.house_number or house.house_id
    if room_label:
        return f"{base} — Room {room_label}"
    return base


def room_available(house, room, exclude_allocation_id=None):
    """
    A room is allocatable when it is physically Vacant, the house is not held
    by an active whole-house allocation, and the room carries no active
    room-level allocation.
    """
    if not room:
        return False
    if room.get("status") != House.RoomStatus.VACANT:
        return False
    active = house.allocation_records.filter(status=Allocation.Status.ACTIVE)
    if active.filter(allocation_unit_type=ALLOCATION_MODE_HOUSE).exists():
        return False
    room_qs = active.filter(
        allocation_unit_type=ALLOCATION_MODE_ROOM,
        room_label=room["label"],
    )
    if exclude_allocation_id:
        room_qs = room_qs.exclude(id=exclude_allocation_id)
    return not room_qs.exists()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  AUDIT HELPER
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def record_audit(application, action, user=None, old_status="", new_status="",
                 detail=None, note=""):
    """Append an immutable entry to the per-application audit timeline."""
    HouseAuditTrail.objects.create(
        application=application,
        action=action,
        actor=user,
        actor_name=user.get_full_name() if user else "",
        old_status=old_status or "",
        new_status=new_status or "",
        detail=dict(detail or {}),
        note=note or "",
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  1. ELIGIBILITY (explainable)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def analyze_eligibility(application):
    """
    Evaluate every active eligibility rule against the application.

    Returns (results: list[dict], best_category: str) where each result is
    {rule_id, house_type, passed, reason, priority} — the XAI payload shown
    in the review workspace.
    """
    rules = list(EligibilityRule.objects.filter(is_active=True).order_by("priority", "-max_grade"))
    results = []
    best = None
    best_rank = 0

    for rule in rules:
        passed, reason = rule.is_eligible(application)
        results.append({
            "rule_id": str(rule.id),
            "house_type": rule.house_type,
            "passed": passed,
            "reason": reason,
            "priority": rule.priority,
        })
        if passed:
            grade_rank = CATEGORY_ORDER.get(rule.house_type, 0)
            if grade_rank > best_rank:
                best = rule.house_type
                best_rank = grade_rank

    if best is None:
        best = application.requested_house_category or "E"

    return results, best


def determine_eligible_category(application):
    """
    Determine the house type an employee qualifies for based on job grade:
      * > 17  → Staff
      * 15–17 → A
      * 12–14 → B
      * 10–11 → C
      * 7–9   → D
      * < 7   → E
    Returns (category_str, reason_str).
    """
    try:
        grade = int(str(application.job_grade or "").strip())
    except (TypeError, ValueError):
        grade = 0

    if grade > 17:
        cat = "Staff"
    elif grade >= 15:
        cat = "A"
    elif grade >= 12:
        cat = "B"
    elif grade >= 10:
        cat = "C"
    elif grade >= 7:
        cat = "D"
    else:
        cat = "E"

    return cat, f"Eligible for {cat} based on job grade {grade}"


def check_allocation_constraints(application, house, room=None, allocation_mode=None,
                                 allow_existing=False):
    """
    Verify hard constraints before allocation.
    `room` is a room dict {label, index, status, ...} required for ROOM_ALLOCATION.
    Returns (ok: bool, reason: str).
    """
    if allocation_mode is None:
        allocation_mode, _ = determine_allocation_mode(application)

    reasons = []

    if application.status == HouseApplication.Status.ALLOCATED and not allow_existing:
        reasons.append("Application is already allocated")

    if house.status != House.Status.ACTIVE:
        reasons.append(f"House {house.house_id} is inactive (needs repair)")

    # Authoritative occupancy from live Allocation records only.
    active_allocations = house.allocation_records.filter(status=Allocation.Status.ACTIVE)

    if allocation_mode == ALLOCATION_MODE_ROOM:
        if room is None:
            room = house.available_rooms[0] if house.available_rooms else None
        if room is None:
            reasons.append(f"House {house.house_id} has no available rooms")
        else:
            if room.get("status") != House.RoomStatus.VACANT:
                reasons.append(
                    f"Room {room['label']} in {house.house_id} is {room.get('status') or 'unavailable'}"
                )
            if active_allocations.filter(allocation_unit_type=ALLOCATION_MODE_HOUSE).exists():
                reasons.append(f"House {house.house_id} is held by a whole-house allocation")
            if active_allocations.filter(
                allocation_unit_type=ALLOCATION_MODE_ROOM,
                room_label=room["label"],
            ).exists():
                reasons.append(f"Room {room['label']} in {house.house_id} is already allocated")
    else:
        active_count = active_allocations.count()
        if active_count >= max(house.capacity, 1):
            reasons.append(f"House {house.house_id} is already allocated/occupied")
        if active_count > 0:
            reasons.append(
                f"House {house.house_id} is partially occupied and cannot be allocated as a whole house"
            )

    eligible_cat, _ = determine_eligible_category(application)
    if CATEGORY_ORDER.get(house.house_type, 0) > CATEGORY_ORDER.get(eligible_cat, 0):
        reasons.append(f"House type {house.house_type} exceeds eligible category {eligible_cat}")

    already_allocated = (
        Allocation.objects.filter(
            Q(application__emp_record_id=application.emp_record_id) | Q(employee_name=application.employee_name),
            status=Allocation.Status.ACTIVE,
        ).exclude(application_id=application.id).exists()
        if (application.emp_record_id or application.employee_name)
        else False
    )
    if already_allocated:
        reasons.append("Employee already has an active allocation")

    return (len(reasons) == 0, "; ".join(reasons) if reasons else "All constraints satisfied")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  2. MCDA SCORING
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _normalise(value, max_value):
    """Min-max normalise to [0, 1]."""
    if max_value <= 0:
        return 0.0
    return min(max(float(value) / float(max_value), 0.0), 1.0)


def compute_mcda_score(application, config=None):
    """
    Compute weighted MCDA score for one application.
    Returns (score: Decimal, breakdown: dict, reasons: list[str]).

    Breakdown format (XAI):
    {
      "job_grade":        {"raw": "17", "normalised": 0.85, "weight": 30, "contribution": 25.5},
      "years_of_service": {"raw": 12,   "normalised": 0.60, "weight": 25, "contribution": 15.0},
      ...
    }
    """
    if config is None:
        config = ScoringConfig.objects.filter(is_active=True).first()
    if config is None:
        config = ScoringConfig(name="Default", is_active=True)

    weights = config.weight_map
    breakdown = {}
    reasons = []

    # ── Job Grade ─────────────────────────────────────────────────────────
    try:
        grade = int(application.job_grade)
    except (ValueError, TypeError):
        grade = 0
    grade_norm = _normalise(grade, 30)
    grade_contrib = grade_norm * weights["job_grade"]
    breakdown["job_grade"] = {
        "raw": str(grade), "normalised": round(grade_norm, 4),
        "weight": weights["job_grade"], "contribution": round(grade_contrib, 4),
    }
    if grade >= 17:
        reasons.append(f"High grade ({grade}) boosts score significantly")

    # ── Years of Service ──────────────────────────────────────────────────
    service = max(application.years_of_service, 0)
    service_norm = _normalise(service, 30)
    service_contrib = service_norm * weights["years_of_service"]
    breakdown["years_of_service"] = {
        "raw": service, "normalised": round(service_norm, 4),
        "weight": weights["years_of_service"], "contribution": round(service_contrib, 4),
    }
    if service >= 10:
        reasons.append(f"Long service ({service} years) increases priority")

    # ── Family Size ───────────────────────────────────────────────────────
    fam = max(application.family_size, 1)
    fam_norm = _normalise(fam, 10)
    fam_contrib = fam_norm * weights["family_size"]
    breakdown["family_size"] = {
        "raw": fam, "normalised": round(fam_norm, 4),
        "weight": weights["family_size"], "contribution": round(fam_contrib, 4),
    }
    if fam >= 4:
        reasons.append(f"Large family ({fam}) increases housing need")

    # ── Disability ────────────────────────────────────────────────────────
    dis = 1.0 if application.has_disability else 0.0
    dis_contrib = dis * weights["disability"]
    breakdown["disability"] = {
        "raw": application.has_disability, "normalised": dis,
        "weight": weights["disability"], "contribution": round(dis_contrib, 4),
    }
    if application.has_disability:
        reasons.append("Disability priority applied")

    # ── FIFO / Waiting Time ──────────────────────────────────────────────
    wait = max(application.waiting_days, 0)
    wait_norm = _normalise(wait, 365)
    fifo_contrib = wait_norm * weights["fifo"]
    breakdown["fifo"] = {
        "raw": wait, "normalised": round(wait_norm, 4),
        "weight": weights["fifo"], "contribution": round(fifo_contrib, 4),
    }
    if wait > 90:
        reasons.append(f"Extended waiting period ({wait} days)")

    # ── Marital Status ────────────────────────────────────────────────────
    married = 1.0 if application.marital_status == "Married" else 0.0
    marital_contrib = married * weights["marital_status"]
    breakdown["marital_status"] = {
        "raw": application.marital_status, "normalised": married,
        "weight": weights["marital_status"], "contribution": round(marital_contrib, 4),
    }

    # ── Employment Type ─────────────────────────────────────────────────
    pos_type = application.position_type or application.job_type or "Permanent"
    emp_type_norm = {
        "Permanent": 1.0,
        "Half Permanent": 0.6,
        "Seasonal": 0.3,
        "PPL": 0.2,
        "Semi Permanent": 0.6,
    }.get(pos_type, 0.4)
    emp_contrib = emp_type_norm * weights["employment_type"]
    breakdown["employment_type"] = {
        "raw": pos_type, "normalised": emp_type_norm,
        "weight": weights["employment_type"], "contribution": round(emp_contrib, 4),
    }

    # ── Medical Priority ──────────────────────────────────────────────────
    med = 0.0
    med_contrib = med * weights["medical_priority"]
    breakdown["medical_priority"] = {
        "raw": 0, "normalised": med,
        "weight": weights["medical_priority"], "contribution": round(med_contrib, 4),
    }

    total = Decimal(str(round(
        grade_contrib + service_contrib + fam_contrib +
        dis_contrib + fifo_contrib + marital_contrib +
        emp_contrib + med_contrib, 4
    )))

    if not reasons:
        reasons.append("Standard evaluation — no special priority factors")

    return total, breakdown, reasons


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  3. TOPSIS RANKING
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _euclidean_distance(values, reference):
    """Euclidean distance between a decision vector and a reference point."""
    return math.sqrt(sum((v - r) ** 2 for v, r in zip(values, reference)))


def topsis_rank(applications, config=None):
    """
    Apply TOPSIS to rank applications.
    Returns list of (application, score, breakdown, reasons, closeness) tuples.
    """
    if len(applications) == 0:
        return []

    scored = []
    for app in applications:
        total, breakdown, reasons = compute_mcda_score(app, config)
        scored.append((app, total, breakdown, reasons))

    if len(scored) == 1:
        app, score, breakdown, reasons = scored[0]
        return [(app, score, breakdown, reasons, 1.0)]

    # Build decision matrix from breakdown contributions
    criteria_keys = list(scored[0][2].keys())
    matrix = []
    for app, score, breakdown, reasons in scored:
        row = [breakdown[k]["contribution"] for k in criteria_keys]
        matrix.append(row)

    n_apps = len(matrix)
    n_criteria = len(criteria_keys)

    if n_criteria == 0 or n_apps == 0:
        return [(s[0], s[1], s[2], s[3], 0.5) for s in scored]

    # Normalise columns (vector normalisation)
    col_sums_sq = [0.0] * n_criteria
    for row in matrix:
        for j in range(n_criteria):
            col_sums_sq[j] += row[j] ** 2

    norm_matrix = []
    for row in matrix:
        norm_row = []
        for j in range(n_criteria):
            denom = math.sqrt(col_sums_sq[j]) if col_sums_sq[j] > 0 else 1.0
            norm_row.append(row[j] / denom)
        norm_matrix.append(norm_row)

    # Ideal best & worst per criterion
    ideal_best = [max(norm_matrix[i][j] for i in range(n_apps)) for j in range(n_criteria)]
    ideal_worst = [min(norm_matrix[i][j] for i in range(n_apps)) for j in range(n_criteria)]

    results = []
    for i in range(n_apps):
        d_best = _euclidean_distance(norm_matrix[i], ideal_best)
        d_worst = _euclidean_distance(norm_matrix[i], ideal_worst)
        total_dist = d_best + d_worst
        cc = d_worst / total_dist if total_dist > 0 else 0.5
        app, score, breakdown, reasons = scored[i]
        results.append((app, score, breakdown, reasons, round(cc, 4)))

    results.sort(key=lambda x: x[4], reverse=True)
    return results


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  4. HOUSE COMPATIBILITY  (house_opp scoring)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def compute_house_compatibility(application, house, config=None, eligible_category=None,
                                room=None, allocation_mode=None):
    """
    Score how well a house fits an application (0–100), with explainable
    reasons. Used to generate/rank HouseOpportunity (house_opp) records.

    `room` (dict) is required for ROOM_ALLOCATION — availability is then
    evaluated at the room level and the reason includes the specific room.

    Factors:
      · category proximity    (0–40)
      · preferred location    (0–15)
      · house condition       (0–15)
      · capacity vs family    (0–15)
      · availability          (0–15)

    Returns (score: float, reasons: list[str]).
    """
    if eligible_category is None:
        eligible_category, _ = determine_eligible_category(application)

    if allocation_mode is None:
        allocation_mode, _ = determine_allocation_mode(application)

    if house.allocation_category == House.AllocationCategory.GUEST:
        return 0.0, ["Guest house excluded from regular allocation"]

    reasons = []
    score = 0.0

    cat_rank = CATEGORY_ORDER.get(house.house_type, 0)
    elig_rank = CATEGORY_ORDER.get(eligible_category, 0)

    if house.house_type == eligible_category:
        score += 40
        reasons.append(f"Exact category match ({house.house_type})")
    elif cat_rank < elig_rank:
        score += 40 * (cat_rank / max(elig_rank, 1))
        reasons.append(f"Category {house.house_type} is below eligible {eligible_category}")
    else:
        reasons.append(f"House type {house.house_type} exceeds eligible category {eligible_category}")
        return 0.0, reasons

    # Preferred location (0–15)
    if application.preferred_location and house.location and \
            application.preferred_location.strip().lower() in house.location.lower():
        score += 15
        reasons.append("Preferred location match")
    elif not application.preferred_location:
        score += 5
        reasons.append("No location preference set")

    # Condition (0–15)
    damaged = house.damaged_items
    if damaged:
        score += 15 - min(15, 5 * len(damaged))
        reasons.append(f"{len(damaged)} damaged fixture(s): {', '.join(damaged)}")
    else:
        score += 15
        reasons.append("House in good condition")

    # Capacity fit (0–15)
    capacity = max(house.capacity, 1)
    if application.family_size <= capacity:
        score += 15
        reasons.append(f"Capacity {capacity} fits family of {application.family_size}")
    elif application.family_size <= capacity * 2:
        score += 8
        reasons.append(f"Capacity {capacity} is tight for family of {application.family_size}")
    else:
        reasons.append(f"Capacity {capacity} below family size {application.family_size}")

    # Availability (0–15)
    if allocation_mode == ALLOCATION_MODE_ROOM:
        if room is None:
            room = house.available_rooms[0] if house.available_rooms else None
        if room is not None and room_available(house, room):
            score += 15
            reasons.append(
                f"Room {room['label']} in {house.house_id} is vacant and available"
            )
        else:
            label = room["label"] if room else "—"
            reasons.append(f"Room {label} in {house.house_id} is currently unavailable")
    else:
        if house.status == House.Status.ACTIVE and house.is_fully_vacant:
            score += 15
            reasons.append("House is vacant and active")
        else:
            reasons.append("House is currently full, partially occupied or inactive")

    if allocation_mode == ALLOCATION_MODE_ROOM and room is not None:
        reasons.append(f"Unit: {resource_label(house, room['label'])}")

    return round(min(score, 100.0), 4), reasons


def compute_allocation_confidence(priority_score, compatibility_score):
    """
    Blend the applicant's MCDA priority (relative to a 40-pt reference) with
    the house compatibility score into an overall 0–100 confidence figure.
    """
    base = min(max(float(priority_score) / 40.0, 0.0), 1.0) * 0.5
    comp = min(max(float(compatibility_score) / 100.0, 0.0), 1.0) * 0.5
    return round(min(base + comp, 1.0) * 100.0, 4)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  5. HOUSE OPPORTUNITIES  (house_opp pipeline)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def generate_opportunities(application, user=None):
    """
    Materialise HouseOpportunity rows for every active, non-guest house the
    applicant could plausibly be matched to. Idempotent per (application, house).

    Allocation mode decides the granularity:
      * HOUSE_ALLOCATION → one opportunity per house (room_label = "").
      * ROOM_ALLOCATION  → one opportunity per available room (room_label = label).

    Returns number of new opportunities created.
    """
    eligible_cat, _ = determine_eligible_category(application)
    mode, _ = determine_allocation_mode(application)
    candidate_houses = House.objects.filter(
        is_active=True,
        status=House.Status.ACTIVE,
    ).exclude(allocation_category=House.AllocationCategory.GUEST)

    created = 0
    with transaction.atomic():
        for house in candidate_houses:
            if mode == ALLOCATION_MODE_ROOM:
                rooms = house.available_rooms
                for room in rooms:
                    compat, reasons = compute_house_compatibility(
                        application, house, eligible_category=eligible_cat,
                        room=room, allocation_mode=mode,
                    )
                    if compat <= 0:
                        continue
                    opp, was_created = HouseOpportunity.objects.get_or_create(
                        application=application,
                        house=house,
                        room_label=room["label"],
                        defaults={
                            "allocation_mode": mode,
                            "room_label": room["label"],
                            "room_number": room["label"],
                            "eligible_category": eligible_cat,
                            "compatibility_score": Decimal(str(compat)),
                            "priority_score": application.priority_score,
                            "match_reasons": reasons,
                            "status": HouseOpportunity.Status.ELIGIBLE,
                            "created_by": user,
                        },
                    )
                    if was_created:
                        created += 1
                    else:
                        opp.allocation_mode = mode
                        opp.room_number = room["label"]
                        opp.compatibility_score = Decimal(str(compat))
                        opp.priority_score = application.priority_score
                        opp.match_reasons = reasons
                        opp.eligible_category = eligible_cat
                        opp.updated_by = user
                        opp.save(update_fields=[
                            "allocation_mode", "room_number",
                            "compatibility_score", "priority_score", "match_reasons",
                            "eligible_category", "updated_at",
                        ])
            else:
                compat, reasons = compute_house_compatibility(
                    application, house, eligible_category=eligible_cat,
                    allocation_mode=mode,
                )
                if compat <= 0:
                    continue
                opp, was_created = HouseOpportunity.objects.get_or_create(
                    application=application,
                    house=house,
                    room_label="",
                    defaults={
                        "allocation_mode": mode,
                        "eligible_category": eligible_cat,
                        "compatibility_score": Decimal(str(compat)),
                        "priority_score": application.priority_score,
                        "match_reasons": reasons,
                        "status": HouseOpportunity.Status.ELIGIBLE,
                        "created_by": user,
                    },
                )
                if was_created:
                    created += 1
                else:
                    opp.allocation_mode = mode
                    opp.compatibility_score = Decimal(str(compat))
                    opp.priority_score = application.priority_score
                    opp.match_reasons = reasons
                    opp.eligible_category = eligible_cat
                    opp.updated_by = user
                    opp.save(update_fields=[
                        "allocation_mode", "compatibility_score", "priority_score",
                        "match_reasons", "eligible_category", "updated_at",
                    ])

    record_audit(
        application, HouseAuditTrail.Action.OPPORTUNITIES_GENERATED, user,
        new_status=application.status,
        detail={"created": created, "eligible_category": eligible_cat, "allocation_mode": mode},
        note=f"Generated {created} opportunities ({ALLOCATION_MODE_LABELS.get(mode, mode)})",
    )
    return created


def rank_opportunities(application, user=None):
    """
    Recompute compatibility for every opportunity of an application, order the
    shortlist, and label each opportunity Recommended / Alternative / Not Suitable.
    Respects the application's allocation mode (room vs whole house).
    Returns number of ranked opportunities.
    """
    mode, _ = determine_allocation_mode(application)
    opps = list(application.opportunities.select_related("house"))
    if not opps:
        return 0

    scored = []
    for opp in opps:
        # Reject stale opportunities generated for the opposite unit.
        if opp.allocation_mode and opp.allocation_mode != mode:
            continue
        room = None
        if mode == ALLOCATION_MODE_ROOM:
            room = opp.house.room_for_label(opp.room_label) if opp.room_label else None
        compat, reasons = compute_house_compatibility(
            application, opp.house, eligible_category=opp.eligible_category,
            room=room, allocation_mode=mode,
        )
        scored.append((opp, compat, reasons))
    scored.sort(key=lambda x: x[1], reverse=True)

    with transaction.atomic():
        for idx, (opp, compat, reasons) in enumerate(scored, 1):
            opp.rank = idx
            opp.compatibility_score = Decimal(str(compat))
            opp.match_reasons = reasons
            opp.allocation_mode = mode
            opp.status = HouseOpportunity.Status.RANKED
            if idx == 1 and compat >= 50:
                opp.recommendation = HouseOpportunity.Recommendation.RECOMMENDED
                opp.recommendation_reason = f"Top-ranked opportunity (compatibility {compat:.1f}%)"
            elif compat >= 40:
                opp.recommendation = HouseOpportunity.Recommendation.ALTERNATIVE
                opp.recommendation_reason = "Viable alternative"
            else:
                opp.recommendation = HouseOpportunity.Recommendation.NOT_SUITABLE
                opp.recommendation_reason = "Low compatibility"
            opp.updated_by = user
            opp.save(update_fields=[
                "rank", "compatibility_score", "match_reasons", "status",
                "recommendation", "recommendation_reason", "allocation_mode",
                "updated_at",
            ])

    record_audit(
        application, HouseAuditTrail.Action.OPPORTUNITIES_RANKED, user,
        new_status=application.status,
        detail={"ranked": len(scored), "allocation_mode": mode},
        note=f"Ranked {len(scored)} opportunities ({ALLOCATION_MODE_LABELS.get(mode, mode)})",
    )
    return len(scored)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  6. ALLOCATION CORE  (atomic, double-allocation safe)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _execute_allocation(application, house, user, allocation_type,
                        override_reason="", notes="", opportunity=None,
                        allow_existing=False, room=None, room_label=""):
    """
    Atomic allocation primitive. Locks both the house and application rows,
    re-validates every constraint, then writes:
      · Allocation record (authoritative occupancy / Allocated House module)
      · application projection + status
      · HouseOpportunity lifecycle (allocated / siblings rejected)
      · AllocationLog (legacy) + HouseAuditTrail (timeline)

    `allow_existing=True` is used for transfers/reallocations where the
    application is already marked allocated.
    `room` (dict) and/or `room_label` are used for ROOM_ALLOCATION.
    """
    if allocation_type not in ("Auto", "Manual", "Override"):
        raise ValueError("allocation_type must be 'Auto', 'Manual' or 'Override'")

    allocation_mode, _ = determine_allocation_mode(application)
    if allocation_mode == ALLOCATION_MODE_HOUSE:
        room = None
        room_label = ""

    old_status = application.status

    with transaction.atomic():
        house = House.objects.select_for_update().get(id=house.id)
        application = HouseApplication.objects.select_for_update().get(id=application.id)

        if allocation_mode == ALLOCATION_MODE_ROOM:
            if room is None and room_label:
                room = house.room_for_label(room_label)
            if room is None:
                room = house.available_rooms[0] if house.available_rooms else None
            if room is not None:
                room_label = room["label"]

        ok, constraint_reason = check_allocation_constraints(
            application, house, room=room, allocation_mode=allocation_mode,
            allow_existing=allow_existing,
        )
        if not ok:
            raise ValueError(f"Constraint violation: {constraint_reason}")

        eligible_cat, _ = determine_eligible_category(application)
        compat, compat_reasons = compute_house_compatibility(
            application, house, eligible_category=eligible_cat,
            room=room, allocation_mode=allocation_mode,
        )
        confidence = compute_allocation_confidence(application.priority_score, compat)

        allocation = Allocation.objects.create(
            application=application,
            house=house,
            emp_record=application.emp_record,
            employee_id=application.employee_id,
            employee_name=application.employee_name,
            allocation_type=allocation_type,
            allocation_unit_type=allocation_mode,
            room_label=room_label,
            room_index=room["index"] if room else None,
            room_number=room["label"] if room else "",
            room_status=room.get("status", "") if room else "",
            marital_status=application.marital_status,
            family_size=application.family_size or 1,
            priority_score=application.priority_score,
            recommendation_score=Decimal(str(compat)),
            confidence=Decimal(str(confidence)),
            recommendation_reason="; ".join(compat_reasons) if compat_reasons else "Engine match",
            status=Allocation.Status.ACTIVE,
            occupancy_status=(
                Allocation.Occupancy.OCCUPIED if compat >= 40 else Allocation.Occupancy.PENDING
            ),
            allocated_at=timezone.now(),
            allocated_by=user,
            override_reason=override_reason,
            notes=notes,
            created_by=user,
        )

        # ── claim the physical room(s) ────────────────────────────────────
        if allocation_mode == ALLOCATION_MODE_HOUSE:
            house.claim_all_rooms(
                occupant_name=application.employee_name,
                occupant_id=application.employee_id,
            )
        elif room is not None:
            house.set_room_status(
                room_label, House.RoomStatus.OCCUPIED,
                occupant_name=application.employee_name,
                occupant_id=application.employee_id,
            )
        house.save()

        # ── sync application projection ───────────────────────────────────
        application.status = HouseApplication.Status.ALLOCATED
        application.allocated_house = house
        application.allocated_room_label = room_label
        application.allocated_room_number = room["label"] if room else ""
        application.allocated_at = allocation.allocated_at
        application.allocated_by = user
        application.allocation_notes = notes
        application.eligible_house_category = eligible_cat
        application.allocation_confidence = allocation.confidence
        application.allocation_mode = allocation_mode
        application.deallocation_reason = ""
        application.save()

        # ── house_opp lifecycle ───────────────────────────────────────────
        if opportunity is None:
            try:
                opportunity = HouseOpportunity.objects.get(
                    application=application, house=house, room_label=room_label,
                )
            except HouseOpportunity.DoesNotExist:
                opportunity = None

        if opportunity is not None:
            opportunity.status = HouseOpportunity.Status.ALLOCATED
            opportunity.recommendation = HouseOpportunity.Recommendation.RECOMMENDED
            opportunity.recommendation_reason = f"Allocated ({allocation_type})"
            opportunity.compatibility_score = Decimal(str(compat))
            opportunity.allocation_mode = allocation_mode
            opportunity.room_label = room_label
            opportunity.updated_by = user
            opportunity.save(update_fields=[
                "status", "recommendation", "recommendation_reason",
                "compatibility_score", "allocation_mode", "room_label",
                "updated_at",
            ])
            HouseOpportunity.objects.filter(application=application).exclude(id=opportunity.id).update(
                status=HouseOpportunity.Status.REJECTED,
                updated_by=user,
            )
        else:
            HouseOpportunity.objects.filter(application=application).update(
                status=HouseOpportunity.Status.REJECTED,
                updated_by=user,
            )

        # ── legacy AllocationLog ──────────────────────────────────────────
        AllocationLog.objects.create(
            application=application,
            application_no=application.application_no,
            employee_name=application.employee_name,
            employee_id=application.employee_id,
            house=house,
            house_hid=house.house_id,
            allocation_unit_type=allocation_mode,
            room_label=room_label,
            room_number=room["label"] if room else "",
            action={
                Allocation.AllocationType.AUTO: AllocationLog.Action.AUTO_ALLOCATED,
                Allocation.AllocationType.MANUAL: AllocationLog.Action.ALLOCATED,
                Allocation.AllocationType.OVERRIDE: AllocationLog.Action.MANUAL_OVERRIDE,
            }.get(allocation_type, AllocationLog.Action.ALLOCATED),
            old_status=old_status,
            new_status=application.status,
            priority_score=application.priority_score,
            eligible_category=eligible_cat,
            score_breakdown=application.score_breakdown,
            recommendation_reason="; ".join(compat_reasons) if compat_reasons else "Engine match",
            notes=notes or override_reason,
            performed_by=user,
            performed_by_name=user.get_full_name() if user else "",
        )

        # ── audit timeline ────────────────────────────────────────────────
        record_audit(
            application,
            {
                Allocation.AllocationType.AUTO: HouseAuditTrail.Action.AUTO_ALLOCATED,
                Allocation.AllocationType.MANUAL: HouseAuditTrail.Action.MANUAL_ALLOCATED,
                Allocation.AllocationType.OVERRIDE: HouseAuditTrail.Action.OVERRIDE_ALLOCATED,
            }.get(allocation_type, HouseAuditTrail.Action.MANUAL_ALLOCATED),
            user,
            old_status=old_status,
            new_status=application.status,
            detail={
                "allocation_no": allocation.allocation_no,
                "house_id": house.house_id,
                "room_label": room_label or None,
                "allocation_mode": allocation_mode,
                "resource": resource_label(house, room_label),
                "compatibility": float(compat),
                "confidence": float(confidence),
                "override_reason": override_reason or None,
            },
            note=notes or override_reason,
        )

    return allocation


def allocate_application(application, house, user=None, allocation_type="Manual",
                         override_reason="", notes="", allow_existing=False,
                         room=None, room_label=""):
    """Public entry point for a single allocation (auto / manual / override)."""
    return _execute_allocation(application, house, user, allocation_type,
                               override_reason=override_reason, notes=notes,
                               allow_existing=allow_existing, room=room,
                               room_label=room_label)


def terminate_allocation(allocation, user=None, reason="", move_to_queue=True):
    """
    Terminate an active allocation (deallocation). Frees occupancy and, when
    `move_to_queue` is set, returns the application to the allocation queue.
    """
    if allocation.status != Allocation.Status.ACTIVE:
        raise ValueError("Only active allocations can be terminated")

    application = allocation.application
    old_status = application.status

    with transaction.atomic():
        allocation = Allocation.objects.select_for_update().get(id=allocation.id)
        if allocation.status != Allocation.Status.ACTIVE:
            raise ValueError("Only active allocations can be terminated")

        allocation.status = Allocation.Status.TERMINATED
        allocation.occupancy_status = Allocation.Occupancy.VACATED
        allocation.terminated_at = timezone.now()
        allocation.terminated_by = user
        allocation.termination_reason = reason
        allocation.updated_by = user
        allocation.save(update_fields=[
            "status", "occupancy_status", "terminated_at", "terminated_by",
            "termination_reason", "updated_at",
        ])

        # ── release the physical room(s) ──────────────────────────────────
        house = allocation.house
        if allocation.allocation_unit_type == Allocation.AllocationUnit.HOUSE:
            house.free_all_rooms()
        elif allocation.room_label:
            house.free_room(allocation.room_label)
        house.save()

        if move_to_queue:
            application = HouseApplication.objects.select_for_update().get(id=application.id)
            application.status = HouseApplication.Status.WAITING_FOR_ALLOCATION
            application.allocated_house = None
            application.allocated_room_label = ""
            application.allocated_room_number = ""
            application.allocated_at = None
            application.allocated_by = None
            application.allocation_notes = ""
            application.deallocation_reason = reason
            application.allocation_confidence = 0
            application.save()

        AllocationLog.objects.create(
            application=application,
            application_no=application.application_no,
            employee_name=application.employee_name,
            employee_id=application.employee_id,
            house=allocation.house,
            house_hid=allocation.house.house_id,
            allocation_unit_type=allocation.allocation_unit_type,
            room_label=allocation.room_label,
            room_number=allocation.room_number,
            action=AllocationLog.Action.DEALLOCATED,
            old_status=old_status,
            new_status=application.status,
            priority_score=application.priority_score,
            eligible_category=application.eligible_house_category,
            score_breakdown=application.score_breakdown,
            recommendation_reason=f"Deallocated: {reason}",
            notes=reason,
            performed_by=user,
            performed_by_name=user.get_full_name() if user else "",
        )

        record_audit(
            application,
            HouseAuditTrail.Action.TERMINATED,
            user,
            old_status=old_status,
            new_status=application.status,
            detail={
                "allocation_no": allocation.allocation_no,
                "house_id": allocation.house.house_id,
                "room_label": allocation.room_label or None,
                "allocation_unit_type": allocation.allocation_unit_type,
                "move_to_queue": move_to_queue,
            },
            note=reason,
        )

    return allocation


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  7. SINGLE AUTO-ALLOCATE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def auto_allocate_single(house, target_application=None, user=None, room_label=""):
    """
    Auto-allocate a house (or a room within it) to the best eligible applicant.
    If target_application is provided, allocate that specific application.
    Room-mode (single) applicants are assigned the first available room, unless
    `room_label` is given (then that specific room is used when allocatable).
    Returns (application, breakdown, reasons) or raises ValueError.
    """
    if not house.is_available:
        raise ValueError(f"House {house.house_id} is not available")

    config = ScoringConfig.objects.filter(is_active=True).first()

    if target_application:
        candidates = [target_application]
    else:
        cat = house.house_type
        candidates = list(
            HouseApplication.objects.filter(
                status__in=[
                    HouseApplication.Status.VERIFIED,
                    HouseApplication.Status.WAITING_FOR_ALLOCATION,
                ],
                is_active=True,
            ).select_related("emp_record", "requester")
        )
        eligible = []
        for c in candidates:
            ec, _ = determine_eligible_category(c)
            if CATEGORY_ORDER.get(cat, 0) <= CATEGORY_ORDER.get(ec, 0):
                eligible.append(c)
        candidates = eligible

    if not candidates:
        raise ValueError("No eligible candidates for this house")

    ranked = topsis_rank(candidates, config)
    best_app, best_score, best_breakdown, best_reasons = ranked[0][0], ranked[0][1], ranked[0][2], ranked[0][3]

    best_app.priority_score = best_score
    best_app.score_breakdown = best_breakdown
    best_app.eligible_house_category, _ = determine_eligible_category(best_app)
    best_app.save(update_fields=[
        "priority_score", "score_breakdown", "eligible_house_category", "updated_at",
    ])

    mode, _ = determine_allocation_mode(best_app)
    room = None
    if mode == ALLOCATION_MODE_ROOM:
        if room_label:
            room = house.room_for_label(room_label)
            if room is None:
                raise ValueError(f"Room {room_label} not found in house {house.house_id}")
        else:
            room = house.available_rooms[0] if house.available_rooms else None
        if room is None:
            raise ValueError(f"House {house.house_id} has no available room for a single applicant")

    allocate_application(best_app, house, user, "Auto", notes="; ".join(best_reasons),
                         room=room, room_label=room["label"] if room else "")

    return best_app, best_breakdown, best_reasons


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  8. MANUAL ALLOCATE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def manual_allocate(house, application, user=None, notes="", room=None, room_label=""):
    """Manual allocation (reviewer-driven) with optional justification."""
    allocate_application(application, house, user, "Manual", notes=notes,
                         room=room, room_label=room_label)
    return application


def override_allocate(house, application, user=None, reason="", notes="",
                      room=None, room_label=""):
    """
    Manual override allocation — requires an explicit, audited override reason.
    """
    if not reason.strip():
        raise ValueError("An override reason is required for manual overrides")
    return _execute_allocation(
        application, house, user, "Override",
        override_reason=reason.strip(), notes=notes,
        room=room, room_label=room_label,
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  9. DEALLOCATE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def deallocate(application, user=None, reason=""):
    """Remove the current active allocation and send application back to queue."""
    active = application.allocation_records.filter(status=Allocation.Status.ACTIVE).first()
    if active is None:
        raise ValueError("Application has no active allocation to deallocate")
    terminate_allocation(active, user, reason, move_to_queue=True)
    return application


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  10. BATCH ALLOCATION ENGINE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class _AllocationResource:
    """Uniform resource object for the Hungarian assigner — a whole house
    (HOUSE_ALLOCATION) or a single room within a house (ROOM_ALLOCATION)."""

    def __init__(self, house, room, allocation_mode):
        self.house = house
        self.room = room
        self.allocation_mode = allocation_mode
        self.key = f"{house.id}:{room['label']}" if room else house.house_id

    @property
    def is_available(self):
        if self.allocation_mode == ALLOCATION_MODE_HOUSE:
            return self.house.is_fully_vacant
        return room_available(self.house, self.room)

    @property
    def house_id(self):
        return self.house.house_id

    @property
    def house_number(self):
        return self.house.house_number or self.house.house_id

    @property
    def house_type(self):
        return self.house.house_type

    @property
    def room_label(self):
        return self.room["label"] if self.room else ""

    @property
    def label(self):
        return resource_label(self.house, self.room["label"] if self.room else "")


def run_batch_allocation(user=None, dry_run=False):
    """
    Run full allocation pipeline:
    1. Collect all waiting applications
    2. Determine eligibility + allocation mode for each
    3. Compute MCDA scores
    4. Apply TOPSIS ranking
    5. Use Hungarian assignment for optimal matching
       — whole-house resources for family (HOUSE_ALLOCATION) applicants,
         per-room resources for single (ROOM_ALLOCATION) applicants
    6. Execute allocations atomically (Allocation records + audit)
    Returns dict with allocated/skipped results.

    With `dry_run=True` nothing is persisted — identical assignment logic runs
    in memory and returns the preview payload (safe to poll from the console).
    """
    # Exclude employees who already hold an active allocation
    allocated_emp_ids = set(
        Allocation.objects.filter(status=Allocation.Status.ACTIVE)
        .exclude(emp_record=None)
        .values_list("emp_record_id", flat=True)
    )
    allocated_emp_str_ids = set(
        Allocation.objects.filter(status=Allocation.Status.ACTIVE)
        .values_list("employee_id", flat=True)
    )

    raw_waiting = list(
        HouseApplication.objects.filter(
            status=HouseApplication.Status.WAITING_FOR_ALLOCATION,
            is_active=True,
        ).select_related("emp_record", "requester")
    )

    waiting = []
    for app in raw_waiting:
        if app.emp_record_id and app.emp_record_id in allocated_emp_ids:
            continue
        if app.employee_id and app.employee_id in allocated_emp_str_ids:
            continue
        waiting.append(app)

    if not waiting:
        return {"allocated": [], "skipped": [], "total_houses": 0}

    config = ScoringConfig.objects.filter(is_active=True).first()

    # Step 1: Compute scores, eligibility and allocation mode (persisted unless dry-run)
    for app in waiting:
        cat, cat_reason = determine_eligible_category(app)
        mode, _ = determine_allocation_mode(app)
        total, breakdown, reasons = compute_mcda_score(app, config)
        app.eligible_house_category = cat
        app.allocation_mode = mode
        app.priority_score = total
        app.score_breakdown = breakdown
        if not dry_run:
            app.save(update_fields=[
                "eligible_house_category", "allocation_mode", "priority_score",
                "score_breakdown", "updated_at",
            ])

    # Step 2: TOPSIS ranking
    ranked = topsis_rank(waiting, config)
    ranked_apps = [r[0] for r in ranked]

    # Split applicants by allocation unit so each group competes for its own
    # resource pool (whole houses vs individual rooms).
    house_apps = [a for a in ranked_apps if a.allocation_mode == ALLOCATION_MODE_HOUSE]
    room_apps = [a for a in ranked_apps if a.allocation_mode == ALLOCATION_MODE_ROOM]

    active_houses = [
        h for h in House.objects.filter(
            status=House.Status.ACTIVE,
            is_active=True,
        ).exclude(allocation_category=House.AllocationCategory.GUEST)
    ]

    # Step 3: Available resources
    house_resources = [
        _AllocationResource(h, None, ALLOCATION_MODE_HOUSE)
        for h in active_houses if h.is_fully_vacant
    ]
    room_resources = [
        _AllocationResource(h, room, ALLOCATION_MODE_ROOM)
        for h in active_houses
        for room in h.available_rooms
        if room_available(h, room)
    ]
    all_resources = house_resources + room_resources
    by_key = {r.key: r for r in all_resources}

    # Step 4: Hungarian optimal assignment (per unit)
    assignments = {}
    assignments.update(hungarian_assign(house_apps, house_resources))
    assignments.update(hungarian_assign(room_apps, room_resources))

    allocated = []
    skipped = []

    # Step 5: dry-run preview — same constraint checks, zero side effects.
    if dry_run:
        for key, (app, score) in assignments.items():
            res = by_key.get(key)
            ok, reason = (True, None)
            if res is not None:
                ok, reason = check_allocation_constraints(
                    app, res.house, room=res.room, allocation_mode=res.allocation_mode,
                )
            if ok:
                allocated.append({
                    "house_id": res.house_id if res else key,
                    "house_number": res.house_number if res else key,
                    "house_type": res.house_type if res else "",
                    "room_label": res.room_label if res else "",
                    "allocation_unit_type": res.allocation_mode if res else "",
                    "resource": res.label if res else key,
                    "allocated_to": app.employee_name,
                    "application_no": app.application_no,
                    "score": str(score),
                })
            else:
                skipped.append({
                    "house_id": res.house_id if res else key,
                    "house_number": res.house_number if res else key,
                    "house_type": res.house_type if res else "",
                    "room_label": res.room_label if res else "",
                    "allocation_unit_type": res.allocation_mode if res else "",
                    "resource": res.label if res else key,
                    "allocated_to": None,
                    "application_no": app.application_no,
                    "score": str(score),
                    "skip_reason": reason or "No matching constraints",
                })
        return {
            "allocated": allocated,
            "skipped": skipped,
            "total_houses": len(all_resources),
            "dry_run": True,
        }

    # Step 6: Execute allocations atomically (Allocation records + audit)
    with transaction.atomic():
        for key, (app, score) in assignments.items():
            try:
                res = by_key[key]
                house = House.objects.select_for_update().get(id=res.house.id)
                ok, reason = check_allocation_constraints(
                    app, house, room=res.room, allocation_mode=res.allocation_mode,
                )
                if not ok:
                    skipped.append({
                        "house_id": res.house_id,
                        "house_number": res.house_number,
                        "house_type": res.house_type,
                        "room_label": res.room_label,
                        "allocation_unit_type": res.allocation_mode,
                        "resource": res.label,
                        "allocated_to": None,
                        "application_no": app.application_no,
                        "score": str(score),
                        "skip_reason": reason,
                    })
                    continue

                allocate_application(
                    app, house, user, "Auto",
                    notes=f"Batch allocation score={score}",
                    room=res.room, room_label=res.room_label,
                )

                allocated.append({
                    "house_id": res.house_id,
                    "house_number": res.house_number,
                    "house_type": res.house_type,
                    "room_label": res.room_label,
                    "allocation_unit_type": res.allocation_mode,
                    "resource": res.label,
                    "allocated_to": app.employee_name,
                    "application_no": app.application_no,
                    "score": str(score),
                })
            except Exception as e:
                res = by_key.get(key)
                skipped.append({
                    "house_id": res.house_id if res else key,
                    "house_number": res.house_number if res else key,
                    "house_type": res.house_type if res else "",
                    "room_label": res.room_label if res else "",
                    "allocation_unit_type": res.allocation_mode if res else "",
                    "resource": res.label if res else key,
                    "allocated_to": None,
                    "application_no": getattr(app, "application_no", ""),
                    "score": str(score),
                    "skip_reason": str(e),
                })

    return {
        "allocated": allocated,
        "skipped": skipped,
        "total_houses": len(all_resources),
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  11. GALE-SHAPLEY STABLE MATCHING
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def gale_shapley_match(applications, houses):
    """
    Gale-Shapley stable matching: employees prefer higher-ranked houses,
    houses prefer higher-scored employees. Returns dict {house_id: app}.
    """
    houses_by_type = defaultdict(list)
    for h in houses:
        houses_by_type[h.house_type].append(h)

    apps_by_category = defaultdict(list)
    for app in applications:
        cat, _ = determine_eligible_category(app)
        apps_by_category[cat].append(app)

    matches = {}
    free_apps = list(applications)

    app_prefs = {}
    for app in applications:
        cat, _ = determine_eligible_category(app)
        available = [h for h in houses_by_type.get(cat, []) if h.house_id not in matches]
        available.sort(key=lambda h: GRADE_ORDER.get(h.house_type, 0), reverse=True)
        app_prefs[app.id] = available

    house_prefs = {}
    for h in houses:
        cat_apps = apps_by_category.get(h.house_type, [])
        cat_apps.sort(key=lambda a: float(a.priority_score), reverse=True)
        house_prefs[h.house_id] = {app.id: rank for rank, app in enumerate(cat_apps)}

    while free_apps:
        app = free_apps[0]
        prefs = app_prefs.get(app.id, [])
        if not prefs:
            free_apps.remove(app)
            continue

        house = prefs.pop(0)
        current_match_id = matches.get(house.house_id)

        if current_match_id is None:
            matches[house.house_id] = app
            free_apps.remove(app)
        else:
            current_rank = house_prefs.get(house.house_id, {}).get(current_match_id, 999)
            new_rank = house_prefs.get(house.house_id, {}).get(app.id, 999)
            if new_rank < current_rank:
                old_app = matches[house.house_id]
                matches[house.house_id] = app
                free_apps.remove(app)
                free_apps.append(old_app)
            else:
                pass

    return matches


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  12. HUNGARIAN OPTIMAL ASSIGNMENT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def hungarian_assign(applications, resources):
    """
    Hungarian algorithm (simplified for rectangular matrices).
    Maximises total score of assignments.
    `resources` are _AllocationResource objects (whole house or single room).
    Returns dict {resource.key: (application, score)}.
    """
    available = [r for r in resources if r.is_available]
    if not available or not applications:
        return {}

    n_apps = len(applications)
    n_res = len(available)
    size = max(n_apps, n_res)

    INF = 1e9
    cost = [[INF] * size for _ in range(size)]

    for i, app in enumerate(applications):
        for j, res in enumerate(available):
            ok, _ = check_allocation_constraints(
                app, res.house, room=res.room, allocation_mode=res.allocation_mode,
            )
            if ok:
                cat, _ = determine_eligible_category(app)
                if res.house.house_type == cat:
                    cost[i][j] = -float(app.priority_score)
                else:
                    cost[i][j] = -float(app.priority_score) * 0.5

    n = size
    u = [0.0] * (n + 1)
    v = [0.0] * (n + 1)
    p = [0] * (n + 1)
    way = [0] * (n + 1)

    for i in range(1, n + 1):
        p[0] = i
        j0 = 0
        minv = [INF] * (n + 1)
        used = [False] * (n + 1)
        while True:
            used[j0] = True
            i0 = p[j0]
            delta = INF
            j1 = 0
            for j in range(1, n + 1):
                if not used[j]:
                    cur = cost[i0 - 1][j - 1] - u[i0] - v[j]
                    if cur < minv[j]:
                        minv[j] = cur
                        way[j] = j0
                    if minv[j] < delta:
                        delta = minv[j]
                        j1 = j
            for j in range(n + 1):
                if used[j]:
                    u[p[j]] += delta
                    v[j] -= delta
                else:
                    minv[j] -= delta
            j0 = j1
            if p[j0] == 0:
                break
        while j0:
            p[j0] = p[way[j0]]
            j0 = way[j0]

    result = {}
    for j in range(1, n + 1):
        if p[j] != 0 and p[j] <= n_apps and j <= n_res:
            app_idx = p[j] - 1
            res_idx = j - 1
            app = applications[app_idx]
            res = available[res_idx]
            ok, _ = check_allocation_constraints(
                app, res.house, room=res.room, allocation_mode=res.allocation_mode,
            )
            if ok:
                result[res.key] = (app, float(app.priority_score))

    return result


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  13. QUEUE RANKING
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def get_ranked_queue(category=None, recalculate=False):
    """
    Return ranked queue of applications with scores and eligibility analysis.
    Optionally recalculate scores first.
    """
    qs = HouseApplication.objects.filter(
        status__in=[
            HouseApplication.Status.SUBMITTED,
            HouseApplication.Status.UNDER_REVIEW,
            HouseApplication.Status.VERIFIED,
            HouseApplication.Status.WAITING_FOR_ALLOCATION,
        ],
        is_active=True,
    ).select_related("emp_record", "requester", "reviewed_by", "allocated_house")

    if category:
        qs = qs.filter(requested_house_category=category)

    config = ScoringConfig.objects.filter(is_active=True).first()

    if recalculate:
        apps_to_score = qs
    else:
        apps_to_score = qs.filter(score_breakdown={})

    for app in apps_to_score:
        results, best = analyze_eligibility(app)
        cat = best
        mode, _ = determine_allocation_mode(app)
        total, breakdown, reasons = compute_mcda_score(app, config)
        app.eligible_house_category = cat
        app.eligibility_analysis = results
        app.allocation_mode = mode
        app.priority_score = total
        app.score_breakdown = breakdown
        app.save(update_fields=[
            "eligible_house_category", "eligibility_analysis", "allocation_mode",
            "priority_score", "score_breakdown", "updated_at",
        ])

    apps = list(qs)
    ranked = topsis_rank(apps, config)

    result = []
    for rank, (app, score, breakdown, reasons, cc) in enumerate(ranked, 1):
        app.queue_position = rank
        app.score_breakdown["topsis_closeness"] = cc
        app.score_breakdown["rank"] = rank
        app.score_breakdown["recommendation_reasons"] = reasons
        result.append(app)

    return result
