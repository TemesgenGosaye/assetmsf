"""
Django management command to seed the house_applications table.

Usage:
    python manage.py seed_house_applications              # insert 60 apps (default)
    python manage.py seed_house_applications --count 100
    python manage.py seed_house_applications --clear      # wipe existing first
"""

import datetime
import random
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from houses.models import House, HouseApplication, get_eligible_category

User = get_user_model()

# ---------------------------------------------------------------------------
# Data pools
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
]

JOB_DATA = [
    ("Engineer",           "5"),
    ("Senior Engineer",    "8"),
    ("Project Manager",    "11"),
    ("Technician",         "3"),
    ("Senior Technician",  "4"),
    ("Analyst",            "6"),
    ("Senior Analyst",     "9"),
    ("Supervisor",         "7"),
    ("Team Lead",          "10"),
    ("Driver",             "2"),
    ("Security Officer",   "2"),
    ("Clerk",              "3"),
    ("Accountant",         "6"),
    ("HR Officer",         "6"),
    ("IT Officer",         "7"),
    ("Nurse",              "8"),
    ("Doctor",             "13"),
    ("Logistician",        "7"),
    ("Warehouse Officer",  "4"),
    ("Field Officer",      "5"),
    ("Finance Officer",    "9"),
    ("Admin Assistant",    "3"),
    ("Procurement Officer","7"),
    ("Director",           "15"),
    ("Deputy Director",    "14"),
]

MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"]
MARITAL_WEIGHTS  = [0.25, 0.55, 0.12, 0.08]

GENDERS = ["Male", "Female"]

POSITION_TYPES = ["Permanent", "Seasonal", "Half Permanent", "PPL"]
POSITION_WEIGHTS = [0.55, 0.20, 0.15, 0.10]

STATUSES_WEIGHTS = [
    ("Submitted",             0.25),
    ("Under Review",          0.20),
    ("Verified",              0.15),
    ("Waiting for Allocation",0.15),
    ("Allocated",             0.10),
    ("Rejected",              0.08),
    ("Returned",              0.05),
    ("Draft",                 0.02),
]

REASONS = [
    "Currently living in rented accommodation at high cost.",
    "My current house is overcrowded for my family.",
    "Recently married and need a family unit.",
    "Relocated from another region and require housing.",
    "Existing house requires major repairs and is uninhabitable.",
    "First-time applicant. No company housing assigned.",
    "Family size has increased significantly.",
    "Current accommodation lacks basic utilities.",
    "Medical condition requires closer proximity to facilities.",
    "Supporting elderly parents who relocated to the area.",
    "",
    "",
]

LOCATIONS = [
    "Compound A", "Compound B", "Staff Village",
    "Main Camp", "Riverside Quarters", "Central Block", "",
]

REJECTION_REASONS = [
    "Applicant does not meet minimum eligibility criteria.",
    "Incomplete documentation submitted.",
    "Priority score below threshold for current allocation cycle.",
    "",
]

RETURNED_REASONS = [
    "Supporting document missing. Please resubmit with valid ID copy.",
    "Employee ID could not be verified. Please correct and resubmit.",
    "Family size declared does not match HR records.",
    "",
]


def weighted_choice(options, weights):
    return random.choices(options, weights=weights, k=1)[0]


def random_national_id(used: set) -> str:
    while True:
        nid = f"SOM{random.randint(100000000, 999999999)}"
        if nid not in used:
            used.add(nid)
            return nid


def random_emp_id(used: set) -> str:
    while True:
        eid = f"{random.randint(1, 9999):04d}"
        if eid not in used:
            used.add(eid)
            return eid


def compute_priority_score(app_data: dict, position: int) -> Decimal:
    """Approximate the scoring engine logic for seeded data."""
    grade_str = app_data.get("job_grade", "1")
    try:
        grade = int(grade_str)
    except ValueError:
        grade = 1

    # Job grade score (max 30)
    grade_score = min(grade / 15 * 30, 30)

    # Service years score (max 25)
    yos = app_data.get("years_of_service", 0)
    service_score = min(yos / 20 * 25, 25)

    # Family size score (max 20)
    fam = app_data.get("family_size", 1)
    family_score = min((fam - 1) / 7 * 20, 20)

    # Disability score (max 15)
    disability_score = 15 if app_data.get("has_disability") else 0

    # FIFO score (max 10) — earlier position = higher score
    fifo_score = max(0, 10 - (position - 1))

    total = grade_score + service_score + family_score + disability_score + fifo_score
    return Decimal(str(round(total, 2)))


# ---------------------------------------------------------------------------
# Command
# ---------------------------------------------------------------------------

class Command(BaseCommand):
    help = "Seed the house_applications table with realistic sample data."

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=60,
                            help="Number of applications to create (default: 60)")
        parser.add_argument("--clear", action="store_true",
                            help="Delete all existing applications before seeding")

    def handle(self, *args, **options):
        count = options["count"]
        clear = options["clear"]

        # ── Require at least one user to act as requester ──────────────
        users = list(User.objects.filter(is_active=True))
        if not users:
            self.stdout.write(self.style.ERROR(
                "No active users found. Create at least one user before seeding applications."
            ))
            return

        # ── Active houses for allocation ────────────────────────────────
        active_houses = list(House.objects.filter(status="Active"))

        if clear:
            deleted, _ = HouseApplication.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"Cleared {deleted} existing application(s)."))

        used_national_ids: set = set(
            HouseApplication.objects.values_list("national_id", flat=True)
        )
        used_emp_ids: set = set(
            HouseApplication.objects.values_list("employee_id", flat=True)
        )

        created = 0
        skipped = 0
        allocated_houses = set()
        now = timezone.now()

        statuses  = [s for s, _ in STATUSES_WEIGHTS]
        s_weights = [w for _, w in STATUSES_WEIGHTS]

        with transaction.atomic():
            for position in range(1, count + 1):
                first = random.choice(FIRST_NAMES)
                last  = random.choice(LAST_NAMES)
                full_name = f"{first} {last}"

                job_position, job_grade = random.choice(JOB_DATA)
                marital  = weighted_choice(MARITAL_STATUSES, MARITAL_WEIGHTS)
                gender   = random.choice(GENDERS)
                pos_type = weighted_choice(POSITION_TYPES, POSITION_WEIGHTS)
                status   = weighted_choice(statuses, s_weights)

                family_size = 1
                num_children = 0
                if marital == "Married":
                    family_size  = random.randint(2, 8)
                    num_children = random.randint(0, min(family_size - 1, 6))
                elif marital in ("Divorced", "Widowed"):
                    family_size  = random.randint(1, 4)
                    num_children = random.randint(0, family_size)

                has_disability  = random.random() < 0.08
                years_of_service = random.randint(0, 22)
                eligible_cat    = get_eligible_category(job_grade)
                requested_cat   = random.choice(["Staff", "A", "B", "C", "D", "E"])
                preferred_loc   = random.choice(LOCATIONS)
                reason          = random.choice(REASONS)
                national_id     = random_national_id(used_national_ids)
                employee_id     = random_emp_id(used_emp_ids)
                requester       = random.choice(users)

                # Timestamps
                days_ago  = random.randint(1, 365)
                submitted_at = now - datetime.timedelta(days=days_ago)

                reviewed_at  = None
                allocated_house = None
                allocated_at    = None
                allocated_by    = None
                rejection_reason = ""
                returned_reason  = ""

                if status not in ("Draft", "Submitted"):
                    reviewed_at = submitted_at + datetime.timedelta(days=random.randint(1, 14))

                if status == "Allocated" and active_houses:
                    allocated_house = random.choice(active_houses)
                    allocated_at    = reviewed_at + datetime.timedelta(days=random.randint(1, 7))
                    allocated_by    = random.choice(users)

                if status == "Rejected":
                    rejection_reason = random.choice(
                        [r for r in REJECTION_REASONS if r] or ["Application rejected."]
                    )

                if status == "Returned":
                    returned_reason = random.choice(
                        [r for r in RETURNED_REASONS if r] or ["Please correct and resubmit."]
                    )

                app_data = dict(
                    job_grade=job_grade,
                    years_of_service=years_of_service,
                    family_size=family_size,
                    has_disability=has_disability,
                )
                priority_score = compute_priority_score(app_data, position)

                try:
                    HouseApplication.objects.create(
                        requester             = requester,
                        employee_id           = employee_id,
                        employee_name         = full_name,
                        national_id           = national_id,
                        gender                = gender,
                        job_position          = job_position,
                        job_grade             = job_grade,
                        position_type         = pos_type,
                        years_of_service      = years_of_service,
                        marital_status        = marital,
                        has_disability        = has_disability,
                        family_size           = family_size,
                        number_of_children    = num_children,
                        requested_house_category = requested_cat,
                        eligible_house_category  = eligible_cat,
                        priority_score        = priority_score,
                        reason_for_request    = reason,
                        preferred_location    = preferred_loc,
                        status                = status,
                        submitted_at          = submitted_at if status != "Draft" else None,
                        reviewed_at           = reviewed_at,
                        reviewed_by           = requester if reviewed_at else None,
                        allocated_house       = allocated_house,
                        allocated_at          = allocated_at,
                        allocated_by          = allocated_by,
                        rejection_reason      = rejection_reason,
                        returned_reason       = returned_reason,
                    )
                    if allocated_house:
                        allocated_houses.add(allocated_house.id)
                    created += 1
                except Exception as exc:
                    skipped += 1
                    self.stdout.write(self.style.ERROR(f"  Row {position} skipped: {exc}"))

        # ── Mark allocated houses as Inactive ────────────────────────────
        if allocated_houses:
            House.objects.filter(id__in=allocated_houses).update(status="Inactive")

        # ── Summary ──────────────────────────────────────────────────────
        self.stdout.write(self.style.SUCCESS(
            f"\n✓ Done — {created} application(s) created, {skipped} skipped."
        ))
        self.stdout.write("\n  Status breakdown:")
        for s in statuses:
            n = HouseApplication.objects.filter(status=s).count()
            self.stdout.write(f"    {s:<30} {n:>4}")
        self.stdout.write(
            "\n  Run  python manage.py seed_house_applications --clear --count 100  to re-seed.\n"
        )
