"""
Seed script – populates 50 House Applications (seed data for house application results/management).
Run: python seed_50_house_applications.py
"""
import os
import django
import random
from datetime import date, timedelta

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from employees.models import Employee
from houses.models import HouseApplication, House

User = get_user_model()

def seed_50_house_applications():
    print("=" * 60)
    print("Seeding 50 House Applications...")
    print("=" * 60)

    users = list(User.objects.filter(is_active=True))
    if not users:
        print("  ERROR: No active users found. Run seed_data.py first.")
        return

    # Ensure we have enough active employees, or create more if needed
    employees = list(Employee.objects.filter(status="Active"))
    if len(employees) < 60:
        print(f"  Found {len(employees)} active employees. Generating additional employees...")
        from departments.models import Department
        departments = list(Department.objects.all())
        if not departments:
            dept, _ = Department.objects.get_or_create(code="23", defaults={"name": "MANAGER OFFICE"})
            departments = [dept]
        
        first_names = ["Abebe", "Kebede", "Tigist", "Almaz", "Dawit", "Meseret", "Solomon", "Hiwot", "Girma", "Aster", "Bereket", "Meskerm", "Yohannes", "Selam", "Samuel", "Hanna", "Natnael", "Edom", "Kalkidan", "Ephrem"]
        last_names = ["Tadesse", "Alemu", "Worku", "Lemma", "Hailu", "Mekonnen", "Girma", "Assefa", "Dibaba", "Bekele", "Kebede", "Alemu", "Demissie", "Getahun", "Shiferaw", "Teshome", "Belachew", "Girma", "Woldemichael", "Fikre"]
        positions = ["Senior Engineer", "Project Manager", "Logistics Officer", "Accountant", "IT Specialist", "HR Officer", "Warehouse Supervisor", "Production Lead", "Driver", "Receptionist"]
        grades = ["Grade-1", "Grade-2", "Grade-3", "Grade-4", "Grade-5", "Grade-6"]

        for i in range(len(employees) + 1, 100):
            fn = random.choice(first_names)
            ln = random.choice(last_names)
            full_name = f"{fn} {ln} {i}"
            nid = f"NID-SEED-{i:03d}"
            if not Employee.objects.filter(national_id=nid).exists():
                existing_emp_ids = set(Employee.objects.values_list("employee_id", flat=True))
                idx = i
                while f"EMP-{idx:05d}" in existing_emp_ids:
                    idx += 1
                emp = Employee.objects.create(
                    employee_id=f"EMP-{idx:05d}",
                    full_name=full_name,
                    national_id=nid,
                    job_position=random.choice(positions),
                    job_grade=random.choice(grades),
                    department=random.choice(departments),
                    hire_date=date(random.randint(2015, 2023), random.randint(1, 12), random.randint(1, 28)),
                    family_size=random.randint(1, 6),
                    marital_status=random.choice(["Single", "Married", "Divorced"]),
                    has_disability=random.choice([True, False, False, False]),
                    status="Active"
                )
                employees.append(emp)

    employees = list(Employee.objects.filter(status="Active"))
    print(f"  Total available active employees for applications: {len(employees)}")

    statuses = [
        "Draft", "Submitted", "Under Review", "Verified",
        "Waiting for Allocation", "Allocated", "Rejected", "Returned"
    ]
    status_weights = [5, 10, 10, 10, 10, 40, 10, 5]

    categories = ["Staff", "A", "B", "C", "D"]
    locations = [
        "Block A - Near Gate", "Block B - Central", "Block C - East Wing",
        "Staff Compound", "Family Quarters", "Barracks Area", "Main Residential Zone"
    ]
    reasons = [
        "Newly transferred to this location, need accommodation.",
        "Currently renting outside, seeking on-site housing.",
        "Family relocated, requires larger unit.",
        "Medical reasons require ground-floor unit.",
        "Security duty proximity required.",
        "Marriage – need separate family unit.",
        "Proximity to workstation is critical for operational response."
    ]

    houses = list(House.objects.filter(is_active=True))

    created_count = 0
    skipped_count = 0

    random.seed(123)
    # Shuffle or sample employees
    selected_employees = random.sample(employees, min(50, len(employees)))

    for idx, emp in enumerate(selected_employees):
        existing = HouseApplication.objects.filter(national_id=emp.national_id).first()
        if existing:
            skipped_count += 1
            continue

        user = users[idx % len(users)]
        app_status = random.choices(statuses, weights=status_weights, k=1)[0]
        
        submitted_at = None
        if app_status != "Draft":
            submitted_at = timezone.now() - timedelta(days=random.randint(1, 60))

        allocated_house = None
        allocated_at = None
        if app_status == "Allocated" and houses:
            allocated_house = random.choice(houses)
            allocated_at = timezone.now() - timedelta(days=random.randint(0, 15))

        gender = "Male" if idx % 2 == 0 else "Female"
        category = random.choice(categories)
        location = random.choice(locations)
        reason = random.choice(reasons)

        app = HouseApplication(
            requester=user,
            emp_record=emp,
            employee_id=emp.employee_id,
            employee_name=emp.full_name,
            national_id=emp.national_id,
            gender=gender,
            job_position=emp.job_position,
            job_grade=emp.job_grade,
            years_of_service=emp.service_years,
            marital_status=emp.marital_status,
            has_disability=emp.has_disability,
            family_size=max(emp.family_size, 1),
            number_of_children=max(emp.family_size - 2, 0),
            requested_house_category=category,
            reason_for_request=reason,
            preferred_location=location,
            status=app_status,
            submitted_at=submitted_at,
            allocated_house=allocated_house,
            allocated_at=allocated_at,
            priority_score=round(random.uniform(50.0, 98.5), 2),
        )
        app.save()
        created_count += 1
        print(f"  [Created] {app.application_no} - {emp.employee_id} ({emp.full_name}) -> Cat {category} [{app_status}]")

    print("=" * 60)
    print(f"House Applications Seed Complete!")
    print(f"  - Newly Created: {created_count}")
    print(f"  - Skipped (Already existed): {skipped_count}")
    print("=" * 60)

if __name__ == "__main__":
    seed_50_house_applications()
