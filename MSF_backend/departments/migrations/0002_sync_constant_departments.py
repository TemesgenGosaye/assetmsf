"""
Data migration: sync the departments table to the constant canonical list.

- Reuses/renames existing rows where the canonical code or name already exists
  (e.g. Finance(FIN) -> Accounts(FIN), IT Department(IT) -> Information Technology(IT)).
- Creates missing canonical departments (e.g. GM-OFFICE, PROC-MGR).
- Reassigns employees from legacy departments to their canonical counterpart:
    Finance -> Accounts; It / IT Department -> Information Technology;
    Logistics -> Transport & Logistics; Operations / Planner -> Factory Process Management;
    HR -> Executive Management Office.
- Normalises users.department free-text values.
- Deletes any remaining department rows outside the canonical list.
"""
from django.conf import settings
from django.db import migrations

from departments.constants import CONSTANT_DEPARTMENTS, LEGACY_DEPARTMENT_NAME_MAP

USER_DEPARTMENT_NORMALISER = {
    "It": "Information Technology",
    "IT Department": "Information Technology",
    "Logistics": "Transport & Logistics",
}


def forward(apps, schema_editor):
    Department = apps.get_model("departments", "Department")
    Employee = apps.get_model("employees", "Employee")
    User = apps.get_model(settings.AUTH_USER_MODEL)

    canonical_rows = {}
    existing = list(Department.objects.all())
    by_name = {d.name: d for d in existing}
    by_code = {d.code: d for d in existing}

    # 1) Upsert canonical departments (by name or code, rename in place if needed).
    for name, code in CONSTANT_DEPARTMENTS:
        row = by_name.get(name) or by_code.get(code) or by_code.get(code.lower())
        if row is None:
            row = Department(name=name, code=code, is_active=True)
            row.save()
        else:
            old_name, old_code = row.name, row.code
            if old_name != name:
                row.name = name
            if old_code != code:
                row.code = code
            if old_name != name or old_code != code:
                row.save()
            # Drop stale map keys so later lookups don't reuse legacy rows.
            if old_name != name and old_name in by_name:
                by_name.pop(old_name, None)
            if old_code != code and old_code in by_code:
                by_code.pop(old_code, None)
        by_name[name] = row
        by_code[code] = row
        canonical_rows[name] = row

    # 2) Reassign employees from legacy departments to their canonical counterpart.
    for emp in Employee.objects.select_related("department"):
        if not emp.department_id:
            continue
        canonical_name = LEGACY_DEPARTMENT_NAME_MAP.get(emp.department.name)
        if canonical_name is not None:
            emp.department = canonical_rows[canonical_name]
            emp.save(update_fields=["department", "updated_at"])

    # 3) Normalise users.department free-text values.
    for old, new in USER_DEPARTMENT_NORMALISER.items():
        User.objects.filter(department=old).update(department=new)

    # 4) Remove any rows outside the canonical list.
    canonical_names = {name for name, _ in CONSTANT_DEPARTMENTS}
    stale = Department.objects.exclude(name__in=canonical_names)
    if stale.exists():
        stale.delete()


def reverse(apps, schema_editor):
    # No-op: constant list is authoritative and not automatically reversible.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("departments", "0001_initial"),
        ("employees", "0003_employee_job_type_employee_names"),
    ]

    operations = [
        migrations.RunPython(forward, reverse),
    ]
