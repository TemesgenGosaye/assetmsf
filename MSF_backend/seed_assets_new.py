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

def seed_real_assets():
    print("=" * 60)
    print("Starting Detailed Asset Database Seeding...")
    print("=" * 60)

    # Clean existing assets
    existing_count = Asset.objects.all().count()
    Asset.objects.all().delete()
    print(f"Deleted {existing_count} existing assets.")

    # Get admin user and properties
    User = get_user_model()
    admin_user = User.objects.filter(role__in=['ADMIN', 'SUPER_ADMIN']).first()
    if not admin_user:
        admin_user = User.objects.first()

    prop1 = Property.objects.filter(id='PROP-001').first()
    prop2 = Property.objects.filter(id='PROP-002').first()
    prop3 = Property.objects.filter(id='PROP-003').first()

    if not all([prop1, prop2, prop3]):
        print("Error: Properties PROP-001, PROP-002, PROP-003 must exist.")
        return

    # Define sample data for each item type to seed
    # Each tuple: (item_type_name, asset_name, serial, property_obj, department, purchase_cost, vendor)
    assets_data = [
        # 1. irrigation item (Starts at 100 -> prefix 10-0-00-100)
        ("irrigation item", "Center Pivot Unit", "CP-901-IRR", prop2, "Production", Decimal("12000.00"), "Global IT Solutions"),
        ("irrigation item", "Drip Irrigation Kit", "DK-402-IRR", prop3, "Logistics", Decimal("4500.00"), "Global IT Solutions"),
        ("irrigation item", "Sprinkler Head Assembly", "SH-103-IRR", prop3, "Production", Decimal("1200.00"), "Global IT Solutions"),
        
        # 2. bridge item (Starts at 200 -> prefix 20-0-00-200)
        ("bridge item", "Steel Beam Support", "SB-301-BRG", prop2, "Logistics", Decimal("25000.00"), "Ethiopian Motor Corporation"),
        ("bridge item", "Concrete Deck Panel", "CD-302-BRG", prop2, "Logistics", Decimal("15000.00"), "Ethiopian Motor Corporation"),
        
        # 3. factory equipment (Starts at 300 -> prefix 30-0-00-300)
        ("factory equipment", "CNC Milling Machine", "CNC-701-FAC", prop3, "Production", Decimal("85000.00"), "Global IT Solutions"),
        ("factory equipment", "Industrial Boiler", "IB-702-FAC", prop3, "Production", Decimal("45000.00"), "Global IT Solutions"),
        ("factory equipment", "Hydraulic Press 50T", "HP-703-FAC", prop3, "Production", Decimal("32000.00"), "Global IT Solutions"),
        
        # 4. heavy machinery (Starts at 400 -> prefix 40-0-00-400)
        ("heavy machinery", "Excavator 320", "EXC-501-HVY", prop2, "Logistics", Decimal("125000.00"), "Ethiopian Motor Corporation"),
        ("heavy machinery", "Bulldozer D6", "BD-502-HVY", prop2, "Logistics", Decimal("98000.00"), "Ethiopian Motor Corporation"),
        ("heavy machinery", "Forklift 3T", "FL-503-HVY", prop2, "Logistics", Decimal("18000.00"), "Ethiopian Motor Corporation"),
        
        # 5. light vehicle (Starts at 500 -> prefix 50-0-00-500)
        ("light vehicle", "Toyota Hilux Double Cab", "TOY-HILUX-501", prop1, "Logistics", Decimal("38000.00"), "Ethiopian Motor Corporation"),
        ("light vehicle", "Suzuki Swift Sedan", "SUZ-SWIFT-502", prop1, "Administration", Decimal("15000.00"), "Ethiopian Motor Corporation"),
        ("light vehicle", "Motorcycle Yamaha 125", "YAM-125-503", prop2, "Logistics", Decimal("3500.00"), "Ethiopian Motor Corporation"),
        
        # 6. office furniture (Starts at 600 -> prefix 60-0-00-600)
        ("office furniture", "Executive mahogany Desk", "DESK-EX-601", prop1, "Administration", Decimal("850.00"), "Office Furniture Depot"),
        ("office furniture", "Office Chair Ergonomic", "CHR-ER-602", prop1, "Information Technology", Decimal("250.00"), "Office Furniture Depot"),
        ("office furniture", "Meeting Table 8-Seat", "TBL-MT-603", prop1, "Administration", Decimal("1200.00"), "Office Furniture Depot"),
        
        # 7. household furniture (Starts at 700 -> prefix 70-0-00-700)
        ("household furniture", "Double Bed Frame", "BED-DB-701", prop1, "Administration", Decimal("650.00"), "Office Furniture Depot"),
        ("household furniture", "Wardrobe 3-Door", "WD-3D-702", prop1, "Administration", Decimal("450.00"), "Office Furniture Depot"),
        
        # 8. agricultural equipment (Starts at 800 -> prefix 80-0-00-800)
        ("agricultural equipment", "Tractor MF 285", "TRAC-MF-801", prop2, "Production", Decimal("45000.00"), "Ethiopian Motor Corporation"),
        ("agricultural equipment", "Plough Disc Harrow", "PL-DH-802", prop2, "Production", Decimal("6500.00"), "Ethiopian Motor Corporation"),
        
        # 9. miscellaneous (Starts at 900 -> prefix 100-0-00-900)
        ("miscellaneous", "Safety Helmet Box", "HELM-BX-901", prop1, "Logistics", Decimal("150.00"), "Office Furniture Depot"),
        ("miscellaneous", "Fire Extinguisher 5kg", "FE-5KG-902", prop1, "Administration", Decimal("80.00"), "Office Furniture Depot"),
        ("miscellaneous", "First Aid Kit Wall-Mount", "FA-WM-903", prop3, "Production", Decimal("50.00"), "Office Furniture Depot"),
    ]

    # Pre-cache or create Categories to match ItemTypes
    category_map = {
        "irrigation item": "Infrastructure",
        "bridge item": "Infrastructure",
        "factory equipment": "Machinery",
        "heavy machinery": "Machinery",
        "light vehicle": "Transport",
        "office furniture": "Furniture",
        "household furniture": "Furniture",
        "agricultural equipment": "Agriculture",
        "miscellaneous": "Utility"
    }

    # Ensure categories exist
    categories = {}
    for name, cat_name in category_map.items():
        cat_code = cat_name.upper()[:3]
        cat, _ = Category.objects.get_or_create(
            name=cat_name,
            defaults={'code': cat_code}
        )
        categories[name] = cat

    # Ensure item types exist and link to categories
    item_types = {}
    for it_name in category_map.keys():
        it, _ = ItemType.objects.get_or_create(
            name=it_name,
            defaults={
                'category': categories[it_name],
                'is_active': True
            }
        )
        item_types[it_name] = it

    # Create assets using the AssetCreateSerializer so code generation is tested and applied
    serializer = AssetCreateSerializer()

    for it_name, name, serial, prop, dept, cost, vendor in assets_data:
        item_type_obj = item_types[it_name]
        
        # Let's call serializer's generate_asset_code
        generated_code = serializer.generate_asset_code(item_type_obj)

        asset = Asset.objects.create(
            asset_code=generated_code,
            name=name,
            serial_number=serial,
            property=prop,
            department=dept,
            purchase_cost=cost,
            purchase_date=date(2025, 3, 1),
            status="active",
            condition="excellent",
            vendor=vendor,
            item_type=item_type_obj,
            category=categories[it_name],
            owner=admin_user
        )
        print(f"  - Created Asset: {asset.asset_code} | Type: {it_name} | Name: {asset.name}")

    print("=" * 60)
    print(f"Asset Seeding Complete! Total Assets: {Asset.objects.all().count()}")
    print("=" * 60)

if __name__ == "__main__":
    seed_real_assets()
