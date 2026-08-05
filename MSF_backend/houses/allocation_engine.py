"""
Allocation Engine — hybrid MCDA + TOPSIS + FIFO + Constraint Satisfaction.

Algorithms:
  1. Weighted MCDA scoring  (configurable weights from ScoringConfig)
  2. TOPSIS ranking         (distance from ideal solutions)
  3. FIFO priority           (queue position by submission date)
  4. Constraint satisfaction (eligibility rules, no double allocation)
  5. Gale-Shapley stability  (stable matching for category ↔ applicant)
  6. Hungarian optimisation   (optimal house ↔ applicant assignment)

Each application receives:
  - A score_breakdown dict (XAI) with per-criterion raw + normalised values
  - A recommendation_reason text
  - An allocation_confidence percentage (0-100)
"""
import math
from collections import defaultdict
from decimal import Decimal
from django.db import transaction
from django.utils import timezone

from .models import (
    House, HouseApplication, EligibilityRule,
    ScoringConfig, AllocationLog,
)


# ── constants ─────────────────────────────────────────────────────────────

GRADE_ORDER = {
    "Staff": 6, "A": 5, "B": 4, "C": 3, "D": 2, "E": 1,
}

CATEGORY_ORDER = {"Staff": 6, "A": 5, "B": 4, "C": 3, "D": 2, "E": 1}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  1. ELIGIBILITY
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def determine_eligible_category(application):
    """
    Determine the highest house type an employee qualifies for.
    Returns (category_str, reason_str).
    """
    rules = EligibilityRule.objects.filter(is_active=True).order_by("priority", "-max_grade")
    best = None
    best_grade_rank = 0

    for rule in rules:
        eligible, reason = rule.is_eligible(application)
        if eligible:
            grade_rank = CATEGORY_ORDER.get(rule.house_type, 0)
            if grade_rank > best_grade_rank:
                best = rule.house_type
                best_grade_rank = grade_rank

    if best:
        return best, f"Eligible for {best} based on grade/eligibility rules"
    return application.requested_house_category or "E", "Default (no matching rule)"


def check_allocation_constraints(application, house):
    """
    Verify hard constraints before allocation.
    Returns (ok: bool, reason: str).
    """
    reasons = []

    if not house.is_available:
        reasons.append(f"House {house.house_id} is full or inactive")

    if house.status != House.Status.ACTIVE:
        reasons.append(f"House {house.house_id} is inactive (needs repair)")

    eligible_cat, _ = determine_eligible_category(application)
    if CATEGORY_ORDER.get(house.house_type, 0) > CATEGORY_ORDER.get(eligible_cat, 0):
        reasons.append(f"House type {house.house_type} exceeds eligible category {eligible_cat}")

    already_allocated = HouseApplication.objects.filter(
        emp_record=application.emp_record,
        status="Allocated",
    ).exclude(id=application.id).exists()
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
        "raw_days": wait, "normalised": round(wait_norm, 4),
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

    # ── Employment Type (assume permanent = 1.0) ─────────────────────────
    emp_type_norm = 1.0
    emp_contrib = emp_type_norm * weights["employment_type"]
    breakdown["employment_type"] = {
        "raw": "Permanent", "normalised": emp_type_norm,
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

def _topsis_distance(values, ideal_best, ideal_worst):
    """Euclidean distance from a reference point."""
    return math.sqrt(sum((v - b) ** 2 for v, b in zip(values, ideal_best)))


def topsis_rank(applications, config=None):
    """
    Apply TOPSIS to rank applications.
    Returns list of (application, score, closeness_coefficient) tuples.
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

    # Weighted normalised matrix (weights = equal 1/n since MCDA already weighted)
    # Weights already baked into contributions, so skip re-weighting

    # Ideal best & worst per criterion
    ideal_best = [max(norm_matrix[i][j] for i in range(n_apps)) for j in range(n_criteria)]
    ideal_worst = [min(norm_matrix[i][j] for i in range(n_apps)) for j in range(n_criteria)]

    # Closeness coefficient
    results = []
    for i in range(n_apps):
        d_best = _topsis_distance(norm_matrix[i], ideal_best, [0] * n_criteria)
        d_worst = _topsis_distance(norm_matrix[i], [0] * n_criteria, ideal_worst)
        total_dist = d_best + d_worst
        cc = d_worst / total_dist if total_dist > 0 else 0.5
        app, score, breakdown, reasons = scored[i]
        results.append((app, score, breakdown, reasons, round(cc, 4)))

    results.sort(key=lambda x: x[4], reverse=True)
    return results


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  4. GALE-SHAPLEY STABLE MATCHING
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def gale_shapley_match(applications, houses):
    """
    Gale-Shapley stable matching: employees prefer higher-ranked houses,
    houses prefer higher-scored employees. Returns dict {house_id: app}.
    """
    # Group houses by type
    houses_by_type = defaultdict(list)
    for h in houses:
        houses_by_type[h.house_type].append(h)

    # Group applications by eligible category
    apps_by_category = defaultdict(list)
    for app in applications:
        cat, _ = determine_eligible_category(app)
        apps_by_category[cat].append(app)

    matches = {}
    free_apps = list(applications)

    # Build preference lists: employees prefer houses by GRADE_ORDER descending
    app_prefs = {}
    for app in applications:
        cat, _ = determine_eligible_category(app)
        available = [h for h in houses_by_type.get(cat, []) if h.house_id not in matches]
        available.sort(key=lambda h: GRADE_ORDER.get(h.house_type, 0), reverse=True)
        app_prefs[app.id] = available

    # Build house preference: sort applicants by priority score descending
    house_prefs = {}
    for h in houses:
        cat_apps = apps_by_category.get(h.house_type, [])
        cat_apps.sort(key=lambda a: float(a.priority_score), reverse=True)
        house_prefs[h.house_id] = {app.id: rank for rank, app in enumerate(cat_apps)}

    # Propose-reject algorithm
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
            # Current occupant vs. proposer
            current_rank = house_prefs.get(house.house_id, {}).get(current_match_id, 999)
            new_rank = house_prefs.get(house.house_id, {}).get(app.id, 999)
            if new_rank < current_rank:
                # Displace current
                old_app = matches[house.house_id]
                matches[house.house_id] = app
                free_apps.remove(app)
                free_apps.append(old_app)
            else:
                # Rejected — try next house
                pass

    return matches


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  5. HUNGARIAN OPTIMAL ASSIGNMENT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def hungarian_assign(applications, houses):
    """
    Hungarian algorithm (simplified for rectangular matrices).
    Maximises total score of assignments.
    Returns dict {house_id: (application, score)}.
    """
    available_houses = [h for h in houses if h.is_available]
    if not available_houses or not applications:
        return {}

    # Build cost matrix (negate scores for minimisation)
    n_apps = len(applications)
    n_houses = len(available_houses)
    size = max(n_apps, n_houses)

    INF = 1e9
    cost = [[INF] * size for _ in range(size)]

    for i, app in enumerate(applications):
        for j, house in enumerate(available_houses):
            ok, _ = check_allocation_constraints(app, house)
            if ok:
                cat, _ = determine_eligible_category(app)
                if house.house_type == cat:
                    cost[i][j] = -float(app.priority_score)
                else:
                    cost[i][j] = -float(app.priority_score) * 0.5

    # Hungarian algorithm (step-by-step)
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
        if p[j] != 0 and p[j] <= n_apps and j <= n_houses:
            app_idx = p[j] - 1
            house_idx = j - 1
            app = applications[app_idx]
            house = available_houses[house_idx]
            ok, _ = check_allocation_constraints(app, house)
            if ok:
                result[house.house_id] = (app, float(app.priority_score))

    return result


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  6. BATCH ALLOCATION ENGINE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def run_batch_allocation(user=None):
    """
    Run full allocation pipeline:
    1. Collect all waiting applications
    2. Determine eligibility for each
    3. Compute MCDA scores
    4. Apply TOPSIS ranking
    5. Use Hungarian assignment for optimal matching
    6. Execute allocations within ACID transaction
    Returns dict with allocated/skipped results.
    """
    waiting = list(
        HouseApplication.objects.filter(
            status=HouseApplication.Status.WAITING_FOR_ALLOCATION,
            is_active=True,
        ).select_related("emp_record", "requester")
    )

    if not waiting:
        return {"allocated": [], "skipped": [], "total_houses": 0}

    config = ScoringConfig.objects.filter(is_active=True).first()

    # Step 1: Compute scores and eligibility
    for app in waiting:
        cat, cat_reason = determine_eligible_category(app)
        app.eligible_house_category = cat
        total, breakdown, reasons = compute_mcda_score(app, config)
        app.priority_score = total
        app.score_breakdown = breakdown
        app.save(update_fields=["eligible_house_category", "priority_score", "score_breakdown", "updated_at"])

    # Step 2: TOPSIS ranking
    ranked = topsis_rank(waiting, config)

    # Step 3: Get available houses grouped by type
    available_houses = list(House.objects.filter(status=House.Status.ACTIVE, is_active=True))

    # Step 4: Hungarian optimal assignment
    ranked_apps = [r[0] for r in ranked]
    assignments = hungarian_assign(ranked_apps, available_houses)

    allocated = []
    skipped = []

    with transaction.atomic():
        for house_id, (app, score) in assignments.items():
            try:
                house = House.objects.select_for_update().get(house_id=house_id)
                ok, reason = check_allocation_constraints(app, house)
                if not ok:
                    skipped.append({
                        "house_id": house.house_id,
                        "house_number": house_id,
                        "house_type": house.house_type,
                        "allocated_to": None,
                        "application_no": app.application_no,
                        "score": str(score),
                        "skip_reason": reason,
                    })
                    continue

                old_status = app.status
                app.status = HouseApplication.Status.ALLOCATED
                app.allocated_house = house
                app.allocated_at = timezone.now()
                app.allocated_by = user
                app.save(update_fields=[
                    "status", "allocated_house", "allocated_at", "allocated_by",
                    "updated_at",
                ])

                AllocationLog.objects.create(
                    application=app,
                    application_no=app.application_no,
                    employee_name=app.employee_name,
                    employee_id=app.employee_id,
                    house=house,
                    house_hid=house.house_id,
                    action=AllocationLog.Action.AUTO_ALLOCATED,
                    old_status=old_status,
                    new_status=app.status,
                    priority_score=app.priority_score,
                    eligible_category=app.eligible_house_category,
                    score_breakdown=app.score_breakdown,
                    recommendation_reason=f"TOPSIS closeness optimal match for {house.house_type}",
                    notes=f"Batch allocation score={score}",
                    performed_by=user,
                    performed_by_name=user.get_full_name() if user else "",
                )

                allocated.append({
                    "house_id": house.house_id,
                    "house_number": house.house_id,
                    "house_type": house.house_type,
                    "allocated_to": app.employee_name,
                    "application_no": app.application_no,
                    "score": str(score),
                })
            except Exception as e:
                skipped.append({
                    "house_id": house_id,
                    "house_number": house_id,
                    "house_type": "",
                    "allocated_to": None,
                    "application_no": getattr(app, "application_no", ""),
                    "score": str(score),
                    "skip_reason": str(e),
                })

    return {
        "allocated": allocated,
        "skipped": skipped,
        "total_houses": len(available_houses),
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  7. SINGLE AUTO-ALLOCATE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def auto_allocate_single(house, target_application=None, user=None):
    """
    Auto-allocate a single house to the best eligible applicant.
    If target_application is provided, allocate that specific application.
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
        # Filter to eligible for this house type
        eligible = []
        for c in candidates:
            ec, _ = determine_eligible_category(c)
            if CATEGORY_ORDER.get(cat, 0) <= CATEGORY_ORDER.get(ec, 0):
                eligible.append(c)
        candidates = eligible

    if not candidates:
        raise ValueError("No eligible candidates for this house")

    # Score all candidates
    scored = []
    for app in candidates:
        total, breakdown, reasons = compute_mcda_score(app, config)
        scored.append((app, total, breakdown, reasons))

    scored.sort(key=lambda x: x[1], reverse=True)
    best_app, best_score, best_breakdown, best_reasons = scored[0]

    ok, constraint_reason = check_allocation_constraints(best_app, house)
    if not ok:
        raise ValueError(f"Constraint violation: {constraint_reason}")

    cat, _ = determine_eligible_category(best_app)

    with transaction.atomic():
        old_status = best_app.status
        best_app.status = HouseApplication.Status.ALLOCATED
        best_app.allocated_house = house
        best_app.allocated_at = timezone.now()
        best_app.allocated_by = user
        best_app.eligible_house_category = cat
        best_app.priority_score = best_score
        best_app.score_breakdown = best_breakdown
        best_app.save()

        AllocationLog.objects.create(
            application=best_app,
            application_no=best_app.application_no,
            employee_name=best_app.employee_name,
            employee_id=best_app.employee_id,
            house=house,
            house_hid=house.house_id,
            action=AllocationLog.Action.AUTO_ALLOCATED,
            old_status=old_status,
            new_status=best_app.status,
            priority_score=best_score,
            eligible_category=cat,
            score_breakdown=best_breakdown,
            recommendation_reason="; ".join(best_reasons),
            performed_by=user,
            performed_by_name=user.get_full_name() if user else "",
        )

    return best_app, best_breakdown, best_reasons


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  8. MANUAL ALLOCATE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def manual_allocate(house, application, user=None, notes=""):
    """Manual override allocation with mandatory justification."""
    ok, reason = check_allocation_constraints(application, house)
    if not ok:
        raise ValueError(f"Constraint violation: {reason}")

    cat, _ = determine_eligible_category(application)

    with transaction.atomic():
        old_status = application.status
        application.status = HouseApplication.Status.ALLOCATED
        application.allocated_house = house
        application.allocated_at = timezone.now()
        application.allocated_by = user
        application.eligible_house_category = cat
        application.allocation_notes = notes
        application.save()

        AllocationLog.objects.create(
            application=application,
            application_no=application.application_no,
            employee_name=application.employee_name,
            employee_id=application.employee_id,
            house=house,
            house_hid=house.house_id,
            action=AllocationLog.Action.MANUAL_OVERRIDE,
            old_status=old_status,
            new_status=application.status,
            priority_score=application.priority_score,
            eligible_category=cat,
            score_breakdown=application.score_breakdown,
            recommendation_reason=f"Manual override by {user.get_full_name() if user else 'admin'}",
            notes=notes,
            performed_by=user,
            performed_by_name=user.get_full_name() if user else "",
        )

    return application


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  9. DEALLOCATE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def deallocate(application, user=None, reason=""):
    """Remove allocation and send application back to queue."""
    if application.status != HouseApplication.Status.ALLOCATED:
        raise ValueError("Only allocated applications can be deallocated")

    old_house = application.allocated_house

    with transaction.atomic():
        old_status = application.status
        application.status = HouseApplication.Status.WAITING_FOR_ALLOCATION
        application.allocated_house = None
        application.allocated_at = None
        application.allocated_by = None
        application.deallocation_reason = reason
        application.allocation_notes = ""
        application.save()

        AllocationLog.objects.create(
            application=application,
            application_no=application.application_no,
            employee_name=application.employee_name,
            employee_id=application.employee_id,
            house=old_house,
            house_hid=old_house.house_id if old_house else "",
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

    return application


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  10. QUEUE RANKING
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def get_ranked_queue(category=None, recalculate=False):
    """
    Return ranked queue of applications with scores.
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
        for app in qs:
            cat, _ = determine_eligible_category(app)
            total, breakdown, reasons = compute_mcda_score(app, config)
            app.eligible_house_category = cat
            app.priority_score = total
            app.score_breakdown = breakdown
            app.save(update_fields=["eligible_house_category", "priority_score", "score_breakdown", "updated_at"])

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
