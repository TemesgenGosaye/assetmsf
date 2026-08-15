"""
Backfill allocation unit (room vs whole house) for existing rows.

Rule: single applicants with family size ≤ 1 → ROOM_ALLOCATION; otherwise HOUSE_ALLOCATION.
"""
from django.db import migrations

ROOM = "ROOM_ALLOCATION"
HOUSE = "HOUSE_ALLOCATION"


def allocation_mode_for(marital_status, family_size):
    try:
        family_size = int(family_size or 1)
    except (TypeError, ValueError):
        family_size = 1
    marital = str(marital_status or "").strip().lower()
    return ROOM if marital == "single" and family_size <= 1 else HOUSE


def backfill(apps, schema_editor):
    HouseApplication = apps.get_model("houses", "HouseApplication")
    Allocation = apps.get_model("houses", "Allocation")

    apps_updated = 0
    for app in HouseApplication.objects.all().iterator():
        mode = allocation_mode_for(app.marital_status, app.family_size)
        if app.allocation_mode != mode:
            app.allocation_mode = mode
            app.save(update_fields=["allocation_mode"])
            apps_updated += 1

    allocs_updated = 0
    for alloc in Allocation.objects.select_related("application").all().iterator():
        app = alloc.application
        mode = app.allocation_mode or allocation_mode_for(app.marital_status, app.family_size)
        room_label = app.allocated_room_label or ""
        room_number = app.allocated_room_number or room_label
        changed = (
            alloc.allocation_unit_type != mode
            or alloc.room_label != room_label
            or alloc.room_number != room_number
            or alloc.marital_status != app.marital_status
            or alloc.family_size != (app.family_size or 1)
        )
        if changed:
            alloc.allocation_unit_type = mode
            alloc.room_label = room_label
            alloc.room_number = room_number
            alloc.marital_status = app.marital_status or ""
            alloc.family_size = app.family_size or 1
            alloc.save(update_fields=[
                "allocation_unit_type", "room_label", "room_number",
                "marital_status", "family_size",
            ])
            allocs_updated += 1

    print(f"Backfilled allocation_mode on {apps_updated} applications and {allocs_updated} allocations")


class Migration(migrations.Migration):

    dependencies = [
        ("houses", "0018_remove_houseopportunity_uniq_application_house_opportunity_and_more"),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
