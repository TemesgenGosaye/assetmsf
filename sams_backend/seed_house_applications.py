"""
Seed script – populates house_applications table using valid employee IDs.
Run:  python seed_house_applications.py

All employee_id values MUST match an existing Employee record,
otherwise the application creation will be blocked by the serializer constraint.
"""
import os
import django
from datetime import date, timedelta

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from employees.models import Employee
from houses.models import HouseApplication

User = get_user_model()


def seed_house_applications():
    print("=" * 60)
    print("Seeding House Applications...")
    print("=" * 60)

    users = list(User.objects.filter(is_active=True)[:5])
    if not users:
        print("  ERROR: No active users found. Run seed_data.py first.")
        return

    employees = list(Employee.objects.filter(status="Active"))
    if not employees:
        print("  ERROR: No active employees found. Run seed_employees.py first.")
        return

    statuses = [
        "Draft", "Submitted", "Under Review", "Verified",
        "Waiting for Allocation", "Allocated",
    ]

    categories = ["Staff", "A", "B", "C", "D"]
    locations = [
        "Block A - Near Gate", "Block B - Central", "Block C - East Wing",
        "Staff Compound", "Family Quarters", "Barracks Area",
    ]
    reasons = [
        "Newly transferred to this location, need accommodation.",
        "Currently renting outside, seeking on-site housing.",
        "Family relocated, requires larger unit.",
        "Medical reasons require ground-floor unit.",
        "Security duty proximity required.",
        "Marriage – need separate family unit.",
    ]

    app_data = [
        # (emp_idx, status_idx, category, location_idx, reason_idx, has_doc, days_ago)
        (0,  1, "B", 0, 0, True,  30),
        (1,  2, "A", 1, 1, True,  25),
        (2,  3, "C", 2, 2, True,  20),
        (3,  4, "B", 3, 3, False, 18),
        (4,  5, "D", 4, 4, True,  15),
        (5,  0, "Staff", 5, 5, False, 2),
        (6,  1, "C", 0, 0, True,  28),
        (7,  2, "A", 1, 1, True,  22),
        (8,  0, "D", 2, 2, False, 1),
        (9,  3, "Staff", 3, 3, True, 19),
        (10, 4, "B", 4, 4, True,  16),
        (11, 1, "A", 5, 5, True,  27),
        (12, 0, "C", 0, 0, False, 3),
        (13, 2, "B", 1, 1, True,  24),
        (14, 5, "D", 2, 2, True,  10),
        (15, 0, "Staff", 3, 3, False, 1),
        (16, 1, "A", 4, 4, True,  26),
        (17, 3, "C", 5, 5, True,  17),
        (18, 0, "B", 0, 0, False, 5),
        (19, 2, "D", 1, 1, True,  21),
    ]

    created_count = 0
    for (
        emp_idx, status_idx, category,
        location_idx, reason_idx, has_doc, days_ago,
    ) in app_data:
        if emp_idx >= len(employees):
            continue
        emp = employees[emp_idx]
        user = users[emp_idx % len(users)]
        app_status = statuses[status_idx]

        submitted_at = None
        if app_status != "Draft":
            submitted_at = timezone.now() - timedelta(days=days_ago)

        application_no = f"HAPP-{9000 + created_count + 1:04d}"

        # Check if an application already exists for this employee/national_id
        existing = HouseApplication.objects.filter(national_id=emp.national_id).first()
        if existing:
            print(f"  [Exists ] {existing.application_no} - {emp.employee_id} ({emp.full_name}) -> {existing.requested_house_category} [{existing.status}]")
            continue

        app = HouseApplication(
            requester=user,
            emp_record=emp,
            employee_id=emp.employee_id,
            employee_name=emp.full_name,
            national_id=emp.national_id,
            gender="Male" if emp_idx % 2 == 0 else "Female",
            job_position=emp.job_position,
            job_grade=emp.job_grade,
            years_of_service=emp.service_years,
            marital_status=emp.marital_status,
            has_disability=emp.has_disability,
            family_size=max(emp.family_size, 1),
            number_of_children=max(emp.family_size - 2, 0),
            requested_house_category=category,
            reason_for_request=reasons[reason_idx % len(reasons)],
            preferred_location=locations[location_idx % len(locations)],
            status=app_status,
            submitted_at=submitted_at,
        )
        app.save()  # triggers auto application_no generation

        print(f"  [Created] {app.application_no} - {emp.employee_id} ({emp.full_name}) -> {category} [{app_status}]")
        created_count += 1

    print("=" * 60)
    print(f"House Applications seeded: {created_count}")
    print("=" * 60)


if __name__ == "__main__":
    seed_house_applications()
