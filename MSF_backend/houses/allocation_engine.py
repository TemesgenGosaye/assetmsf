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
from dataclasses import dataclass
from decimal import Decimal
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import (
    House, HouseApplication, EligibilityRule,
    ScoringConfig, AllocationLog, HouseOpportunity, Allocation, HouseAuditTrail,
)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  MANDATORY ELIGIBILITY GATE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
#  STRICT RULE: NO house is ever recommended, suggested, ranked, or assigned
#  unless the applicant first passes this gate and receives a valid score.
#
#  Grade → Eligible Category boundaries (ABSOLUTE — no exceptions):
#    > 17   → Staff
#    15–17  → A
#    12–14  → B
#    10–11  → C
#    7–9    → D
#    0–6    → E
#
#  Cross-category assignment is NEVER permitted — not even to a lower category.
#  The score ranks within the eligible category; it CANNOT override the grade boundary.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@dataclass
class EligibilityResult:
    """
    Authoritative eligibility gate object. Every allocation pipeline step
    MUST check ``passed`` before proceeding.

    Fields:
        passed           — True only when grade is valid AND score is computed.
        eligible_category— Exact single category ("Staff"|"A"|"B"|"C"|"D"|"E")
                           or "" when grade is invalid/missing.
        job_grade        — Parsed integer grade, or None if unparseable.
        score            — Decimal MCDA score; None if not yet computed or failed.
        reason           — Human-readable explanation for audit/XAI.
    """
    passed: bool
    eligible_category: str
    job_grade: object          # int | None
    score: object              # Decimal | None
    reason: str


# Ordered boundary table: (lower_bound_inclusive, upper_bound_inclusive_or_None, category)
# None upper bound means "no ceiling" (grade > 17 → Staff).
_GRADE_CATEGORY_BOUNDARIES = [
    (18, None, "Staff"),   # > 17
    (15, 17,   "A"),       # 15–17
    (12, 14,   "B"),       # 12–14
    (10, 11,   "C"),       # 10–11
    (7,  9,    "D"),       # 7–9
    (0,  6,    "E"),       # 0–6
]


def grade_to_category(grade: int) -> str:
    """
    Map a validated integer grade to the mandatory eligible house category.
    Negative grades are treated as 0 → E.
    """
    grade = max(grade, 0)
    for lower, upper, cat in _GRADE_CATEGORY_BOUNDARIES:
        if upper is None:
            if grade >= lower:
                return cat
        elif lower <= grade <= upper:
            return cat
    return "E"


def check_strict_eligibility(application, config=None) -> EligibilityResult:
    """
    Mandatory eligibility gate — MUST be called first in every allocation pipeline.

    Returns an EligibilityResult where:
      · passed=True  → applicant may compete for houses of exactly ``eligible_category``.
      · passed=False → NO house may be recommended, suggested, ranked, or assigned.

    Rules enforced (in order):
      1. job_grade must be present and a valid plain integer
         (null, empty string, decimals like "14.5", and non-numeric values are ALL rejected).
      2. Grade maps to exactly one eligible_category (no cascade, no fallback).
      3. MCDA eligibility score must be computable and not None.

    Score is used AFTER category eligibility to rank within the eligible category;
    it CANNOT promote an applicant into a higher or lower category.
    """
    raw = str(application.job_grade or "").strip()

    # Rule 1 — grade must be present
    if not raw:
        return EligibilityResult(
            passed=False, eligible_category="", job_grade=None, score=None,
            reason=(
                "Job grade is missing or null. "
                "Status: NOT ELIGIBLE | Recommendation: NONE | Assignment: BLOCKED"
            ),
        )

    # Rule 1 — grade must be a plain integer (rejects "14.5", "14.0", "abc", etc.)
    try:
        grade = int(raw)
        if str(grade) != raw:          # catches "14.0", "+14", "14.5", etc.
            raise ValueError("Not a plain integer")
    except (TypeError, ValueError):
        return EligibilityResult(
            passed=False, eligible_category="", job_grade=None, score=None,
            reason=(
                f"Job grade '{application.job_grade}' is not a valid integer. "
                "Decimal, float, and non-numeric grades are rejected. "
                "Status: NOT ELIGIBLE | Recommendation: NONE | Assignment: BLOCKED"
            ),
        )

    # Rule 2 — determine mandatory category (grade → single category, no cascade)
    eligible_cat = grade_to_category(grade)

    # Rule 3 — score must be computable (cannot use 0, 50, or 100 as a default bypass)
    try:
        if config is None:
            config = ScoringConfig.objects.filter(is_active=True).first()
        score, _breakdown, _reasons = compute_mcda_score(application, config)
        if score is None:
            return EligibilityResult(
                passed=False, eligible_category=eligible_cat,
                job_grade=grade, score=None,
                reason=(
                    "Eligibility score could not be established. "
                    "Status: NOT ELIGIBLE | Recommendation: NONE"
                ),
            )
    except Exception as exc:
        return EligibilityResult(
            passed=False, eligible_category=eligible_cat,
            job_grade=grade, score=None,
            reason=(
                f"Eligibility score calculation failed: {exc}. "
                "Status: NOT ELIGIBLE | Recommendation: NONE"
            ),
        )

    return EligibilityResult(
        passed=True,
        eligible_category=eligible_cat,
        job_grade=grade,
        score=score,
        reason=(
            f"Eligible for category '{eligible_cat}' based on job grade {grade}. "
            f"MCDA score: {score}."
        ),
    )


def validate_applicant_grade(application):
    """
    Lightweight grade-only validation for backend assignment endpoints.
    Used by views.py to block frontend bypass BEFORE calling the engine.

    Returns (valid: bool, eligible_category: str, reason: str).
    Does NOT compute the score — that is done inside check_strict_eligibility().
    """
    raw = str(application.job_grade or "").strip()
    if not raw:
        return False, "", "Job grade is missing or null — assignment BLOCKED."
    try:
        grade = int(raw)
        if str(grade) != raw:
            raise ValueError("Not a plain integer")
    except (TypeError, ValueError):
        return False, "", (
            f"Job grade '{application.job_grade}' is not a valid integer — assignment BLOCKED."
        )
    cat = grade_to_category(grade)
    return True, cat, f"Grade {grade} → eligible category '{cat}'."


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
#  ROOM ORDERING  (R1 → R2 → R3)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def find_vacant_room_in_order(house):
    """
    Return the first physically vacant room in strict R1 → R2 → R3 order.

    This is the authoritative room-selection primitive: a house with 3 rooms
    always fills Room 1 before Room 2, and Room 2 before Room 3.  Returns
    (room_dict, index) or (None, -1) when no room is free.
    """
    for room in house.rooms:
        if room.get("status") == House.RoomStatus.VACANT:
            return room, room["index"]
    return None, -1


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  STRICT CATEGORY FILTER  (exact match — NO cascade, NO downward drift)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _exact_eligible_category(eligible_category):
    """
    Return a list containing EXACTLY the applicant's eligible category.

    HARD RULE: An applicant eligible for category B may ONLY be placed in a
    B house.  They may NOT be placed in C, D, or E houses "because those are
    available", and they may NOT be placed in A or Staff houses "because
    their score is high".

    This replaces the old ``_eligible_types_ordered`` cascade which incorrectly
    allowed downward drift (B → C → D → E).  That cascade is removed entirely.

    Returns [] when eligible_category is empty/None (invalid grade → not eligible).
    """
    if not eligible_category:
        return []
    return [eligible_category]


def find_best_house_for_applicant(application, allocation_mode=None):
    """
    Walk the applicant's eligible house types from best → lowest and return
    the first house that can accommodate them.

    For ROOM_ALLOCATION: the house must have at least one physically vacant
    room (checked via ``find_vacant_room_in_order``).

    For HOUSE_ALLOCATION: the house must be fully vacant (every room vacant,
    no active allocation record).

    Returns (house, room_or_None, room_index, reasoning_steps) or
    (None, None, -1, reasoning_steps) when no house is available.
    """
    if allocation_mode is None:
        allocation_mode, _ = determine_allocation_mode(application)

    eligible_cat, cat_reason = determine_eligible_category(application)

    # HARD GATE — no house search without a valid eligible category
    if not eligible_cat:
        return None, None, -1, [
            {
                "step": "Eligibility FAILED",
                "detail": cat_reason,
                "eligible_category": "",
                "status": "NOT ELIGIBLE",
                "recommendation": "NONE",
            }
        ]

    # Strict single-category filter — no cascade to lower categories
    types = _exact_eligible_category(eligible_cat)
    reasoning = [
        {"step": "Eligibility", "detail": cat_reason, "eligible_category": eligible_cat},
    ]

    active_houses = list(
        House.objects.filter(
            status=House.Status.ACTIVE,
            is_active=True,
            house_type__in=types,
        ).exclude(allocation_category=House.AllocationCategory.GUEST)
        .order_by("house_number")
    )

    if not active_houses:
        reasoning.append({
            "step": "House Search",
            "detail": (
                f"No active non-guest {eligible_cat}-category houses found. "
                f"Houses of other categories are NOT considered."
            ),
        })
        return None, None, -1, reasoning

    evaluated = []
    for house in active_houses:
        if allocation_mode == ALLOCATION_MODE_ROOM:
            room, idx = find_vacant_room_in_order(house)
            available = room is not None
            detail = (
                f"{house.house_number or house.house_id} ({house.house_type}): "
                f"room {room['label']} vacant (R1→R2→R3)" if available else
                f"{house.house_number or house.house_id} ({house.house_type}): "
                f"all rooms occupied"
            )
            evaluated.append({
                "house": house.house_id, "type": house.house_type,
                "available": available, "detail": detail,
            })
            reasoning.append({"step": "Evaluated House", "detail": detail})
            if available:
                reasoning.append({
                    "step": "Selected House",
                    "detail": (
                        f"Selected {house.house_number or house.house_id} — "
                        f"Room {room['label']} (index {idx}) "
                        f"available in {house.house_type} category"
                    ),
                    "house_id": house.house_id,
                    "house_number": house.house_number,
                    "room_label": room["label"],
                })
                return house, room, idx, reasoning
        else:
            available = house.is_fully_vacant
            detail = (
                f"{house.house_number or house.house_id} ({house.house_type}): "
                f"fully vacant — suitable for whole-house allocation" if available else
                f"{house.house_number or house.house_id} ({house.house_type}): "
                f"partially/fully occupied"
            )
            evaluated.append({
                "house": house.house_id, "type": house.house_type,
                "available": available, "detail": detail,
            })
            reasoning.append({"step": "Evaluated House", "detail": detail})
            if available:
                reasoning.append({
                    "step": "Selected House",
                    "detail": (
                        f"Selected {house.house_number or house.house_id} — "
                        f"fully vacant {house.house_type} house for family allocation"
                    ),
                    "house_id": house.house_id,
                    "house_number": house.house_number,
                })
                return house, None, -1, reasoning

    reasoning.append({
        "step": "House Search Complete",
        "detail": (
            f"No available house found across {len(evaluated)} evaluated houses "
            f"in categories {types}. All are occupied or have no vacant rooms."
        ),
        "evaluated": evaluated,
    })
    return None, None, -1, reasoning


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  ALLOCATION REASONING  (transparent XAI chain)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def build_allocation_reasoning(application, house, room=None,
                               allocation_mode=None, priority_score=None,
                               score_breakdown=None, eligibility_results=None,
                               compatibility_score=None):
    """
    Build a complete, human-readable reasoning chain for one allocation.
    Returns a dict with every decision step:
      1. Applicant profile summary
      2. Eligibility analysis
      3. Fairness / priority score
      4. Allocation mode determination
      5. House selection rationale
      6. Room / exclusive occupancy detail
      7. Final summary
    """
    if allocation_mode is None:
        allocation_mode, _ = determine_allocation_mode(application)
    if priority_score is None:
        priority_score = application.priority_score
    if score_breakdown is None:
        score_breakdown = application.score_breakdown or {}
    if eligibility_results is None:
        eligibility_results = application.eligibility_analysis or []

    eligible_cat = application.eligible_house_category or ""

    room_label = ""
    if allocation_mode == ALLOCATION_MODE_ROOM and room is not None:
        room_label = room.get("label", "")

    steps = []

    # 1 — Applicant profile
    steps.append({
        "section": "Applicant Profile",
        "employee_name": application.employee_name,
        "employee_id": application.employee_id,
        "job_grade": application.job_grade,
        "years_of_service": application.years_of_service,
        "marital_status": application.marital_status,
        "family_size": application.family_size,
        "has_disability": application.has_disability,
        "application_no": application.application_no,
    })

    # 2 — Eligibility
    steps.append({
        "section": "Eligibility",
        "eligible_category": eligible_cat,
        "analysis": eligibility_results,
    })

    # 3 — Fairness score
    steps.append({
        "section": "Fairness Score",
        "priority_score": str(priority_score),
        "breakdown": score_breakdown,
    })

    # 4 — Allocation mode
    mode_label = ALLOCATION_MODE_LABELS.get(allocation_mode, allocation_mode)
    if allocation_mode == ALLOCATION_MODE_ROOM:
        mode_reason = (
            f"Single applicant (marital status: {application.marital_status}, "
            f"family size: {application.family_size}) → room allocation"
        )
    else:
        mode_reason = (
            f"Family applicant (marital status: {application.marital_status}, "
            f"family size: {application.family_size}) → whole-house allocation"
        )
    steps.append({
        "section": "Allocation Mode",
        "mode": allocation_mode,
        "mode_label": mode_label,
        "reason": mode_reason,
    })

    # 5 — House selection
    house_base = house.house_number or house.house_id
    if allocation_mode == ALLOCATION_MODE_ROOM and room_label:
        resource = f"{house_base} — Room {room_label}"
    else:
        resource = house_base

    steps.append({
        "section": "House Selection",
        "house_id": house.house_id,
        "house_number": house.house_number,
        "house_type": house.house_type,
        "location": house.location,
        "resource": resource,
        "room_label": room_label,
    })

    # 6 — Room / exclusive occupancy
    if allocation_mode == ALLOCATION_MODE_ROOM:
        steps.append({
            "section": "Room Assignment",
            "room_label": room_label,
            "room_index": room.get("index") if room else None,
            "detail": (
                f"Applicant occupies Room {room_label} in {house_base}. "
                f"Remaining vacant rooms after allocation: "
                f"{house.room_vacant_count - 1}"
            ),
        })
    else:
        steps.append({
            "section": "Exclusive Occupancy",
            "detail": (
                f"Applicant/family occupies the entire house {house_base} "
                f"({house.room_count} room(s)) exclusively. "
                f"All rooms marked Occupied."
            ),
        })

    # 7 — Final summary
    steps.append({
        "section": "Summary",
        "detail": (
            f"{application.employee_name} (Grade {application.job_grade}, "
            f"Score {priority_score}) allocated to {resource} "
            f"({allocation_mode})."
        ),
    })

    return {"steps": steps}


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
        best, _ = determine_eligible_category(application)

    return results, best


def determine_eligible_category(application):
    """
    Determine the house category an employee qualifies for based on job grade.

    STRICT BOUNDARIES (absolute, no exceptions):
      grade > 17   → Staff
      grade 15–17  → A
      grade 12–14  → B
      grade 10–11  → C
      grade  7–9   → D
      grade  0–6   → E

    Returns (category_str, reason_str).

    CRITICAL — returns ("", reason) when job_grade is:
      · missing / null
      · not a valid plain integer (decimal, float, string)
    Callers MUST check for empty string and treat it as NOT ELIGIBLE.
    Never silently falls back to grade 0 or category "E" for invalid inputs.
    """
    raw = str(application.job_grade or "").strip()

    if not raw:
        return "", (
            "Job grade is missing or null — applicant is NOT ELIGIBLE for any house category."
        )

    try:
        grade = int(raw)
        if str(grade) != raw:
            raise ValueError("Non-integer grade")
    except (TypeError, ValueError):
        return "", (
            f"Job grade '{application.job_grade}' is not a valid integer — "
            "applicant is NOT ELIGIBLE. Decimal and non-numeric grades are rejected."
        )

    cat = grade_to_category(grade)
    return cat, f"Eligible for '{cat}' based on job grade {grade}."


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

    eligible_cat, cat_reason = determine_eligible_category(application)

    # STRICT CATEGORY ENFORCEMENT — exact match required, no upward AND no downward drift.
    # This is the last line of defence against cross-category allocation.
    if not eligible_cat:
        reasons.append(
            f"Applicant has no eligible house category — job grade is missing or invalid. "
            f"({cat_reason}) "
            f"Assignment BLOCKED: ELIGIBILITY_FAILED"
        )
    elif house.house_type != eligible_cat:
        reasons.append(
            f"House category '{house.house_type}' does not match applicant's mandatory "
            f"eligible category '{eligible_cat}' (job grade {application.job_grade}). "
            f"Assignment REJECTED: HOUSE_CATEGORY_NOT_ELIGIBLE"
        )

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
    else:
        reasons.append(f"House type {house.house_type} does not match eligible category {eligible_category}")
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
    Materialise HouseOpportunity rows for the applicant's eligible house category.
    Idempotent per (application, house). Only houses of the EXACT eligible category
    are ever materialised — cross-category opportunities are never created.

    Allocation mode decides the granularity:
      * HOUSE_ALLOCATION → one opportunity per house (room_label = "").
      * ROOM_ALLOCATION  → one opportunity per available room (room_label = label).

    Returns number of new opportunities created, or 0 if not eligible.
    """
    eligible_cat, cat_reason = determine_eligible_category(application)

    # HARD GATE — do not generate any opportunities for ineligible applicants
    if not eligible_cat:
        record_audit(
            application, HouseAuditTrail.Action.OPPORTUNITIES_GENERATED, user,
            new_status=application.status,
            detail={"created": 0, "eligible_category": "", "reason": cat_reason},
            note=f"No opportunities generated: {cat_reason}",
        )
        return 0

    mode, _ = determine_allocation_mode(application)

    # STRICT: only houses of the exact eligible category — never all houses
    candidate_houses = House.objects.filter(
        is_active=True,
        status=House.Status.ACTIVE,
        house_type=eligible_cat,
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
    Auto-allocate a specific house (or a room within it) to the best eligible
    applicant.  When *target_application* is provided that applicant is used
    directly; otherwise the function ranks all waiting applicants and picks
    the most deserving one.

    Room-mode (single) applicants are assigned the first physically vacant
    room in **R1 → R2 → R3** order unless *room_label* is explicitly given.

    Returns (application, breakdown, reasons) or raises ValueError.
    """
    if not house.is_available:
        raise ValueError(f"House {house.house_id} is not available")

    config = ScoringConfig.objects.filter(is_active=True).first()

    # ── Candidate selection ──────────────────────────────────────────────
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
            # STRICT CATEGORY MATCH — candidates are only eligible for exact house category
            if ec == cat:
                eligible.append(c)
        candidates = eligible

    if not candidates:
        raise ValueError("No eligible candidates for this house")

    ranked = topsis_rank(candidates, config)
    best_app = ranked[0][0]
    best_score = ranked[0][1]
    best_breakdown = ranked[0][2]
    best_reasons = ranked[0][3]

    best_app.priority_score = best_score
    best_app.score_breakdown = best_breakdown
    best_app.eligible_house_category, _ = determine_eligible_category(best_app)
    best_app.save(update_fields=[
        "priority_score", "score_breakdown", "eligible_house_category", "updated_at",
    ])

    # ── Room selection (R1 → R2 → R3) ──────────────────────────────────
    mode, _ = determine_allocation_mode(best_app)
    room = None
    if mode == ALLOCATION_MODE_ROOM:
        if room_label:
            room = house.room_for_label(room_label)
            if room is None:
                raise ValueError(f"Room {room_label} not found in house {house.house_id}")
        else:
            room, _ = find_vacant_room_in_order(house)
        if room is None:
            raise ValueError(f"House {house.house_id} has no available room for a single applicant")

    allocate_application(best_app, house, user, "Auto",
                         notes="; ".join(best_reasons),
                         room=room, room_label=room["label"] if room else "")

    return best_app, best_breakdown, best_reasons


def auto_allocate_cascade(application, user=None, dry_run=False):
    """
    Allocate a single application by walking the applicant's eligible house
    types from best category → lowest, using R1→R2→R3 room ordering.

    This is the **production entry-point** for allocating one applicant:
      1. Compute MCDA score + eligibility
      2. Walk eligible categories (e.g. Staff → A → B → C → D → E)
      3. For each category, evaluate every active house
      4. For ROOM_ALLOCATION: pick the first house with a vacant room
         (R1 first, then R2, then R3)
      5. For HOUSE_ALLOCATION: pick the first fully vacant house
      6. Allocate atomically (or return a dry-run preview)

    Returns (allocated_flag, result_dict) where result_dict contains the
    allocation details or a skip reason together with full reasoning.
    """
    config = ScoringConfig.objects.filter(is_active=True).first()

    total, breakdown, reasons = compute_mcda_score(application, config)
    application.priority_score = total
    application.score_breakdown = breakdown
    application.eligible_house_category, _ = determine_eligible_category(application)
    if not dry_run:
        application.save(update_fields=[
            "priority_score", "score_breakdown", "eligible_house_category",
            "updated_at",
        ])

    allocation_mode, mode_reason = determine_allocation_mode(application)
    eligible_cat = application.eligible_house_category

    if not eligible_cat:
        reasoning = build_allocation_reasoning(
            application, house=None,
            allocation_mode=allocation_mode,
            priority_score=total, score_breakdown=breakdown,
            eligibility_results=[],
        )
        return False, {
            "application_no": application.application_no,
            "employee_name": application.employee_name,
            "skip_reason": "Not eligible for any house category",
            "reasoning": reasoning,
        }

    # ── Search Exact Category ONLY ────────────────────────
    active_houses = list(
        House.objects.filter(
            status=House.Status.ACTIVE,
            is_active=True,
            house_type=eligible_cat,
        ).exclude(allocation_category=House.AllocationCategory.GUEST)
        .order_by("house_number")
    )

    evaluation_log = []

    if not active_houses:
        evaluation_log.append({
            "type": eligible_cat, "houses_found": 0,
            "detail": "No active houses of this exact type",
        })

    for house in active_houses:
        if allocation_mode == ALLOCATION_MODE_ROOM:
            room, idx = find_vacant_room_in_order(house)
            available = room is not None
            detail = (
                f"{house.house_number}: Room {room['label']} vacant "
                f"(R1→R2→R3)" if available else
                f"{house.house_number}: all rooms occupied"
            )
        else:
            available = house.is_fully_vacant
            room = None
            detail = (
                f"{house.house_number}: fully vacant" if available else
                f"{house.house_number}: partially/fully occupied"
            )

        evaluation_log.append({
            "type": eligible_cat, "house_id": house.house_id,
            "house_number": house.house_number, "available": available,
            "detail": detail,
        })

        if not available:
            continue

        # ── Candidate found — allocate (or preview) ─────────────────
        reasoning = build_allocation_reasoning(
            application, house, room=room,
            allocation_mode=allocation_mode,
            priority_score=total, score_breakdown=breakdown,
            eligibility_results=application.eligibility_analysis or [],
        )
        reasoning["steps"].insert(0, {
            "section": "Evaluation Trail",
            "detail": (
                f"Evaluated {len(evaluation_log)} house(s) in category '{eligible_cat}' "
                f"before finding available resource"
            ),
            "evaluations": evaluation_log,
        })

        result = {
            "application_no": application.application_no,
            "employee_name": application.employee_name,
            "employee_id": application.employee_id,
            "job_grade": application.job_grade,
            "priority_score": str(total),
            "allocation_mode": allocation_mode,
            "house_id": house.house_id,
            "house_number": house.house_number,
            "house_type": house.house_type,
            "room_label": room["label"] if room else "",
            "resource": resource_label(house, room["label"] if room else ""),
            "reasoning": reasoning,
        }

        if dry_run:
            return True, result

        allocate_application(
            application, house, user, "Auto",
            notes=f"Strict exact-category allocation score={total}",
            room=room, room_label=room["label"] if room else "",
        )
        return True, result

    # ── No house found ──────────────────────────────────────────────────
    reasoning = build_allocation_reasoning(
        application, house=None,
        allocation_mode=allocation_mode,
        priority_score=total, score_breakdown=breakdown,
        eligibility_results=application.eligibility_analysis or [],
    )
    reasoning["steps"].insert(0, {
        "section": "Evaluation Trail",
        "detail": (
            f"Evaluated {len(evaluation_log)} house(s) in exact category '{eligible_cat}' "
            f"— no available house found"
        ),
        "evaluations": evaluation_log,
    })

    return False, {
        "application_no": application.application_no,
        "employee_name": application.employee_name,
        "skip_reason": (
            f"No available house in mandatory category '{eligible_cat}' "
            f"({len(evaluation_log)} houses evaluated)"
        ),
        "recommendation": "NONE",
        "eligible_category": eligible_cat,
        "reasoning": reasoning,
    }


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
                    cost[i][j] = INF  # STRICT CATEGORY MATCH — cross-category is impossible

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
        results, _ = analyze_eligibility(app)  # Keep results for XAI/display
        cat, _ = determine_eligible_category(app)  # Grade-based, authoritative
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


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  14. TERMINATION ENGINE  (Inspection-gated, Authorization-Code secured)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
#  Full workflow enforced server-side:
#  Allocation Baseline → House Inspection → Status Comparison →
#  Issue Resolution → Termination Request → Admin/Manager Approval →
#  Secure Termination Code → Code Verification → Termination →
#  House Release → Capacity Recalculation → Complete Audit Trail
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def capture_inspection_baseline(house):
    """
    Capture the authoritative house condition snapshot at termination-creation time.
    Includes:
      - damage flags (door, windows, walls, switch, bulb, water)
      - latest completed inspection results (findings, damage_costs, checklist)
      - pending open maintenance requests
    Returns a dict used as `inspection_baseline` on the TerminationTransaction.
    """
    # Current house damage flags
    damage_flags = {
        "damaged_door": house.damaged_door,
        "damaged_windows": house.damaged_windows,
        "damaged_walls": house.damaged_walls,
        "damaged_switch": house.damaged_switch,
        "damaged_bulb": house.damaged_bulb,
        "damaged_water": house.damaged_water,
    }
    any_damage = any(damage_flags.values())

    # Latest completed inspection
    from .models import HouseInspection
    latest_inspection = (
        HouseInspection.objects
        .filter(house=house, status=HouseInspection.Status.COMPLETED)
        .order_by("-completed_date")
        .first()
    )
    inspection_snapshot = {}
    if latest_inspection:
        inspection_snapshot = {
            "inspection_id": str(latest_inspection.id),
            "inspection_type": latest_inspection.inspection_type,
            "completed_date": latest_inspection.completed_date.isoformat() if latest_inspection.completed_date else None,
            "findings": latest_inspection.findings or "",
            "damage_costs": float(latest_inspection.damage_costs or 0),
            "checklist_results": latest_inspection.checklist_results or {},
        }

    # Pending maintenance requests count
    from .models import MaintenanceRequest
    open_maintenance = (
        MaintenanceRequest.objects
        .filter(
            house=house,
            status__in=[
                MaintenanceRequest.Status.OPEN,
                MaintenanceRequest.Status.IN_PROGRESS,
            ],
        )
        .count()
    )

    return {
        "snapshot_at": timezone.now().isoformat(),
        "damage_flags": damage_flags,
        "has_any_damage": any_damage,
        "latest_inspection": inspection_snapshot,
        "open_maintenance_count": open_maintenance,
        "room_statuses": {
            "r1": house.r1_status,
            "r2": house.r2_status if house.room_count >= 2 else "",
            "r3": house.r3_status if house.room_count >= 3 else "",
        },
    }


def compare_inspection_baseline(baseline, current_house):
    """
    Compare the allocation baseline (captured at termination creation) with the
    current authoritative house condition. Returns a list of discrepancies.
    Each discrepancy is a dict with keys: field, baseline_value, current_value, severity, description.
    Severity is one of: 'critical', 'warning', 'info'.
    """
    discrepancies = []
    if not baseline:
        return discrepancies

    # Compare damage flags
    old_flags = baseline.get("damage_flags", {})
    current_flags = {
        "damaged_door": current_house.damaged_door,
        "damaged_windows": current_house.damaged_windows,
        "damaged_walls": current_house.damaged_walls,
        "damaged_switch": current_house.damaged_switch,
        "damaged_bulb": current_house.damaged_bulb,
        "damaged_water": current_house.damaged_water,
    }
    for field, label in [
        ("damaged_door", "Door"), ("damaged_windows", "Windows"),
        ("damaged_walls", "Walls"), ("damaged_switch", "Switch"),
        ("damaged_bulb", "Bulb"), ("damaged_water", "Water"),
    ]:
        old_val = old_flags.get(field, False)
        cur_val = current_flags.get(field, False)
        if cur_val and not old_val:
            discrepancies.append({
                "field": field,
                "label": label,
                "baseline_value": old_val,
                "current_value": cur_val,
                "severity": "critical",
                "description": f"{label} damage detected that was not present at allocation baseline",
            })
        elif old_val and not cur_val:
            discrepancies.append({
                "field": field,
                "label": label,
                "baseline_value": old_val,
                "current_value": cur_val,
                "severity": "info",
                "description": f"{label} was damaged at baseline but has been repaired",
            })

    # Compare latest inspection
    from .models import HouseInspection, MaintenanceRequest
    latest_completed = (
        HouseInspection.objects
        .filter(house=current_house, status=HouseInspection.Status.COMPLETED)
        .order_by("-completed_date")
        .first()
    )
    baseline_inspection = baseline.get("latest_inspection", {})
    if latest_completed:
        baseline_cost = baseline_inspection.get("damage_costs", 0) or 0
        current_cost = float(latest_completed.damage_costs or 0)
        if current_cost > baseline_cost:
            discrepancies.append({
                "field": "damage_costs",
                "label": "Damage Costs",
                "baseline_value": baseline_cost,
                "current_value": current_cost,
                "severity": "critical",
                "description": (
                    f"Damage costs increased from {baseline_cost:.2f} to "
                    f"{current_cost:.2f} — outstanding damage must be resolved"
                ),
            })

    # Check open maintenance
    open_maint = (
        MaintenanceRequest.objects
        .filter(
            house=current_house,
            status__in=[
                MaintenanceRequest.Status.OPEN,
                MaintenanceRequest.Status.IN_PROGRESS,
            ],
        )
        .count()
    )
    baseline_open = baseline.get("open_maintenance_count", 0)
    if open_maint > baseline_open:
        discrepancies.append({
            "field": "open_maintenance",
            "label": "Open Maintenance",
            "baseline_value": baseline_open,
            "current_value": open_maint,
            "severity": "warning",
            "description": f"{open_maint} open maintenance request(s) — may require resolution before handover",
        })

    return discrepancies


def validate_termination(allocation, case, user, **kwargs):
    """
    Server-side validation before creating a termination transaction.
    Includes mandatory inspection baseline capture and discrepancy detection.
    Returns (is_valid, errors_list, warnings_list).
    """
    errors = []
    warnings = []

    # ── 1. Allocation exists and is active ──────────────────────────────
    if allocation is None:
        errors.append("Allocation not found")
        return False, errors, warnings
    if allocation.status != Allocation.Status.ACTIVE:
        errors.append(f"Allocation {allocation.allocation_no} is not active (status: {allocation.status})")
        return False, errors, warnings

    # ── 2. Case validation ──────────────────────────────────────────────
    if case is None:
        errors.append("Termination case not found")
        return False, errors, warnings
    if not case.is_active:
        errors.append(f"Termination case '{case.name}' is not active")
        return False, errors, warnings

    # ── 3. Employee identity matches allocation ─────────────────────────
    employee_id = kwargs.get("employee_id", "")
    if employee_id and employee_id != allocation.employee_id:
        errors.append(
            f"Employee ID mismatch: allocation belongs to {allocation.employee_id}, "
            f"request is for {employee_id}"
        )

    # ── 4. Effective date validation ────────────────────────────────────
    effective_date = kwargs.get("effective_date")
    if effective_date is None:
        errors.append("Effective date is required")

    # ── 5. Transfer-specific validation ─────────────────────────────────
    if case.category == "Transfer":
        target_house_id = kwargs.get("target_house_id")
        if not target_house_id:
            errors.append("Target house is required for transfer terminations")
        else:
            try:
                target_house = House.objects.get(house_id=target_house_id, is_active=True)
                if not target_house.is_available:
                    errors.append(f"Target house {target_house.house_id} is not available")
                if target_house.id == allocation.house_id:
                    errors.append("Target house cannot be the same as current house")
            except House.DoesNotExist:
                errors.append(f"Target house {target_house_id} not found")

    # ── 6. Retirement-specific validation ───────────────────────────────
    if case.category == "Retirement" and case.auto_verify_employment:
        emp_record = allocation.emp_record
        if emp_record:
            emp_status = getattr(emp_record, "status", None)
            if emp_status and hasattr(emp_status, 'lower') and emp_status.lower() not in ("active", "employed"):
                warnings.append(
                    f"Employee employment status is '{emp_status}' — verify this matches retirement case"
                )

    # ── 7. Release-specific validation ──────────────────────────────────
    if case.category == "Release" and case.auto_verify_employment:
        emp_record = allocation.emp_record
        if emp_record:
            emp_status = getattr(emp_record, "status", None)
            if emp_status and hasattr(emp_status, 'lower') and emp_status.lower() not in ("active", "employed"):
                warnings.append(
                    f"Employee employment status is '{emp_status}' — verify this matches release case"
                )

    # ── 8. Conflict check: no other active termination for same allocation
    from .models import TerminationTransaction
    active_term = TerminationTransaction.objects.filter(
        allocation=allocation,
        status__in=[
            TerminationTransaction.Status.PENDING,
            TerminationTransaction.Status.APPROVED,
            TerminationTransaction.Status.IN_PROGRESS,
        ],
        is_active=True,
    ).exclude(id=kwargs.get("transaction_id")).exists()
    if active_term:
        errors.append("An active termination transaction already exists for this allocation")

    # ── 9. Reason validation ────────────────────────────────────────────
    reason = kwargs.get("reason", "")
    if not reason or not str(reason).strip():
        errors.append("Termination reason is required")

    # ── 10. MANDATORY INSPECTION BASELINE CHECK ────────────────────────
    # Always require inspection baseline when case requires inspection.
    house = allocation.house
    if case.requires_inspection in ("Always", "Conditional"):
        baseline = capture_inspection_baseline(house)
        discrepancies = compare_inspection_baseline(baseline, house)

        critical = [d for d in discrepancies if d["severity"] == "critical"]
        warning_disc = [d for d in discrepancies if d["severity"] == "warning"]

        if critical:
            for d in critical:
                errors.append(
                    f"[INSPECTION BLOCKED] {d['description']}. "
                    f"Resolve this issue before termination can proceed."
                )
        if warning_disc:
            for d in warning_disc:
                warnings.append(
                    f"[INSPECTION WARNING] {d['description']}"
                )

        # Check open maintenance that must be resolved
        from .models import MaintenanceRequest
        open_maint = MaintenanceRequest.objects.filter(
            house=house,
            status__in=[
                MaintenanceRequest.Status.OPEN,
                MaintenanceRequest.Status.IN_PROGRESS,
            ],
        )
        if open_maint.exists():
            for req in open_maint[:5]:
                warnings.append(
                    f"[MAINTENANCE] Open {req.priority} priority request: "
                    f"'{req.title}' (status: {req.status}) — resolve before handover"
                )

        # Store baseline data in kwargs for create_termination_transaction
        kwargs["_inspection_baseline"] = baseline
        kwargs["_inspection_discrepancies"] = discrepancies

    # ── 11. For 'Never' inspection cases, waive inspection but still capture baseline ──
    elif case.requires_inspection == "Never":
        kwargs["_inspection_baseline"] = capture_inspection_baseline(house)
        kwargs["_inspection_discrepancies"] = []

    return len(errors) == 0, errors, warnings


def create_termination_transaction(allocation, case, user, **kwargs):
    """
    Create a TerminationTransaction after full validation.
    Captures inspection baseline snapshot. Does NOT terminate the allocation.
    """
    from .models import TerminationTransaction

    is_valid, errors, warnings = validate_termination(
        allocation, case, user, **kwargs,
    )
    if not is_valid:
        raise ValueError("; ".join(errors))

    house = allocation.house
    effective_date = kwargs.get("effective_date")
    reason = kwargs.get("reason", "")
    target_house_id = kwargs.get("target_house_id")
    target_house = None

    if target_house_id:
        try:
            target_house = House.objects.get(house_id=target_house_id, is_active=True)
        except House.DoesNotExist:
            pass

    # Determine handover + inspection requirements
    handover_status = TerminationTransaction.HandoverStatus.PENDING
    inspection_status = TerminationTransaction.InspectionStatus.NOT_REQUIRED
    if case.requires_inspection == "Always":
        inspection_status = TerminationTransaction.InspectionStatus.SCHEDULED
    elif case.requires_inspection == "Conditional":
        inspection_status = TerminationTransaction.InspectionStatus.SCHEDULED

    if not case.requires_inspection or case.requires_inspection == "Never":
        handover_status = TerminationTransaction.HandoverStatus.WAIVED
        inspection_status = TerminationTransaction.InspectionStatus.WAIVED

    inspection_baseline = kwargs.get("_inspection_baseline", {})
    inspection_discrepancies = kwargs.get("_inspection_discrepancies", [])

    # Determine if all discrepancies are non-critical (resolved or info-only)
    critical_count = sum(1 for d in inspection_discrepancies if d.get("severity") == "critical")
    issues_resolved = critical_count == 0

    termination = TerminationTransaction.objects.create(
        allocation=allocation,
        application=allocation.application,
        case=case,
        employee_id=allocation.employee_id,
        employee_name=allocation.employee_name,
        house=house,
        house_number=house.house_number or house.house_id,
        house_type=house.house_type,
        room_label=allocation.room_label or "",
        termination_reason=reason,
        effective_date=effective_date,
        requested_date=kwargs.get("requested_date"),
        status=TerminationTransaction.Status.PENDING,
        handover_status=handover_status,
        inspection_status=inspection_status,
        inspection_baseline=inspection_baseline,
        inspection_discrepancies=inspection_discrepancies,
        issues_resolved=issues_resolved,
        target_house=target_house,
        remarks=kwargs.get("remarks", ""),
        created_by=user,
    )

    # Audit trail
    record_audit(
        allocation.application,
        HouseAuditTrail.Action.TERMINATED,
        user,
        old_status=allocation.status,
        new_status="Termination Pending",
        detail={
            "termination_no": termination.termination_no,
            "case": case.code,
            "category": case.category,
            "allocation_no": allocation.allocation_no,
            "house_id": house.house_id,
            "inspection_required": case.requires_inspection,
            "critical_discrepancies": critical_count,
            "issues_resolved": issues_resolved,
        },
        note=f"Termination initiated: {case.name} — {reason}",
    )

    return termination, warnings


def resolve_inspection_issues(termination, user, resolution_notes="", force=False):
    """
    Mark all inspection discrepancies as resolved. Required before approval
    when critical discrepancies exist. Only admins can force-resolve.
    """
    from .models import TerminationTransaction

    if termination.status not in (
        TerminationTransaction.Status.PENDING,
        TerminationTransaction.Status.IN_PROGRESS,
    ):
        raise ValueError(f"Cannot resolve issues in '{termination.status}' status")

    with transaction.atomic():
        termination = TerminationTransaction.objects.select_for_update().get(id=termination.id)

        # Re-evaluate current inspection baseline
        baseline = termination.inspection_baseline or {}
        current_baseline = capture_inspection_baseline(termination.house)
        new_discrepancies = compare_inspection_baseline(current_baseline, termination.house)
        critical = [d for d in new_discrepancies if d["severity"] == "critical"]

        if critical and not force:
            raise ValueError(
                f"{len(critical)} critical discrepancy(ies) still present. "
                f"Resolve them first or use force=True to override."
            )

        termination.inspection_baseline = current_baseline
        termination.inspection_discrepancies = new_discrepancies
        termination.issues_resolved = True
        termination.handover_completed = True
        termination.handover_status = TerminationTransaction.HandoverStatus.COMPLETED
        termination.inspection_status = TerminationTransaction.InspectionStatus.COMPLETED
        if resolution_notes:
            termination.remarks = (
                f"{termination.remarks}\n[Inspection Resolution] {resolution_notes}"
            ).strip()
        termination.save(update_fields=[
            "inspection_baseline", "inspection_discrepancies", "issues_resolved",
            "handover_completed", "handover_status", "inspection_status",
            "remarks", "updated_at",
        ])

        record_audit(
            termination.application,
            HouseAuditTrail.Action.STATUS_CHANGED,
            user,
            old_status=termination.status,
            new_status=f"{termination.status} — Inspection Resolved",
            detail={
                "termination_no": termination.termination_no,
                "forced": force,
                "remaining_critical": len(critical),
                "resolution_notes": resolution_notes,
            },
            note=f"Inspection issues resolved. {resolution_notes}".strip(),
        )

    return termination


def _generate_termination_authorization_code(termination):
    """
    Generate a unique 8-digit numeric authorization code.
    Guaranteed unique by DB constraint + retry.
    """
    import secrets
    from .models import TerminationTransaction

    attempts = 0
    while True:
        code = f"{secrets.randbelow(100000000):08d}"
        if not TerminationTransaction.objects.filter(authorization_code=code, status=TerminationTransaction.Status.APPROVED).exists():
            return code
        attempts += 1
        if attempts > 50:
            raise RuntimeError("Failed to generate unique 8-digit authorization code after 50 attempts")


def approve_termination(termination, user, notes=""):
    """
    Approve a pending termination transaction.
    Pre-conditions:
      - Must be in PENDING status
      - Inspection issues must be resolved (issues_resolved=True) when inspection is required
    Post-conditions:
      - Status → APPROVED
      - Secure authorization code is generated and stored
      - Only admin/manager role enforced in the view layer
    """
    from .models import TerminationTransaction

    if termination.status != TerminationTransaction.Status.PENDING:
        raise ValueError(f"Cannot approve termination in '{termination.status}' status")

    # Block approval if inspection required and issues not resolved
    if termination.inspection_status not in (
        TerminationTransaction.InspectionStatus.NOT_REQUIRED,
        TerminationTransaction.InspectionStatus.WAIVED,
    ):
        if not termination.issues_resolved:
            raise ValueError(
                "Cannot approve: inspection issues are not yet resolved. "
                "Call resolve_inspection_issues() first."
            )

    with transaction.atomic():
        termination = TerminationTransaction.objects.select_for_update().get(id=termination.id)

        # Double-check under lock
        if termination.status != TerminationTransaction.Status.PENDING:
            raise ValueError(f"Cannot approve termination in '{termination.status}' status (race condition)")

        if termination.inspection_status not in (
            TerminationTransaction.InspectionStatus.NOT_REQUIRED,
            TerminationTransaction.InspectionStatus.WAIVED,
        ):
            if not termination.issues_resolved:
                raise ValueError(
                    "Cannot approve: inspection issues are not yet resolved."
                )

        # Generate secure authorization code
        auth_code = _generate_termination_authorization_code(termination)

        termination.status = TerminationTransaction.Status.APPROVED
        termination.approval_status = TerminationTransaction.Status.APPROVED
        termination.approved_by = user
        termination.approval_date = timezone.now()
        termination.approval_notes = notes
        termination.authorization_code = auth_code
        termination.code_generated_at = timezone.now()
        termination.code_generated_by = user
        termination.save(update_fields=[
            "status", "approval_status", "approved_by", "approval_date",
            "approval_notes", "authorization_code", "code_generated_at",
            "code_generated_by", "updated_at",
        ])

        record_audit(
            termination.application,
            HouseAuditTrail.Action.STATUS_CHANGED,
            user,
            old_status="Termination Pending",
            new_status="Termination Approved",
            detail={
                "termination_no": termination.termination_no,
                "case": termination.case.code,
                "authorization_code_generated": True,
            },
            note=notes or "Termination approved. Authorization code generated.",
        )

    return termination, auth_code


def verify_termination_code(termination, code, user):
    """
    Verify the termination authorization code. Must be called before process_termination.
    Returns (is_valid, message).
    Only approved terminations with valid codes can proceed.
    """
    from .models import TerminationTransaction

    if termination.status != TerminationTransaction.Status.APPROVED:
        return False, f"Termination is not approved (status: {termination.status})"

    if not termination.authorization_code:
        return False, "No authorization code has been generated for this termination"

    if not code or not str(code).strip():
        return False, "Authorization code is required"

    if str(code).strip() != termination.authorization_code:
        # Audit the failed attempt
        record_audit(
            termination.application,
            HouseAuditTrail.Action.STATUS_CHANGED,
            user,
            old_status=termination.status,
            new_status=f"{termination.status} — Failed Code Attempt",
            detail={
                "termination_no": termination.termination_no,
                "attempted_code": str(code).strip()[:8] + "...",
            },
            note="Failed authorization code verification attempt",
        )
        return False, "Invalid authorization code"

    # Mark code as verified
    with transaction.atomic():
        termination = TerminationTransaction.objects.select_for_update().get(id=termination.id)
        termination.code_verified = True
        termination.code_verified_at = timezone.now()
        termination.code_verified_by = user
        termination.status = TerminationTransaction.Status.IN_PROGRESS
        termination.save(update_fields=[
            "code_verified", "code_verified_at", "code_verified_by",
            "status", "updated_at",
        ])

        record_audit(
            termination.application,
            HouseAuditTrail.Action.STATUS_CHANGED,
            user,
            old_status="Termination Approved",
            new_status="Termination In Progress (Code Verified)",
            detail={
                "termination_no": termination.termination_no,
                "code_verified": True,
            },
            note="Authorization code verified. Termination authorized to proceed.",
        )

    return True, "Authorization code verified. Termination authorized."


def process_termination(termination, user, authorization_code=None, **kwargs):
    """
    Process a completed termination — closes the allocation, releases the house,
    and (for transfers) creates the new allocation atomically.

    SECURITY: Requires a verified authorization code. The termination must have
    gone through: create → approve → verify_code → process.

    This is the core termination processor that:
    0. Verifies authorization code (must be code_verified=True)
    1. Validates all preconditions
    2. Closes the active allocation
    3. Releases physical rooms
    4. Recalculates house capacity
    5. For Transfers: allocates the target house
    6. Writes AllocationLog + HouseAuditTrail
    7. Updates the application state

    Returns the updated TerminationTransaction.
    """
    from .models import TerminationTransaction

    # SECURITY: Authorization code must be verified
    if not termination.code_verified:
        raise ValueError(
            "Termination cannot be processed: authorization code has not been verified. "
            "The code must be verified before processing."
        )

    if termination.status not in (
        TerminationTransaction.Status.APPROVED,
        TerminationTransaction.Status.IN_PROGRESS,
    ):
        raise ValueError(
            f"Cannot process termination in '{termination.status}' status. "
            f"Must be Approved or In Progress."
        )

    allocation = termination.allocation
    case = termination.case
    application = allocation.application

    with transaction.atomic():
        termination = TerminationTransaction.objects.select_for_update().get(id=termination.id)
        allocation = Allocation.objects.select_for_update().get(id=allocation.id)

        # Re-verify authorization under lock
        if not termination.code_verified:
            raise ValueError(
                "Termination cannot be processed: authorization code verification was revoked."
            )

        if allocation.status != Allocation.Status.ACTIVE:
            raise ValueError(
                f"Allocation {allocation.allocation_no} is no longer active "
                f"(status: {allocation.status}). Cannot process termination."
            )

        # ── 1. Close the allocation ────────────────────────────────────
        allocation.status = Allocation.Status.TERMINATED
        allocation.occupancy_status = Allocation.Occupancy.VACATED
        allocation.terminated_at = timezone.now()
        allocation.terminated_by = user
        allocation.termination_reason = (
            f"[{case.code}] {termination.termination_reason}"
        )
        allocation.updated_by = user
        allocation.save(update_fields=[
            "status", "occupancy_status", "terminated_at", "terminated_by",
            "termination_reason", "updated_at",
        ])

        # ── 2. Release physical rooms ──────────────────────────────────
        house = allocation.house
        if allocation.allocation_unit_type == Allocation.AllocationUnit.HOUSE:
            house.free_all_rooms()
        elif allocation.room_label:
            house.free_room(allocation.room_label)
        house.save()

        # ── 3. Sync application ────────────────────────────────────────
        application = HouseApplication.objects.select_for_update().get(id=application.id)
        old_app_status = application.status

        # For transfers, the application stays Allocated (new allocation incoming)
        if case.category != "Transfer":
            application.status = HouseApplication.Status.WAITING_FOR_ALLOCATION
            application.allocated_house = None
            application.allocated_room_label = ""
            application.allocated_room_number = ""
            application.allocated_at = None
            application.allocated_by = None
            application.allocation_notes = ""
            application.allocation_confidence = 0
            application.deallocation_reason = (
                f"[{case.code}] {termination.termination_reason}"
            )
            application.save()

        # ── 4. Handle Transfer case ────────────────────────────────────
        new_allocation = None
        if case.category == "Transfer" and termination.target_house:
            target_house = House.objects.select_for_update().get(
                id=termination.target_house_id
            )
            if not target_house.is_available:
                raise ValueError(
                    f"Target house {target_house.house_id} is no longer available"
                )

            # Create new allocation for the target house
            transfer_room = allocation.room_label if (
                allocation.allocation_unit_type == Allocation.AllocationUnit.ROOM
            ) else ""
            new_allocation = allocate_application(
                application, target_house, user, "Manual",
                notes=(
                    f"Transfer from {house.house_number} to "
                    f"{target_house.house_number}. {termination.termination_reason}"
                ).strip(),
                allow_existing=True,
                room_label=termination.room_label if termination.room_label else transfer_room,
            )
            termination.target_allocation = new_allocation

            # Log transfer
            AllocationLog.objects.create(
                application=application,
                application_no=application.application_no,
                employee_name=application.employee_name,
                employee_id=application.employee_id,
                house=target_house,
                house_hid=target_house.house_id,
                action=AllocationLog.Action.TRANSFERRED,
                old_status=old_app_status,
                new_status=application.status,
                priority_score=application.priority_score,
                eligible_category=application.eligible_house_category,
                score_breakdown=application.score_breakdown,
                recommendation_reason=(
                    f"Transfer from {house.house_number} to "
                    f"{target_house.house_number}"
                ),
                notes=termination.termination_reason,
                performed_by=user,
                performed_by_name=user.get_full_name() if user else "",
            )

            record_audit(
                application,
                HouseAuditTrail.Action.TRANSFERRED,
                user,
                old_status=old_app_status,
                new_status=application.status,
                detail={
                    "termination_no": termination.termination_no,
                    "old_house": house.house_number,
                    "new_house": target_house.house_number,
                    "allocation_no": new_allocation.allocation_no if new_allocation else "",
                },
                note=f"House transferred: {house.house_number} → {target_house.house_number}",
            )
        else:
            # ── 5. Non-transfer: log deallocation ──────────────────────
            AllocationLog.objects.create(
                application=application,
                application_no=application.application_no,
                employee_name=application.employee_name,
                employee_id=application.employee_id,
                house=house,
                house_hid=house.house_id,
                allocation_unit_type=allocation.allocation_unit_type,
                room_label=allocation.room_label,
                room_number=allocation.room_number,
                action=AllocationLog.Action.DEALLOCATED,
                old_status=old_app_status,
                new_status=application.status,
                priority_score=application.priority_score,
                eligible_category=application.eligible_house_category,
                score_breakdown=application.score_breakdown,
                recommendation_reason=(
                    f"[{case.code}] Terminated: {termination.termination_reason}"
                ),
                notes=termination.termination_reason,
                performed_by=user,
                performed_by_name=user.get_full_name() if user else "",
            )

            record_audit(
                application,
                HouseAuditTrail.Action.TERMINATED,
                user,
                old_status=old_app_status,
                new_status=application.status,
                detail={
                    "termination_no": termination.termination_no,
                    "allocation_no": allocation.allocation_no,
                    "house_id": house.house_id,
                    "room_label": allocation.room_label or None,
                    "case": case.code,
                },
                note=f"Allocation terminated: {termination.termination_reason}",
            )

        # ── 6. Mark termination completed ──────────────────────────────
        termination.status = TerminationTransaction.Status.COMPLETED
        termination.house_release_date = timezone.now().date()
        if new_allocation:
            termination.target_allocation = new_allocation
        termination.save(update_fields=[
            "status", "house_release_date", "target_allocation",
            "updated_at",
        ])

        # Final audit
        record_audit(
            termination.application,
            HouseAuditTrail.Action.STATUS_CHANGED,
            user,
            old_status="Termination In Progress",
            new_status="Termination Completed",
            detail={
                "termination_no": termination.termination_no,
                "allocation_no": allocation.allocation_no,
                "house_id": house.house_id,
                "case": case.code,
                "authorization_verified": True,
                "inspection_baseline": bool(termination.inspection_baseline),
                "house_released": True,
            },
            note=f"Termination completed. House {house.house_number} released.",
        )

    return termination


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  15. PRE-INSPECTION VALIDATION  (mandatory before termination)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def validate_pre_inspection(allocation):
    """Validate that a post-inspection record exists and is consistent with the
    current allocation before allowing termination to proceed.

    Returns a dict:
      {
        "valid": bool,
        "post_inspection": PostInspection | None,
        "message": str,
        "details": {
          "post_inspection_found": bool,
          "post_inspection_status": str,
          "house_number_match": bool,
          "allocation_status_match": bool,
          "house_status_match": bool,
        }
      }
    """
    from .models import PostInspection, House

    house = allocation.house
    employee_id = allocation.employee_id

    # ── 1. Look up the most recent post-inspection for this house ────
    post_inspection = (
        PostInspection.objects
        .filter(house=house, is_active=True)
        .order_by("-scheduled_date")
        .first()
    )

    if not post_inspection:
        return {
            "valid": False,
            "post_inspection": None,
            "message": (
                f"No post-inspection record found for house {house.house_number or house.house_id}. "
                f"House {house.house_number or house.house_id} must undergo a post-occupancy "
                f"inspection before termination can proceed."
            ),
            "details": {
                "post_inspection_found": False,
                "post_inspection_status": "",
                "house_number_match": False,
                "allocation_status_match": False,
                "house_status_match": False,
            },
        }

    # ── 2. Post-inspection must be completed ─────────────────────────
    if post_inspection.status not in (
        PostInspection.Status.COMPLETED,
    ):
        return {
            "valid": False,
            "post_inspection": post_inspection,
            "message": (
                f"Post-inspection for house {house.house_number or house.house_id} "
                f"is in '{post_inspection.status}' status. It must be completed "
                f"before termination can proceed."
            ),
            "details": {
                "post_inspection_found": True,
                "post_inspection_status": post_inspection.status,
                "house_number_match": True,
                "allocation_status_match": True,
                "house_status_match": True,
            },
        }

    # ── 3. House number must match ───────────────────────────────────
    pi_house_number = post_inspection.house_number or post_inspection.house.house_number or post_inspection.house.house_id
    alloc_house_number = house.house_number or house.house_id
    house_number_match = (pi_house_number == alloc_house_number)

    if not house_number_match:
        return {
            "valid": False,
            "post_inspection": post_inspection,
            "message": (
                f"Post-inspection house number mismatch: inspection is for "
                f"{pi_house_number} but allocation is for {alloc_house_number}."
            ),
            "details": {
                "post_inspection_found": True,
                "post_inspection_status": post_inspection.status,
                "house_number_match": False,
                "allocation_status_match": True,
                "house_status_match": True,
            },
        }

    # ── 4. Compare allocation status with post-inspection snapshot ────
    allocation_status_match = True
    if post_inspection.allocation_status_snapshot:
        allocation_status_match = (
            post_inspection.allocation_status_snapshot == allocation.status
        )

    # ── 5. Compare house status with post-inspection snapshot ────────
    house_status_match = True
    if post_inspection.house_status_snapshot:
        house_status_match = (
            post_inspection.house_status_snapshot == house.status
        )

    # ── 6. If condition is Critical, warn but allow with approval ────
    if post_inspection.overall_condition == "Critical":
        return {
            "valid": True,
            "post_inspection": post_inspection,
            "message": (
                f"Post-inspection completed for house {alloc_house_number}. "
                f"Condition rated CRITICAL — termination allowed but "
                f"damage costs of {post_inspection.damage_costs} may apply."
            ),
            "details": {
                "post_inspection_found": True,
                "post_inspection_status": post_inspection.status,
                "house_number_match": house_number_match,
                "allocation_status_match": allocation_status_match,
                "house_status_match": house_status_match,
            },
        }

    # ── 7. All checks passed — termination allowed ───────────────────
    return {
        "valid": True,
        "post_inspection": post_inspection,
        "message": (
            f"Pre-inspection validated for house {alloc_house_number}. "
            f"Post-inspection status: {post_inspection.status}, "
            f"condition: {post_inspection.overall_condition or 'N/A'}. "
            f"Termination may proceed."
        ),
        "details": {
            "post_inspection_found": True,
            "post_inspection_status": post_inspection.status,
            "house_number_match": house_number_match,
            "allocation_status_match": allocation_status_match,
            "house_status_match": house_status_match,
        },
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  16. TERMINATE-WITH-CODE  (Allocated Houses sidebar integration)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def terminate_with_code(allocation, authorization_code, user, reason=""):
    """
    Execute a housing allocation termination by validating a previously generated
    termination authorization code.

    This is the single entry point used by the Allocated Houses table sidebar
    when a user clicks "Terminate" and enters an authorization code that was
    previously generated and approved from the Termination Management page.

    Validation chain:
      1. Authorization code must exist, be active, and be unused
      2. Code must belong to the exact employee, allocation, and house
      3. Termination case must be valid and active
      4. Required inspection/house-condition requirements must be satisfied
        (inspection issues must be resolved)
      5. Admin/Manager approval must exist (status = Approved)
      6. Allocation must still be active and eligible

    Execution chain (atomic):
      1. Close the allocation
      2. Record termination
      3. Release house (free rooms)
      4. Recalculate occupancy/capacity
      5. Set house available
      6. Preserve complete history & audit trail
      7. Invalidate code (single-use: code consumed)

    Returns the terminated TerminationTransaction.
    """
    from .models import TerminationTransaction

    if not authorization_code or not str(authorization_code).strip():
        raise ValueError("Authorization code is required")

    code = str(authorization_code).strip()

    # ── 1. Find termination by authorization code ────────────────────
    termination = TerminationTransaction.objects.select_for_update().filter(
        authorization_code=code,
        is_active=True,
    ).select_related(
        "allocation", "application", "house", "case",
        "target_house", "approved_by", "created_by",
    ).first()

    if not termination:
        raise ValueError("Invalid or unknown authorization code")

    # ── 2. Code must be approved but not yet consumed ─────────────────
    if termination.status not in (
        TerminationTransaction.Status.APPROVED,
        TerminationTransaction.Status.IN_PROGRESS,
    ):
        raise ValueError(
            f"Authorization code is not valid for termination in "
            f"'{termination.status}' status"
        )

    # ── 3. Code must belong to the exact allocation ──────────────────
    if str(termination.allocation_id) != str(allocation.id):
        raise ValueError(
            "Authorization code does not belong to this allocation. "
            "The code was issued for a different allocation."
        )

    # ── 4. Code must belong to the exact employee ────────────────────
    if termination.employee_id != allocation.employee_id:
        raise ValueError(
            f"Authorization code employee mismatch: code is for "
            f"{termination.employee_id}, allocation belongs to "
            f"{allocation.employee_id}"
        )

    # ── 5. Code must belong to the exact house ───────────────────────
    if str(termination.house_id) != str(allocation.house_id):
        raise ValueError(
            "Authorization code does not belong to this house. "
            "The code was issued for a different house."
        )

    # ── 6. Allocation must still be active ────────────────────────────
    if allocation.status != Allocation.Status.ACTIVE:
        raise ValueError(
            f"Allocation {allocation.allocation_no} is no longer active "
            f"(status: {allocation.status}). Cannot process termination."
        )

    # ── 7. Inspection requirements must be satisfied ─────────────────
    if termination.inspection_status not in (
        TerminationTransaction.InspectionStatus.NOT_REQUIRED,
        TerminationTransaction.InspectionStatus.WAIVED,
    ):
        if not termination.issues_resolved:
            raise ValueError(
                "Cannot terminate: inspection issues are not yet resolved. "
                "Please resolve inspection discrepancies from the Termination "
                "Management page before using this code."
            )

    # ── 8. Approval must exist ───────────────────────────────────────
    if termination.approval_status != TerminationTransaction.Status.APPROVED:
        raise ValueError(
            "Authorization code has not been approved. "
            "The termination must be approved before this code can be used."
        )

    # ── 8b. Pre-inspection validation (mandatory) ────────────────────
    pre_inspection = validate_pre_inspection(allocation)
    if not pre_inspection["valid"]:
        raise ValueError(pre_inspection["message"])

    # ── 9. Execute termination atomically ────────────────────────────
    case = termination.case
    application = allocation.application

    with transaction.atomic():
        termination = TerminationTransaction.objects.select_for_update().get(id=termination.id)
        allocation = Allocation.objects.select_for_update().get(id=allocation.id)

        if allocation.status != Allocation.Status.ACTIVE:
            raise ValueError(
                f"Allocation {allocation.allocation_no} is no longer active. "
                f"Cannot process termination."
            )

        # ── 9a. Close the allocation ─────────────────────────────────
        allocation.status = Allocation.Status.TERMINATED
        allocation.occupancy_status = Allocation.Occupancy.VACATED
        allocation.terminated_at = timezone.now()
        allocation.terminated_by = user
        allocation.termination_reason = (
            f"[{case.code}] {termination.termination_reason}"
        )
        allocation.updated_by = user
        allocation.save(update_fields=[
            "status", "occupancy_status", "terminated_at", "terminated_by",
            "termination_reason", "updated_at",
        ])

        # ── 9b. Release physical rooms ──────────────────────────────
        house = allocation.house
        if allocation.allocation_unit_type == Allocation.AllocationUnit.HOUSE:
            house.free_all_rooms()
        elif allocation.room_label:
            house.free_room(allocation.room_label)
        house.save()

        # ── 9c. Sync application ────────────────────────────────────
        app = HouseApplication.objects.select_for_update().get(id=application.id)
        old_app_status = app.status

        if case.category != "Transfer":
            app.status = HouseApplication.Status.WAITING_FOR_ALLOCATION
            app.allocated_house = None
            app.allocated_room_label = ""
            app.allocated_room_number = ""
            app.allocated_at = None
            app.allocated_by = None
            app.allocation_notes = ""
            app.allocation_confidence = 0
            app.deallocation_reason = (
                f"[{case.code}] {termination.termination_reason}"
            )
            app.save()

        # ── 9d. Handle Transfer case ────────────────────────────────
        new_allocation = None
        if case.category == "Transfer" and termination.target_house:
            target_house = House.objects.select_for_update().get(
                id=termination.target_house_id
            )
            if not target_house.is_available:
                raise ValueError(
                    f"Target house {target_house.house_id} is no longer available"
                )

            transfer_room = allocation.room_label if (
                allocation.allocation_unit_type == Allocation.AllocationUnit.ROOM
            ) else ""
            new_allocation = allocate_application(
                app, target_house, user, "Manual",
                notes=(
                    f"Transfer from {house.house_number} to "
                    f"{target_house.house_number}. {termination.termination_reason}"
                ).strip(),
                allow_existing=True,
                room_label=termination.room_label if termination.room_label else transfer_room,
            )
            termination.target_allocation = new_allocation

            AllocationLog.objects.create(
                application=app,
                application_no=app.application_no,
                employee_name=app.employee_name,
                employee_id=app.employee_id,
                house=target_house,
                house_hid=target_house.house_id,
                action=AllocationLog.Action.TRANSFERRED,
                old_status=old_app_status,
                new_status=app.status,
                priority_score=app.priority_score,
                eligible_category=app.eligible_house_category,
                score_breakdown=app.score_breakdown,
                recommendation_reason=(
                    f"Transfer from {house.house_number} to "
                    f"{target_house.house_number}"
                ),
                notes=termination.termination_reason,
                performed_by=user,
                performed_by_name=user.get_full_name() if user else "",
            )

            record_audit(
                app,
                HouseAuditTrail.Action.TRANSFERRED,
                user,
                old_status=old_app_status,
                new_status=app.status,
                detail={
                    "termination_no": termination.termination_no,
                    "old_house": house.house_number,
                    "new_house": target_house.house_number,
                    "allocation_no": new_allocation.allocation_no if new_allocation else "",
                },
                note=f"House transferred: {house.house_number} → {target_house.house_number}",
            )
        else:
            # ── 9e. Non-transfer: log deallocation ──────────────────
            AllocationLog.objects.create(
                application=app,
                application_no=app.application_no,
                employee_name=app.employee_name,
                employee_id=app.employee_id,
                house=house,
                house_hid=house.house_id,
                allocation_unit_type=allocation.allocation_unit_type,
                room_label=allocation.room_label,
                room_number=allocation.room_number,
                action=AllocationLog.Action.DEALLOCATED,
                old_status=old_app_status,
                new_status=app.status,
                priority_score=app.priority_score,
                eligible_category=app.eligible_house_category,
                score_breakdown=app.score_breakdown,
                recommendation_reason=(
                    f"[{case.code}] Terminated: {termination.termination_reason}"
                ),
                notes=termination.termination_reason,
                performed_by=user,
                performed_by_name=user.get_full_name() if user else "",
            )

            record_audit(
                app,
                HouseAuditTrail.Action.TERMINATED,
                user,
                old_status=old_app_status,
                new_status=app.status,
                detail={
                    "termination_no": termination.termination_no,
                    "allocation_no": allocation.allocation_no,
                    "house_id": house.house_id,
                    "room_label": allocation.room_label or None,
                    "case": case.code,
                },
                note=f"Allocation terminated: {termination.termination_reason}",
            )

        # ── 9f. Mark termination completed ──────────────────────────
        termination.status = TerminationTransaction.Status.COMPLETED
        termination.house_release_date = timezone.now().date()
        termination.code_verified = True
        termination.code_verified_at = timezone.now()
        termination.code_verified_by = user
        if new_allocation:
            termination.target_allocation = new_allocation
        termination.save(update_fields=[
            "status", "house_release_date", "target_allocation",
            "code_verified", "code_verified_at", "code_verified_by",
            "updated_at",
        ])

        # ── 9g. Final audit trail ───────────────────────────────────
        record_audit(
            termination.application,
            HouseAuditTrail.Action.STATUS_CHANGED,
            user,
            old_status="Termination Approved",
            new_status="Termination Completed (via Authorization Code)",
            detail={
                "termination_no": termination.termination_no,
                "allocation_no": allocation.allocation_no,
                "house_id": house.house_id,
                "case": case.code,
                "authorization_code_used": True,
                "code_invalidated": True,
                "inspection_baseline": bool(termination.inspection_baseline),
                "house_released": True,
            },
            note=f"Termination completed via authorization code. House {house.house_number} released.",
        )

    return termination
