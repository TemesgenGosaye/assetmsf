"""
Allocation Engine – calculates priority scores and auto-allocates houses.

Scoring formula (configurable weights):
  score = (grade_norm * w_grade) + (service_norm * w_service) +
          (family_norm * w_family) + (disability_norm * w_disability) +
          (fifo_norm * w_fifo)

Each component is normalised to 0-100 before weighting.
FIFO tie-breaker: when scores are equal, earlier submission date wins.
"""

from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from .models import (
    House, HouseApplication, ScoringConfig, AllocationLog, HouseTransfer,
    get_eligible_category,
)
from .notifications_service import notify_status_change, send_house_notification


def _get_active_config() -> ScoringConfig:
    """Return the active scoring config, or create a default."""
    cfg = ScoringConfig.objects.filter(is_active=True).first()
    if not cfg:
        cfg = ScoringConfig.objects.create(name="Default")
    return cfg


def _normalise(value, min_val, max_val):
    """Normalise value to 0-100 range."""
    if max_val == min_val:
        return Decimal("50")
    v = Decimal(str(value))
    return max(Decimal("0"), min(Decimal("100"),
        (v - Decimal(str(min_val))) / (Decimal(str(max_val)) - Decimal(str(min_val))) * 100
    ))


def calculate_priority_score(application: HouseApplication) -> Decimal:
    """
    Calculate priority score for a single application.
    Returns a Decimal score (0-100 range after weighting).
    """
    cfg = _get_active_config()

    # Job grade: higher grade → higher score (range 1-20)
    try:
        grade = int(str(application.job_grade).strip())
    except (ValueError, TypeError):
        grade = 1
    grade_score = _normalise(grade, 1, 20)

    # Years of service: more years → higher score (cap at 30)
    service_score = _normalise(min(application.years_of_service, 30), 0, 30)

    # Family size: larger family → higher score (cap at 10)
    family_score = _normalise(min(application.family_size, 10), 1, 10)

    # Disability: boolean → 100 or 0
    disability_score = Decimal("100") if application.has_disability else Decimal("0")

    # FIFO: earlier submission → higher score (normalised among active queue)
    fifo_score = _calculate_fifo_score(application)

    # Weighted sum
    total = (
        grade_score * cfg.job_grade_weight +
        service_score * cfg.years_of_service_weight +
        family_score * cfg.family_size_weight +
        disability_score * cfg.disability_weight +
        fifo_score * cfg.fifo_weight
    ) / 100

    return total.quantize(Decimal("0.01"))


def _calculate_fifo_score(application: HouseApplication) -> Decimal:
    """
    FIFO scoring: earliest submission gets 100, latest gets 0.
    Normalised across all active queue applications of same category.
    """
    submitted = application.submitted_at or application.created_at
    if not submitted:
        return Decimal("0")

    category = application.eligible_house_category or get_eligible_category(application.job_grade)
    siblings = HouseApplication.objects.filter(
        is_active=True,
        eligible_house_category=category,
        status__in=["Submitted", "Under Review", "Verified", "Waiting for Allocation"],
    ).exclude(id=application.id).values_list("submitted_at", "created_at")

    if not siblings.exists():
        return Decimal("100")

    timestamps = []
    for sub, created in siblings:
        ts = sub or created
        if ts:
            timestamps.append(ts)
    timestamps.append(submitted)
    timestamps.sort()

    if len(timestamps) < 2:
        return Decimal("100")

    idx = timestamps.index(submitted)
    return _normalise(len(timestamps) - idx, 1, len(timestamps))


def recalculate_all_scores(category: str = None):
    """
    Recalculate priority scores for all queued applications.
    Optionally filter by eligible_house_category.
    """
    qs = HouseApplication.objects.filter(
        is_active=True,
        status__in=["Submitted", "Under Review", "Verified", "Waiting for Allocation"],
    )
    if category:
        qs = qs.filter(eligible_house_category=category)

    for app in qs:
        app.priority_score = calculate_priority_score(app)
        if not app.eligible_house_category:
            app.eligible_house_category = get_eligible_category(app.job_grade)
        app.save(update_fields=["priority_score", "eligible_house_category", "updated_at"])


def get_ranked_queue(category: str = None):
    """
    Return applications ranked by priority score (desc), then FIFO (asc).
    """
    qs = HouseApplication.objects.filter(
        is_active=True,
        status__in=["Submitted", "Under Review", "Verified", "Waiting for Allocation"],
    )
    if category:
        qs = qs.filter(eligible_house_category=category)
    return qs.order_by("-priority_score", "submitted_at", "created_at")


def auto_allocate_house(house: House, user=None, application_id=None):
    """
    Automatically allocate an available house.

    If application_id is provided, allocate to that specific application (after
    validating eligibility).  Otherwise fall back to the highest-priority eligible
    applicant in the queue.

    1. Find eligible applicant(s)
    2. Rank by priority_score DESC, then submitted_at ASC (FIFO tie-breaker)
    3. Allocate to the selected applicant
    4. Record allocation log
    5. Update queue positions
    """
    with transaction.atomic():
        if application_id:
            try:
                winner = HouseApplication.objects.select_for_update().get(
                    id=application_id,
                    is_active=True,
                    eligible_house_category=house.house_type,
                    status__in=["Submitted", "Under Review", "Verified", "Waiting for Allocation"],
                )
            except HouseApplication.DoesNotExist:
                return None
        else:
            eligible_apps = HouseApplication.objects.select_for_update().filter(
                is_active=True,
                eligible_house_category=house.house_type,
                status__in=["Submitted", "Under Review", "Verified", "Waiting for Allocation"],
            ).order_by("-priority_score", "submitted_at", "created_at")

            if not eligible_apps.exists():
                return None

            winner = eligible_apps.first()

        # Perform allocation
        winner.status = "Allocated"
        winner.allocated_house = house
        winner.allocated_at = timezone.now()
        winner.allocated_by = user
        winner.save(update_fields=[
            "status", "allocated_house", "allocated_at", "allocated_by", "updated_at",
        ])

        # Mark house as occupied
        house.status = "Inactive"
        house.save(update_fields=["status", "updated_at"])

        # Log the allocation
        AllocationLog.objects.create(
            application=winner,
            house=house,
            action="auto_allocated",
            priority_score=winner.priority_score,
            eligible_category=winner.eligible_house_category,
            notes=f"Auto-allocated to highest priority applicant (score: {winner.priority_score})",
            performed_by=user,
        )

    # Update remaining queue positions (outside the atomic block)
    _update_queue_positions(winner.eligible_house_category)
    notify_status_change(winner, "Waiting for Allocation", "Allocated", performed_by=user)

    return winner


def manual_allocate_house(house: House, application: HouseApplication, user=None, notes=""):
    """
    Manually allocate a house to a specific application.
    Validates that the house type matches the applicant's eligible category.
    """
    if house.house_type != application.eligible_house_category:
        raise ValueError(
            f"House type '{house.house_type}' does not match applicant's "
            f"eligible category '{application.eligible_house_category}'."
        )
    with transaction.atomic():
        application.status = "Allocated"
        application.allocated_house = house
        application.allocated_at = timezone.now()
        application.allocated_by = user
        application.save(update_fields=[
            "status", "allocated_house", "allocated_at", "allocated_by", "updated_at",
        ])

        house.status = "Inactive"
        house.save(update_fields=["status", "updated_at"])

        AllocationLog.objects.create(
            application=application,
            house=house,
            action="manual_allocated",
            priority_score=application.priority_score,
            eligible_category=application.eligible_house_category,
            notes=notes or "Manual allocation by administrator",
            performed_by=user,
        )

    _update_queue_positions(application.eligible_house_category)
    notify_status_change(application, "Waiting for Allocation", "Allocated", performed_by=user)
    return application


def deallocate_house(application: HouseApplication, user=None, notes=""):
    """
    Deallocate a house from an application (reverse allocation).
    """
    old_house = application.allocated_house
    with transaction.atomic():
        house = application.allocated_house
        application.status = "Waiting for Allocation"
        application.allocated_house = None
        application.allocated_at = None
        application.allocated_by = None
        application.save(update_fields=[
            "status", "allocated_house", "allocated_at", "allocated_by", "updated_at",
        ])

        if house:
            house.status = "Active"
            house.save(update_fields=["status", "updated_at"])

        AllocationLog.objects.create(
            application=application,
            house=house,
            action="deallocated",
            priority_score=application.priority_score,
            eligible_category=application.eligible_house_category,
            notes=notes or "Deallocated by administrator",
            performed_by=user,
        )

    _update_queue_positions(application.eligible_house_category)
    notify_status_change(application, "Allocated", "Waiting for Allocation", performed_by=user)
    return application


def process_house_transfer(transfer: HouseTransfer, user=None):
    """
    Executes an approved house transfer: vacates current house, assigns target house,
    and updates resident applications.
    """
    if transfer.status != "Approved":
        raise ValueError("Transfer must be in Approved status to execute.")

    with transaction.atomic():
        # Find active allocation for employee
        app = HouseApplication.objects.filter(
            employee_id=transfer.employee_id,
            status="Allocated",
            is_active=True
        ).first()

        # Release current house
        if transfer.current_house:
            transfer.current_house.status = "Active"
            transfer.current_house.save(update_fields=["status", "updated_at"])

        # Occupy target house
        if transfer.target_house:
            transfer.target_house.status = "Inactive"
            transfer.target_house.save(update_fields=["status", "updated_at"])

        if app:
            app.allocated_house = transfer.target_house
            app.allocated_at = timezone.now()
            app.allocated_by = user
            app.save(update_fields=["allocated_house", "allocated_at", "allocated_by", "updated_at"])

        transfer.status = "Completed"
        transfer.completed_at = timezone.now()
        transfer.approved_by = user
        transfer.save(update_fields=["status", "completed_at", "approved_by", "updated_at"])

        if app:
            AllocationLog.objects.create(
                application=app,
                house=transfer.target_house,
                action="reallocated",
                priority_score=app.priority_score,
                eligible_category=app.eligible_house_category,
                notes=f"Transfer completed: {transfer.transfer_no}",
                performed_by=user,
            )

    if app and app.requester:
        send_house_notification(
            user=app.requester,
            title="House Transfer Completed",
            message=f"Your house transfer ({transfer.transfer_no}) to House {transfer.target_house.house_id} is complete.",
            notification_type="success",
            link=f"/house-application/status?id={app.id}",
        )
    return transfer


def batch_allocate_all(user=None):
    """
    One-click batch allocation: allocate every available Active house
    to the highest-priority eligible applicant. Returns a list of results.
    """
    results = []
    available = list(House.objects.filter(status="Active"))
    for house in available:
        winner = auto_allocate_house(house, user=user)
        results.append({
            "house_id": house.house_id,
            "house_number": house.house_number,
            "house_type": house.house_type,
            "allocated_to": winner.employee_name if winner else None,
            "application_no": winner.application_no if winner else None,
            "score": str(winner.priority_score) if winner else None,
        })
    return results


def _update_queue_positions(category: str):
    """Recalculate and update priority scores for remaining queued applicants."""
    recalculate_all_scores(category)
