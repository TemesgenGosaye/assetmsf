"""
Backfill Allocation records from existing allocated applications.

The authoritative `Allocation` model was introduced during modernization; every
application already in status "Allocated" with an allocated house is migrated
into a live Allocation record so the Allocated House module, occupancy and
audit reflect the real estate.

Idempotent — skips (application, house) pairs that already have an active
Allocation.
"""

from django.db import migrations


def _next_allocation_no(Allocation):
    last = (
        Allocation.objects.filter(allocation_no__startswith="ALLOC-")
        .order_by("-allocation_no")
        .first()
    )
    if last and last.allocation_no and last.allocation_no.split("-")[1].isdigit():
        return int(last.allocation_no.split("-")[1]) + 1
    return 1


def backfill_allocations(apps, schema_editor):
    HouseApplication = apps.get_model("houses", "HouseApplication")
    Allocation = apps.get_model("houses", "Allocation")

    allocated = list(
        HouseApplication.objects.filter(
            status="Allocated",
            allocated_house__isnull=False,
        ).select_related("allocated_house")
    )

    count = 0
    for app in allocated:
        exists = Allocation.objects.filter(
            application_id=app.id,
            house_id=app.allocated_house_id,
            status="Active",
        ).exists()
        if exists:
            continue

        num = _next_allocation_no(Allocation)
        Allocation.objects.create(
            allocation_no=f"ALLOC-{num:04d}",
            application_id=app.id,
            house_id=app.allocated_house_id,
            emp_record_id=app.emp_record_id or None,
            employee_id=app.employee_id,
            employee_name=app.employee_name,
            allocation_type="Manual",
            priority_score=app.priority_score,
            recommendation_score=app.allocation_confidence or 50,
            confidence=app.allocation_confidence or 50,
            recommendation_reason="Backfilled from existing allocated application",
            status="Active",
            occupancy_status="Occupied",
            allocated_at=app.allocated_at,
            effective_date=(app.allocated_at.date() if app.allocated_at else None),
            allocated_by_id=app.allocated_by_id,
            notes="Backfilled from existing allocation during modernization",
            created_by_id=app.allocated_by_id,
            updated_by_id=app.allocated_by_id,
        )
        count += 1

    print(f"  Backfilled {count} Allocation record(s)")


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("houses", "0014_houseapplication_allocation_confidence_and_more"),
    ]

    operations = [
        migrations.RunPython(backfill_allocations, noop),
    ]
