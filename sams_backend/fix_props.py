"""
Fix property activation and add sample data for all new item types.
Run directly: python fix_props.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
import django
django.setup()

from properties.models import Property
from categories.models import ItemType
from assets.models import Asset
from django.contrib.auth import get_user_model

# ── 1. Activate all standard properties ────────────────────────────────────
for pid in ['PROP-001', 'PROP-002', 'PROP-003']:
    prop = Property.objects.filter(id=pid).first()
    if prop:
        prop.is_active = True
        prop.save()
        print(f"Activated: {prop.id} - {prop.name}")

# Also set meaningful names for all numbered properties
prop_names = {
    'PROP-001': 'Main Office',
    'PROP-002': 'Warehouse B',
    'PROP-003': 'Branch Office',
    'PROP-004': 'Factory 1',
    'PROP-005': 'Workshop',
    'PROP-006': 'Field Site Alpha',
    'PROP-007': 'Storage Yard',
    'PROP-008': 'Admin Building',
    'PROP-009': 'Guest House',
    'PROP-010': 'Satellite Office',
}
for pid, name in prop_names.items():
    prop = Property.objects.filter(id=pid).first()
    if prop:
        prop.is_active = True
        prop.status = 'Active'
        prop.name = name
        prop.save()
        print(f"Updated: {prop.id} - {prop.name}")
    else:
        Property.objects.create(id=pid, name=name, type='Office', status='Active', is_active=True)
        print(f"Created: {pid} - {name}")

print("All properties active.")

# ── 2. Delete ALL existing assets ──────────────────────────────────────────
existing_count = Asset.objects.all().count()
Asset.objects.all().delete()
print(f"Deleted {existing_count} existing assets.")

# ── 3. Create sample assets for each item type ─────────────────────────────
User = get_user_model()
admin = User.objects.filter(role__in=['ADMIN', 'SUPER_ADMIN'], is_active=True).first()
if not admin:
    admin = User.objects.filter(is_active=True).first()
print(f"Using user: {admin.email if admin else 'N/A'}")

ITEM_TYPE_PREFIXES = {
    "irrigation item": "1",
    "bridge item": "2",
    "factory equipment": "3",
    "heavy machinery": "4",
    "light vehicle": "5",
    "office furniture": "6",
    "household furniture": "7",
    "agricultural equipment": "8",
    "miscellaneous": "10",
}

# Ensure all ItemType objects exist in DB
for type_name in ITEM_TYPE_PREFIXES:
    ItemType.objects.get_or_create(name=type_name, defaults={'is_active': True})
    print(f"  ItemType ready: {type_name}")

# Cache ItemType instances
ITEM_TYPE_CACHE = {}
for type_name in ITEM_TYPE_PREFIXES:
    obj, _ = ItemType.objects.get_or_create(name=type_name, defaults={'is_active': True})
    ITEM_TYPE_CACHE[type_name] = obj

SAMPLE_ASSETS = [
    # irrigation item (prefix 1 -> 10-0-00-xxx)
    ("irrigation item", "Center Pivot Unit", 3, "PROP-004"),
    ("irrigation item", "Drip Line Kit", 5, "PROP-006"),
    ("irrigation item", "Sprinkler Head Assembly", 10, "PROP-006"),
    # bridge item (prefix 2 -> 20-0-00-xxx)
    ("bridge item", "Steel Beam Support", 2, "PROP-007"),
    ("bridge item", "Concrete Deck Panel", 4, "PROP-007"),
    # factory equipment (prefix 3 -> 30-0-00-xxx)
    ("factory equipment", "CNC Milling Machine", 1, "PROP-004"),
    ("factory equipment", "Hydraulic Press 50T", 1, "PROP-004"),
    ("factory equipment", "Conveyor Belt Motor", 3, "PROP-004"),
    ("factory equipment", "Industrial Boiler", 1, "PROP-004"),
    # heavy machinery (prefix 4 -> 40-0-00-xxx)
    ("heavy machinery", "Bulldozer D6", 1, "PROP-007"),
    ("heavy machinery", "Excavator 320", 1, "PROP-007"),
    ("heavy machinery", "Forklift 3T", 2, "PROP-002"),
    # light vehicle (prefix 5 -> 50-0-00-xxx)
    ("light vehicle", "Toyota Hilux Double Cab", 3, "PROP-001"),
    ("light vehicle", "Suzuki Swift Sedan", 2, "PROP-001"),
    ("light vehicle", "Motorcycle Yamaha 125", 5, "PROP-006"),
    # office furniture (prefix 6 -> 60-0-00-xxx)
    ("office furniture", "Executive Desk", 4, "PROP-001"),
    ("office furniture", "Office Chair Ergonomic", 10, "PROP-001"),
    ("office furniture", "Bookshelf 6-Shelf", 3, "PROP-003"),
    ("office furniture", "Meeting Table 8-Seat", 1, "PROP-001"),
    # household furniture (prefix 7 -> 70-0-00-xxx)
    ("household furniture", "Double Bed Frame", 6, "PROP-009"),
    ("household furniture", "Wardrobe 3-Door", 4, "PROP-009"),
    ("household furniture", "Dining Table 6-Seat", 2, "PROP-009"),
    ("household furniture", "Sofa Set 3-Seater", 3, "PROP-009"),
    # agricultural equipment (prefix 8 -> 80-0-00-xxx)
    ("agricultural equipment", "Tractor MF 285", 2, "PROP-006"),
    ("agricultural equipment", "Plough Disc Harrow", 3, "PROP-006"),
    ("agricultural equipment", "Seed Drill 12-Row", 1, "PROP-006"),
    # miscellaneous (prefix 10 -> 100-0-00-xxx)
    ("miscellaneous", "Safety Helmet Box", 20, "PROP-001"),
    ("miscellaneous", "Fire Extinguisher 5kg", 15, "PROP-001"),
    ("miscellaneous", "First Aid Kit Wall-Mount", 10, "PROP-003"),
    ("miscellaneous", "LED Floodlight 200W", 12, "PROP-004"),
    ("miscellaneous", "Water Pump 2HP", 4, "PROP-006"),
]

def gen_id(item_type, seq):
    prefix = ITEM_TYPE_PREFIXES.get(item_type, "0")
    return f"{prefix}0-0-00-{str(seq).zfill(3)}"

seq = 0
for type_name, name, qty, prop_id in SAMPLE_ASSETS:
    prop = Property.objects.filter(id=prop_id).first()
    if not prop:
        print(f"  WARNING: Property {prop_id} not found, skipping {name}")
        continue
    item_type_obj = ITEM_TYPE_CACHE.get(type_name)
    if not item_type_obj:
        print(f"  WARNING: ItemType {type_name} not found, skipping {name}")
        continue
    for i in range(qty):
        seq += 1
        aid = gen_id(type_name, seq)
        Asset.objects.create(
            asset_code=aid,
            name=name,
            item_type=item_type_obj,
            property=prop,
            department='General',
            quantity=1,
            status='active',
            condition='good',
            created_by=admin,
            updated_by=admin,
        )
        if i == 0 or i == qty - 1:
            print(f"  {aid} | {name} | {type_name} | {prop_id}")

print(f"\nTotal assets created: {seq}")

# ── Verify ──────────────────────────────────────────────────────────────────
from django.db.models import Count
counts = Asset.objects.values('item_type__name').annotate(cnt=Count('id')).order_by('item_type__name')
print("\nVerification by type:")
for c in counts:
    print(f"  {c['item_type__name']}: {c['cnt']}")

print("\nSample IDs:")
for a in Asset.objects.all().select_related('item_type').order_by('asset_code')[:15]:
    it_name = a.item_type.name if a.item_type else 'None'
    print(f"  {a.asset_code} | {a.name} | {it_name}")
print("  ...")
for a in Asset.objects.all().select_related('item_type').order_by('-asset_code')[:5]:
    it_name = a.item_type.name if a.item_type else 'None'
    print(f"  {a.asset_code} | {a.name} | {it_name}")

print("\nDone!")
