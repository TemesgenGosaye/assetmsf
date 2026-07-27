"""
Seed script – populates the employees table with 20 sample employees.
Run:  python seed_employees.py
"""
import os
import django
from datetime import date

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from employees.models import Employee
from departments.models import Department


def seed_employees():
    print("=" * 60)
    print("Seeding Employees...")
    print("=" * 60)

    departments = list(Department.objects.all())
    if not departments:
        print("  WARNING: No departments found. Creating a default one.")
        dept, _ = Department.objects.get_or_create(
            code="GEN", defaults={"name": "General"}
        )
        departments = [dept]

    employee_data = [
        # (full_name, national_id, job_position, job_grade, dept_idx, hire_date, family_size, marital, disability, status)
        ("Abebe Kebede",       "NID-1001", "Senior Engineer",       "Grade-5", 0, date(2018, 3, 15), 5, "Married",  False, "Active"),
        ("Fatima Hassan",      "NID-1002", "Project Manager",       "Grade-6", 1, date(2017, 7, 1),  4, "Married",  False, "Active"),
        ("John Mwangi",        "NID-1003", "Logistics Officer",     "Grade-4", 2, date(2020, 1, 10), 3, "Single",   False, "Active"),
        ("Sara Tesfaye",       "NID-1004", "Accountant",            "Grade-4", 3, date(2019, 9, 20), 2, "Single",   False, "Active"),
        ("Daniel Assefa",      "NID-1005", "IT Specialist",         "Grade-5", 1, date(2016, 11, 5), 6, "Married",  True,  "Active"),
        ("Hana Ibrahim",       "NID-1006", "HR Officer",            "Grade-3", 0, date(2021, 4, 18), 1, "Single",   False, "Active"),
        ("Mekonnen Tadesse",   "NID-1007", "Warehouse Supervisor",  "Grade-3", 2, date(2019, 2, 28), 4, "Married",  False, "Active"),
        ("Ruth Njeri",         "NID-1008", "Production Lead",       "Grade-5", 3, date(2015, 6, 12), 5, "Married",  True,  "Active"),
        ("Omar Ali",           "NID-1009", "Driver",                "Grade-2", 2, date(2022, 8, 1),  3, "Married",  False, "Active"),
        ("Grace Wanjiku",      "NID-1010", "Receptionist",          "Grade-1", 0, date(2023, 1, 9),  1, "Single",   False, "Active"),
        ("Yusuf Mohammed",     "NID-1011", "Maintenance Technician","Grade-2", 3, date(2020, 5, 22), 4, "Married",  False, "Active"),
        ("Almaz Birhanu",      "NID-1012", "Procurement Officer",   "Grade-4", 1, date(2018, 10, 3), 2, "Divorced", False, "Active"),
        ("Tadesse Girma",      "NID-1013", "Security Guard",        "Grade-1", 0, date(2021, 12, 15),3, "Married",  False, "Active"),
        ("Nadia Osman",        "NID-1014", "Nurse",                 "Grade-3", 4, date(2019, 3, 7),  2, "Single",   False, "Active"),
        ("Samuel Kipchoge",    "NID-1015", "Field Coordinator",     "Grade-4", 2, date(2017, 8, 25), 5, "Married",  False, "Active"),
        ("Birtukan Mulugeta",  "NID-1016", "Data Entry Clerk",      "Grade-1", 1, date(2023, 6, 1),  1, "Single",   False, "Active"),
        ("Isaac Okonkwo",      "NID-1017", "Electrical Engineer",   "Grade-5", 3, date(2016, 2, 14), 4, "Married",  True,  "Active"),
        ("Kidist Abebe",       "NID-1018", "Administration Assist", "Grade-2", 0, date(2022, 3, 30), 2, "Married",  False, "Active"),
        ("Joseph Kamau",       "NID-1019", "Quality Controller",    "Grade-3", 3, date(2020, 11, 11),3, "Single",   False, "Active"),
        ("Zainab Hassan",      "NID-1020", "Community Liaison",     "Grade-4", 4, date(2018, 7, 19), 4, "Married",  False, "Active"),
    ]

    created_count = 0
    for (
        full_name, national_id, job_position, job_grade,
        dept_idx, hire_date, family_size, marital,
        disability, emp_status,
    ) in employee_data:
        dept = departments[dept_idx % len(departments)]
        emp, created = Employee.objects.get_or_create(
            national_id=national_id,
            defaults={
                "full_name": full_name,
                "job_position": job_position,
                "job_grade": job_grade,
                "department": dept,
                "hire_date": hire_date,
                "family_size": family_size,
                "marital_status": marital,
                "has_disability": disability,
                "status": emp_status,
            },
        )
        label = "Created" if created else "Exists "
        print(f"  [{label}] {emp.employee_id} – {emp.full_name} ({job_position})")
        if created:
            created_count += 1

    print("=" * 60)
    print(f"Employees seeded: {created_count} new, {len(employee_data) - created_count} already existed.")
    print("=" * 60)


if __name__ == "__main__":
    seed_employees()
