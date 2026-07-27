"""
Script to seed 30 additional assets into the SAMS database.
Run from the sams_backend directory:
    python seed_30_assets.py
"""
import os
import django
from decimal import Decimal
from datetime import date

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from django.contrib.auth import get_user_model
from properties.models import Property
from categories.models import Category, ItemType
from assets.models import Asset
from assets.serializers import AssetCreateSerializer


def seed_30_assets():
    print("=" * 60)
    print("Seeding 30 Additional Assets...")
    print("=" * 60)

    User = get_user_model()
    admin_user = User.objects.filter(role__in=['ADMIN', 'SUPER_ADMIN']).first()
    if not admin_user:
        admin_user = User.objects.first()

    if not admin_user:
        print("ERROR: No user found in database. Aborting.")
        return

    props = list(Property.objects.filter(is_active=True).order_by('name')[:3])
    if not props:
        print("ERROR: No active properties found. Aborting.")
        return

    prop1 = props[0]
    prop2 = props[1] if len(props) > 1 else props[0]
    prop3 = props[2] if len(props) > 2 else props[0]
    print(f"Using properties: {[str(p) for p in [prop1, prop2, prop3]]}")

    # Category & item type mapping
    category_map = {
        "irrigation item":        "Infrastructure",
        "bridge item":            "Infrastructure",
        "factory equipment":      "Machinery",
        "heavy machinery":        "Machinery",
        "light vehicle":          "Transport",
        "office furniture":       "Furniture",
        "household furniture":    "Furniture",
        "agricultural equipment": "Agriculture",
        "miscellaneous":          "Utility",
    }

    # Ensure categories exist
    categories = {}
    for it_name, cat_name in category_map.items():
        cat_code = cat_name.upper()[:3]
        cat, _ = Category.objects.get_or_create(
            name=cat_name,
            defaults={'code': cat_code}
        )
        categories[it_name] = cat

    # Ensure item types exist
    item_types = {}
    for it_name in category_map:
        it, _ = ItemType.objects.get_or_create(
            name=it_name,
            defaults={'category': categories[it_name], 'is_active': True}
        )
        item_types[it_name] = it

    # 30 new assets
    # (item_type_name, asset_name, serial, property_obj, department, cost, vendor, condition, status, purchase_date)
    assets_data = [
        # Irrigation items (3)
        ("irrigation item",        "Drip Tape Roll 16mm",           "DT-16MM-001",  prop2, "Production",             Decimal("320.00"),    "Global IT Solutions",         "good",      "active", date(2024, 1, 15)),
        ("irrigation item",        "Water Pump 5HP Diesel",         "WP-5HP-002",   prop3, "Production",             Decimal("2800.00"),   "Global IT Solutions",         "excellent", "active", date(2024, 3, 20)),
        ("irrigation item",        "Underground Pipe Set 4in",      "UP-4IN-003",   prop2, "Production",             Decimal("1500.00"),   "Global IT Solutions",         "good",      "active", date(2024, 2, 10)),

        # Bridge items (2)
        ("bridge item",            "Guard Rail Section 6m",         "GR-6M-001",    prop2, "Logistics",              Decimal("3400.00"),   "Ethiopian Motor Corporation", "good",      "active", date(2023, 11, 5)),
        ("bridge item",            "Expansion Joint Assembly",      "EJ-ASM-002",   prop2, "Logistics",              Decimal("7500.00"),   "Ethiopian Motor Corporation", "excellent", "active", date(2024, 4, 12)),

        # Factory equipment (4)
        ("factory equipment",      "Lathe Machine CW6163",          "LM-CW-001",    prop3, "Production",             Decimal("48000.00"),  "Global IT Solutions",         "excellent", "active", date(2024, 1, 8)),
        ("factory equipment",      "Welding Machine MIG 350A",      "WM-MIG-002",   prop3, "Production",             Decimal("2200.00"),   "Global IT Solutions",         "good",      "active", date(2023, 9, 25)),
        ("factory equipment",      "Air Compressor 50L 10Bar",      "AC-50L-003",   prop3, "Production",             Decimal("3100.00"),   "Global IT Solutions",         "good",      "active", date(2024, 5, 3)),
        ("factory equipment",      "Electric Generator 20KVA",      "EG-20K-004",   prop1, "Administration",         Decimal("15000.00"),  "Global IT Solutions",         "excellent", "active", date(2024, 6, 1)),

        # Heavy machinery (4)
        ("heavy machinery",        "Crane Mobile 20T",              "CR-20T-001",   prop2, "Logistics",              Decimal("210000.00"), "Ethiopian Motor Corporation", "good",      "active", date(2023, 8, 15)),
        ("heavy machinery",        "Grader Motor 140G",             "GM-140G-002",  prop2, "Logistics",              Decimal("165000.00"), "Ethiopian Motor Corporation", "fair",      "active", date(2022, 6, 10)),
        ("heavy machinery",        "Loader Wheel 930M",             "LW-930M-003",  prop3, "Production",             Decimal("90000.00"),  "Ethiopian Motor Corporation", "good",      "active", date(2023, 12, 20)),
        ("heavy machinery",        "Dump Truck 20T CAT 775G",       "DT-775G-004",  prop2, "Logistics",              Decimal("320000.00"), "Ethiopian Motor Corporation", "excellent", "active", date(2024, 2, 28)),

        # Light vehicles (4)
        ("light vehicle",          "Toyota Land Cruiser V8",        "TLC-V8-001",   prop1, "Administration",         Decimal("68000.00"),  "Ethiopian Motor Corporation", "excellent", "active", date(2024, 1, 30)),
        ("light vehicle",          "Isuzu NQR Bus 33-Seat",         "ISZ-NQR-002",  prop1, "Administration",         Decimal("52000.00"),  "Ethiopian Motor Corporation", "good",      "active", date(2023, 7, 18)),
        ("light vehicle",          "Bajaj Three-Wheeler",           "BAJ-3W-003",   prop2, "Logistics",              Decimal("4200.00"),   "Ethiopian Motor Corporation", "good",      "active", date(2024, 3, 5)),
        ("light vehicle",          "Honda CG 125 Motorcycle",       "HON-CG-004",   prop3, "Logistics",              Decimal("3000.00"),   "Ethiopian Motor Corporation", "good",      "active", date(2024, 4, 22)),

        # Office furniture (5)
        ("office furniture",       "L-Shape Executive Desk",        "LSD-EX-001",   prop1, "Administration",         Decimal("1100.00"),   "Office Furniture Depot",      "excellent", "active", date(2024, 2, 14)),
        ("office furniture",       "Swivel Chair Mid-Back",         "SCH-MB-002",   prop1, "Information Technology", Decimal("180.00"),    "Office Furniture Depot",      "good",      "active", date(2024, 1, 20)),
        ("office furniture",       "Steel Filing Cabinet 4-Drawer", "SFC-4D-003",   prop1, "Administration",         Decimal("320.00"),    "Office Furniture Depot",      "good",      "active", date(2023, 10, 8)),
        ("office furniture",       "Reception Counter Unit",        "RCU-RE-004",   prop1, "Administration",         Decimal("2200.00"),   "Office Furniture Depot",      "excellent", "active", date(2024, 5, 15)),
        ("office furniture",       "Bookshelf 5-Tier Wooden",       "BSH-5T-005",   prop1, "Information Technology", Decimal("210.00"),    "Office Furniture Depot",      "good",      "active", date(2024, 3, 11)),

        # Household furniture (2)
        ("household furniture",    "Single Bed Frame with Mattress","SBF-MT-001",   prop1, "Administration",         Decimal("420.00"),    "Office Furniture Depot",      "good",      "active", date(2023, 11, 20)),
        ("household furniture",    "Dining Table 6-Seat",           "DTB-6S-002",   prop1, "Administration",         Decimal("750.00"),    "Office Furniture Depot",      "excellent", "active", date(2024, 4, 9)),

        # Agricultural equipment (3)
        ("agricultural equipment", "Combine Harvester TC5000",      "CH-TC5-001",   prop2, "Production",             Decimal("185000.00"), "Ethiopian Motor Corporation", "good",      "active", date(2023, 9, 1)),
        ("agricultural equipment", "Seed Drill 24-Row",             "SD-24R-002",   prop2, "Production",             Decimal("22000.00"),  "Ethiopian Motor Corporation", "excellent", "active", date(2024, 1, 7)),
        ("agricultural equipment", "Crop Sprayer 600L",             "CS-600-003",   prop3, "Production",             Decimal("8500.00"),   "Ethiopian Motor Corporation", "good",      "active", date(2024, 2, 19)),

        # Miscellaneous (3)
        ("miscellaneous",          "CCTV Camera Set 16-Channel",    "CC-16C-001",   prop1, "Information Technology", Decimal("3500.00"),   "Global IT Solutions",         "excellent", "active", date(2024, 3, 28)),
        ("miscellaneous",          "UPS 3KVA Online",               "UPS-3KV-002",  prop1, "Information Technology", Decimal("1200.00"),   "Global IT Solutions",         "good",      "active", date(2024, 4, 14)),
        ("miscellaneous",          "Water Cooler Dispenser",        "WCD-RE-003",   prop1, "Administration",         Decimal("280.00"),    "Office Furniture Depot",      "good",      "active", date(2024, 5, 2)),
    ]

    serializer = AssetCreateSerializer()
    created = 0
    skipped = 0

    for row in assets_data:
        it_name, name, serial, prop, dept, cost, vendor, condition, status, p_date = row
        item_type_obj = item_types[it_name]

        # Skip if serial already exists
        if Asset.objects.filter(serial_number=serial).exists():
            print(f"  [SKIP] Serial {serial} already exists — {name}")
            skipped += 1
            continue

        generated_code = serializer.generate_asset_code(item_type_obj)

        asset = Asset.objects.create(
            asset_code=generated_code,
            name=name,
            serial_number=serial,
            property=prop,
            department=dept,
            purchase_cost=cost,
            purchase_date=p_date,
            status=status,
            condition=condition,
            vendor=vendor,
            item_type=item_type_obj,
            category=categories[it_name],
            owner=admin_user,
        )
        print(f"  [OK] {asset.asset_code} | {it_name:<25} | {asset.name}")
        created += 1

    print("=" * 60)
    print(f"Done!  Created: {created}  |  Skipped (duplicates): {skipped}")
    print(f"Total assets in DB now: {Asset.objects.count()}")
    print("=" * 60)


if __name__ == "__main__":
    seed_30_assets()
