"""
Django management command to seed the houses table.

Mirrors EXACTLY the fields available in the "Register New House" form:
  - location       (text input)
  - house_type     (Staff / A / B / C / D / E)
  - status         (Active / Inactive)
  - capacity       (number input, min 1)
  - inside_items   (multi-select: Bed, Chair, Table, Locker — same list as the UI)
  - damaged_door / damaged_windows / damaged_walls /
    damaged_switch / damaged_bulb / damaged_water
    (only relevant when status == Inactive, same as the UI hides them for Active)
  - description    (optional notes textarea)

Usage:
    python manage.py seed_houses               # 100 houses (default)
    python manage.py seed_houses --count 50
    python manage.py seed_houses --clear       # delete all first, then seed
"""

import random

from django.core.management.base import BaseCommand
from django.db import transaction

from houses.models import House


# ---------------------------------------------------------------------------
# Exact values from the UI form
# ---------------------------------------------------------------------------

# The ONLY inside items available in the UI dropdown
INSIDE_ITEMS = ["Bed", "Chair", "Table", "Locker"]

# House types (matches House.HouseType choices)
HOUSE_TYPES = ["Staff", "A", "B", "C", "D", "E"]

# Damage keys (match model field names; only set when Inactive)
DAMAGE_FIELDS = [
    "damaged_door",
    "damaged_windows",
    "damaged_walls",
    "damaged_switch",
    "damaged_bulb",
    "damaged_water",
]

# Realistic location strings matching the form placeholder style
LOCATIONS = [
    "Compound A – Block 1, Unit 101",
    "Compound A – Block 1, Unit 102",
    "Compound A – Block 2, Unit 201",
    "Compound A – Block 2, Unit 202",
    "Compound A – Block 3, Unit 301",
    "Compound B – North Wing, Unit 101",
    "Compound B – North Wing, Unit 102",
    "Compound B – South Wing, Unit 201",
    "Compound B – South Wing, Unit 202",
    "Compound C – East Side, Unit 101",
    "Compound C – East Side, Unit 102",
    "Compound C – West Side, Unit 201",
    "Staff Village – Zone 1, Unit 101",
    "Staff Village – Zone 1, Unit 102",
    "Staff Village – Zone 2, Unit 201",
    "Staff Village – Zone 2, Unit 202",
    "Staff Village – Zone 3, Unit 301",
    "Main Camp – Sector 1, Unit 101",
    "Main Camp – Sector 1, Unit 102",
    "Main Camp – Sector 2, Unit 201",
    "Main Camp – Sector 2, Unit 202",
    "Main Camp – Sector 3, Unit 301",
    "Riverside Quarters – Block A, Unit 101",
    "Riverside Quarters – Block B, Unit 201",
    "Hilltop Residence – Unit 101",
    "Hilltop Residence – Unit 102",
    "Central Housing Block – Floor 1, Unit 101",
    "Central Housing Block – Floor 2, Unit 201",
    "Operations Base – Housing Block, Unit 101",
    "Senior Staff Quarters – Unit 101",
]

# Optional description notes — matches the "Optional notes…" textarea
DESCRIPTIONS = [
    "Well-maintained unit with good natural lighting.",
    "Recently renovated. New fixtures installed.",
    "Ground floor unit. Easy access for residents.",
    "Upper floor unit with compound view.",
    "Corner unit with additional windows.",
    "Spacious layout. Suitable for families.",
    "Compact unit. Suitable for single staff.",
    "Near the main gate. Easy access.",
    "Quiet location at the back of the compound.",
    "Self-contained unit with private bathroom.",
    "Unit requires minor maintenance before occupation.",
    "",   # Some houses have no notes
    "",
    "",
]

# Type → capacity range (matches real housing unit sizes)
TYPE_CAPACITY: dict[str, tuple[int, int]] = {
    "Staff": (3, 6),
    "A":     (3, 5),
    "B":     (2, 4),
    "C":     (2, 3),
    "D":     (1, 2),
    "E":     (8, 20),   # Barracks
}

# Type distribution weights (must sum to 1.0)
TYPE_WEIGHTS = {
    "Staff": 0.20,
    "A":     0.15,
    "B":     0.20,
    "C":     0.20,
    "D":     0.15,
    "E":     0.10,
}


def pick_inside_items() -> list[str]:
    """
    Return a random subset of the exact items in the UI dropdown.
    Randomly pick 0–4 items from ["Bed", "Chair", "Table", "Locker"].
    """
    k = random.randint(0, len(INSIDE_ITEMS))
    return random.sample(INSIDE_ITEMS, k)


def pick_damage(status: str) -> dict[str, bool]:
    """
    Damage flags mirror the UI: only shown/meaningful when status == Inactive.
    Active houses get all False (no damage checked).
    Inactive houses get a realistic random mix.
    """
    if status == "Active":
        return {f: False for f in DAMAGE_FIELDS}
    # Inactive: each damage item has a 35 % chance of being checked
    return {f: random.random() < 0.35 for f in DAMAGE_FIELDS}


def weighted_type() -> str:
    types   = list(TYPE_WEIGHTS.keys())
    weights = list(TYPE_WEIGHTS.values())
    return random.choices(types, weights=weights, k=1)[0]


# ---------------------------------------------------------------------------
# Command
# ---------------------------------------------------------------------------

class Command(BaseCommand):
    help = "Seed the houses table using the same fields as the Register House form."

    def add_arguments(self, parser):
        parser.add_argument(
            "--count", type=int, default=100,
            help="Number of houses to create (default: 100)",
        )
        parser.add_argument(
            "--clear", action="store_true",
            help="Delete all existing houses (and dependent records) before seeding.",
        )

    def handle(self, *args, **options):
        count = options["count"]
        clear = options["clear"]

        if clear:
            deleted, _ = House.objects.all().delete()
            self.stdout.write(self.style.WARNING(
                f"Cleared {deleted} existing house(s) (cascade deleted allocations)."
            ))

        # Build a balanced type list so every type appears proportionally
        type_list: list[str] = []
        for htype, weight in TYPE_WEIGHTS.items():
            type_list.extend([htype] * max(1, round(weight * count)))

        # Pad / trim to exact count
        while len(type_list) < count:
            type_list.append(weighted_type())
        type_list = type_list[:count]
        random.shuffle(type_list)

        created = 0
        skipped = 0

        # Pre-compute starting sequences per type to avoid hitting the model's
        # auto-generate cap (which reads MAX from existing rows).
        # We read the current max for each type and start from there.
        from django.db.models.functions import Length
        type_counters: dict[str, int] = {}
        for htype in HOUSE_TYPES:
            prefix = htype
            last = (
                House.objects
                .filter(house_number__startswith=prefix)
                .order_by("-house_number")
                .values_list("house_number", flat=True)
                .first()
            )
            if last:
                try:
                    type_counters[htype] = int(last[len(prefix):]) + 1
                except ValueError:
                    type_counters[htype] = 1
            else:
                type_counters[htype] = 1

        # Same for house_id (format 90-NNN-00)
        last_hid = (
            House.objects
            .filter(house_id__regex=r"^90-\d{3}-00$")
            .order_by("-house_id")
            .values_list("house_id", flat=True)
            .first()
        )
        if last_hid:
            try:
                hid_counter = int(last_hid.split("-")[1]) + 1
            except (IndexError, ValueError):
                hid_counter = 0
        else:
            hid_counter = 0

        for house_type in type_list:
            cap_min, cap_max = TYPE_CAPACITY[house_type]
            status       = random.choices(["Active", "Inactive"], weights=[0.80, 0.20])[0]
            location     = random.choice(LOCATIONS)
            capacity     = random.randint(cap_min, cap_max)
            description  = random.choice(DESCRIPTIONS)
            inside_items = pick_inside_items()
            damage       = pick_damage(status)

            house_number = f"{house_type}{type_counters[house_type]}"
            house_id     = f"90-{hid_counter:03d}-00"

            try:
                with transaction.atomic():
                    House.objects.create(
                        house_id     = house_id,
                        house_number = house_number,
                        location     = location,
                        house_type   = house_type,
                        status       = status,
                        capacity     = capacity,
                        description  = description,
                        inside_items = inside_items,
                        **damage,
                    )
                type_counters[house_type] += 1
                hid_counter += 1
                created += 1
            except Exception as exc:
                skipped += 1
                self.stdout.write(self.style.ERROR(f"  Skipped ({house_number}): {exc}"))

        # ── Summary ───────────────────────────────────────────────────────
        self.stdout.write(self.style.SUCCESS(
            f"\n✓ Done — {created} house(s) created, {skipped} skipped."
        ))
        self.stdout.write("\n  Type breakdown:")
        for htype in HOUSE_TYPES:
            n     = House.objects.filter(house_type=htype).count()
            label = {
                "Staff": "Staff",
                "A": "Type A", "B": "Type B", "C": "Type C",
                "D": "Type D", "E": "Type E (Barrack)",
            }[htype]
            self.stdout.write(f"    {label:<22} {n:>4} units")

        active   = House.objects.filter(status="Active").count()
        inactive = House.objects.filter(status="Inactive").count()
        self.stdout.write(f"\n  Active: {active}  |  Inactive: {inactive}")

        # Inside items usage summary
        from django.db.models import Q
        for item in INSIDE_ITEMS:
            n = House.objects.filter(inside_items__contains=item).count()
            self.stdout.write(f"  Has '{item}': {n} houses")

        self.stdout.write(
            "\n  Re-seed: python manage.py seed_houses --clear --count 100\n"
        )
