"""
Django management command to seed the employees table with realistic sample data.

Usage:
    python manage.py seed_employees            # insert 50 employees (default)
    python manage.py seed_employees --count 100
    python manage.py seed_employees --clear    # wipe existing employees first
"""

import datetime
import random

from django.core.management.base import BaseCommand
from django.db import transaction

from departments.models import Department
from employees.models import Employee


# ---------------------------------------------------------------------------
# Sample data pools
# ---------------------------------------------------------------------------

FIRST_NAMES = [
    "Ahmed", "Mohamed", "Ali", "Omar", "Hassan", "Ibrahim", "Yusuf", "Khalid",
    "Abdi", "Farah", "Muse", "Jama", "Daud", "Salah", "Nuur", "Faisal",
    "Sara", "Fatima", "Amina", "Hodan", "Faadumo", "Asad", "Liban", "Mahad",
    "Sahra", "Ifrah", "Caasha", "Deeqa", "Nasteho", "Roda", "Hibo", "Fardowsa",
    "Abdullahi", "Cabdi", "Guled", "Bashir", "Yahye", "Hanad", "Shukri", "Warsan",
]

LAST_NAMES = [
    "Hassan", "Ahmed", "Mohamed", "Ali", "Omar", "Abdi", "Farah", "Muse",
    "Jama", "Ibrahim", "Nuur", "Salah", "Yusuf", "Khalid", "Daud", "Osman",
    "Sheikh", "Warsame", "Hirsi", "Aden", "Elmi", "Hashi", "Garad", "Abukar",
    "Bare", "Diriye", "Gedi", "Halane", "Ismail", "Jimale",
]

JOB_POSITIONS = [
    ("Engineer",          "G5"),
    ("Senior Engineer",   "G6"),
    ("Project Manager",   "G7"),
    ("Technician",        "G3"),
    ("Senior Technician", "G4"),
    ("Analyst",           "G5"),
    ("Senior Analyst",    "G6"),
    ("Supervisor",        "G5"),
    ("Team Lead",         "G6"),
    ("Driver",            "G2"),
    ("Security Officer",  "G2"),
    ("Clerk",             "G3"),
    ("Accountant",        "G5"),
    ("HR Officer",        "G5"),
    ("IT Officer",        "G5"),
    ("Nurse",             "G5"),
    ("Doctor",            "G7"),
    ("Logistician",       "G5"),
    ("Warehouse Officer", "G4"),
    ("Field Officer",     "G5"),
    ("Finance Officer",   "G5"),
    ("Admin Assistant",   "G3"),
    ("Procurement Officer","G5"),
    ("Supply Chain Officer","G5"),
    ("Community Liaison", "G4"),
]

MARITAL_STATUSES = [
    ("Single",   0.30),
    ("Married",  0.55),
    ("Divorced", 0.10),
    ("Widowed",  0.05),
]

STATUSES = [
    ("Active",     0.80),
    ("On Leave",   0.12),
    ("Terminated", 0.08),
]


def weighted_choice(choices):
    """Pick a value from [(value, weight), ...] list."""
    values, weights = zip(*choices)
    total = sum(weights)
    r = random.uniform(0, total)
    upto = 0.0
    for v, w in zip(values, weights):
        upto += w
        if r <= upto:
            return v
    return values[-1]


def random_hire_date():
    """Random hire date between 2005 and 2024."""
    start = datetime.date(2005, 1, 1)
    end   = datetime.date(2024, 12, 31)
    delta = (end - start).days
    return start + datetime.timedelta(days=random.randint(0, delta))


def random_national_id(used: set) -> str:
    """Generate a unique 10-digit national ID string."""
    while True:
        nid = f"{random.randint(1000000000, 9999999999)}"
        if nid not in used:
            used.add(nid)
            return nid


# ---------------------------------------------------------------------------
# Command
# ---------------------------------------------------------------------------

class Command(BaseCommand):
    help = "Seed the employees table with realistic sample data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--count",
            type=int,
            default=50,
            help="Number of employees to create (default: 50)",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete all existing employees before seeding",
        )

    def handle(self, *args, **options):
        count  = options["count"]
        clear  = options["clear"]

        # Fetch active departments (may be empty – employees will have no dept)
        departments = list(Department.objects.filter(is_active=True))
        if not departments:
            self.stdout.write(
                self.style.WARNING("No active departments found – employees will have no department assigned.")
            )

        if clear:
            deleted, _ = Employee.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"Cleared {deleted} existing employee(s)."))

        used_national_ids: set = set(
            Employee.objects.values_list("national_id", flat=True)
        )

        created = 0
        skipped = 0

        with transaction.atomic():
            for i in range(count):
                first = random.choice(FIRST_NAMES)
                last  = random.choice(LAST_NAMES)
                full_name = f"{first} {last}"

                position, grade = random.choice(JOB_POSITIONS)
                marital = weighted_choice(MARITAL_STATUSES)
                status  = weighted_choice(STATUSES)

                family_size = 0
                if marital == "Married":
                    family_size = random.randint(2, 8)
                elif marital in ("Divorced", "Widowed"):
                    family_size = random.randint(0, 4)

                has_disability = random.random() < 0.08   # ~8 %
                hire_date      = random_hire_date()
                department     = random.choice(departments) if departments else None
                national_id    = random_national_id(used_national_ids)

                try:
                    Employee.objects.create(
                        full_name      = full_name,
                        national_id    = national_id,
                        job_position   = position,
                        job_grade      = grade,
                        department     = department,
                        hire_date      = hire_date,
                        family_size    = family_size,
                        marital_status = marital,
                        has_disability = has_disability,
                        status         = status,
                    )
                    created += 1
                except Exception as exc:
                    skipped += 1
                    self.stdout.write(self.style.ERROR(f"  Row {i+1} skipped: {exc}"))

        self.stdout.write(
            self.style.SUCCESS(
                f"\n✓ Done — {created} employee(s) created, {skipped} skipped."
            )
        )
        if departments:
            self.stdout.write(f"  Distributed across {len(departments)} department(s).")
        self.stdout.write(
            "  Run  python manage.py seed_employees --clear --count 100  to re-seed.\n"
        )
