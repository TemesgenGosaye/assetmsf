import os
import django
from decimal import Decimal
from datetime import date

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from django.contrib.auth import get_user_model
from departments.models import Department
from properties.models import Property
from categories.models import Category, ItemType
from common.models import Vendor
from assets.models import Asset

User = get_user_model()

def seed_db():
    print("=" * 60)
    print("Starting SAMS Database Seeding...")
    print("=" * 60)

    # 1. Get/Create Users (should exist from previous seeding, but let's be sure)
    superadmin, _ = User.objects.get_or_create(
        email='superadmin@msf.org',
        defaults={
            'name': 'Super Admin',
            'role': 'SUPER_ADMIN',
            'is_staff': True,
            'is_superuser': True,
            'status': 'active'
        }
    )
    admin_user, _ = User.objects.get_or_create(
        email='admin@demo.com',
        defaults={
            'name': 'Admin User',
            'role': 'ADMIN',
            'is_staff': True,
            'is_superuser': False,
            'status': 'active'
        }
    )
    print("Users verified.")

    # 2. Departments
    dept_data = [
        {'name': 'Administration', 'code': 'ADM', 'description': 'Company Administration'},
        {'name': 'Information Technology', 'code': 'IT', 'description': 'IT Support & Systems'},
        {'name': 'Logistics', 'code': 'LOG', 'description': 'Logistics, Warehouse, and Transport'},
        {'name': 'Production', 'code': 'PROD', 'description': 'Factory and Production operations'},
        {'name': 'Finance', 'code': 'FIN', 'description': 'Accounting and Finance'}
    ]
    
    depts = {}
    for d in dept_data:
        dept, created = Department.objects.get_or_create(
            code=d['code'],
            defaults={
                'name': d['name'],
                'description': d['description'],
                'head': admin_user
            }
        )
        depts[d['code']] = dept
        action = "Created" if created else "Found"
        print(f"  - {action} Department: {dept.name} ({dept.code})")

    # 3. Properties
    prop_data = [
        {
            'id': 'PROP-001',
            'name': 'Main Headquarters',
            'type': 'office',
            'address': '123 Admin St',
            'city': 'Addis Ababa',
            'country': 'Ethiopia',
            'status': 'active',
            'manager': superadmin
        },
        {
            'id': 'PROP-002',
            'name': 'Central Warehouse',
            'type': 'storage',
            'address': '45 Logistics Rd',
            'city': 'Metahara',
            'country': 'Ethiopia',
            'status': 'active',
            'manager': admin_user
        },
        {
            'id': 'PROP-003',
            'name': 'Production Factory',
            'type': 'manufacturing',
            'address': 'Factory Zone A',
            'city': 'Metahara',
            'country': 'Ethiopia',
            'status': 'active',
            'manager': admin_user
        }
    ]

    properties = {}
    for p in prop_data:
        prop, created = Property.objects.get_or_create(
            id=p['id'],
            defaults={
                'name': p['name'],
                'type': p['type'],
                'address': p['address'],
                'city': p['city'],
                'country': p['country'],
                'status': p['status'],
                'manager': p['manager']
            }
        )
        properties[p['id']] = prop
        action = "Created" if created else "Found"
        print(f"  - {action} Property: {prop.name} ({prop.id})")

    # 4. Categories
    cat_data = [
        {'name': 'Office Equipment', 'code': 'OFF-EQ', 'description': 'Office utility machines'},
        {'name': 'IT Hardware', 'code': 'IT-HW', 'description': 'Computers, servers, and network devices'},
        {'name': 'Vehicles', 'code': 'VEH', 'description': 'Cars, trucks, and other transport machinery'},
        {'name': 'Furniture', 'code': 'FUR', 'description': 'Desks, chairs, cabinets, etc.'}
    ]

    categories = {}
    for c in cat_data:
        cat, created = Category.objects.get_or_create(
            code=c['code'],
            defaults={
                'name': c['name'],
                'description': c['description']
            }
        )
        categories[c['code']] = cat
        action = "Created" if created else "Found"
        print(f"  - {action} Category: {cat.name} ({cat.code})")

    # 5. Item Types
    item_type_data = [
        {
            'name': 'office furniture',
            'category_code': 'FUR',
            'description': 'Furniture for office workspaces',
            'depreciation': Decimal('10.00'),
            'warranty': 12
        },
        {
            'name': 'light vehicle',
            'category_code': 'VEH',
            'description': 'Sedans, SUVs, and Pickups',
            'depreciation': Decimal('20.00'),
            'warranty': 36
        },
        {
            'name': 'laptop',
            'category_code': 'IT-HW',
            'description': 'Personal laptop computers',
            'depreciation': Decimal('25.00'),
            'warranty': 24
        },
        {
            'name': 'printer',
            'category_code': 'IT-HW',
            'description': 'Printers and scanners',
            'depreciation': Decimal('15.00'),
            'warranty': 12
        },
        {
            'name': 'generator',
            'category_code': 'OFF-EQ',
            'description': 'Electricity backup generators',
            'depreciation': Decimal('15.00'),
            'warranty': 24
        }
    ]

    item_types = {}
    for it in item_type_data:
        item_type, created = ItemType.objects.get_or_create(
            name=it['name'],
            defaults={
                'category': categories[it['category_code']],
                'description': it['description'],
                'default_depreciation_rate': it['depreciation'],
                'default_warranty_period': it['warranty']
            }
        )
        item_types[it['name']] = item_type
        action = "Created" if created else "Found"
        print(f"  - {action} ItemType: {item_type.name}")

    # 6. Vendors
    vendor_data = [
        {
            'name': 'Ethiopian Motor Corporation',
            'code': 'EMC',
            'contact': 'John Doe',
            'email': 'info@emc.com',
            'phone': '+251911223344',
            'address': 'Bole Sub City, Road 5',
            'city': 'Addis Ababa',
            'country': 'Ethiopia'
        },
        {
            'name': 'Global IT Solutions',
            'code': 'GITS',
            'contact': 'Jane Smith',
            'email': 'support@gits.com',
            'phone': '+251911556677',
            'address': 'Piassa, Church St',
            'city': 'Addis Ababa',
            'country': 'Ethiopia'
        },
        {
            'name': 'Office Furniture Depot',
            'code': 'OFD',
            'contact': 'Bob Johnson',
            'email': 'sales@ofd.com',
            'phone': '+251911990011',
            'address': 'Industrial Zone',
            'city': 'Metahara',
            'country': 'Ethiopia'
        }
    ]

    vendors = {}
    for v in vendor_data:
        vendor, created = Vendor.objects.get_or_create(
            code=v['code'],
            defaults={
                'name': v['name'],
                'contact_person': v['contact'],
                'email': v['email'],
                'phone': v['phone'],
                'address': v['address'],
                'city': v['city'],
                'country': v['country'],
                'status': 'active'
            }
        )
        vendors[v['name']] = vendor
        action = "Created" if created else "Found"
        print(f"  - {action} Vendor: {vendor.name} ({vendor.code})")

    # 7. Assets
    asset_data = [
        {
            'asset_code': '60-0-00-001',
            'name': 'Dell Latitude 5420',
            'serial_number': 'DELL-SN-12345',
            'property_id': 'PROP-001',
            'department': 'Information Technology',
            'quantity': 1,
            'purchase_cost': Decimal('1200.00'),
            'purchase_date': date(2025, 1, 10),
            'status': 'active',
            'condition': 'excellent',
            'vendor_name': 'Global IT Solutions',
            'category_code': 'IT-HW',
            'item_type_name': 'laptop'
        },
        {
            'asset_code': '60-0-00-002',
            'name': 'HP ProBook 450',
            'serial_number': 'HP-SN-67890',
            'property_id': 'PROP-001',
            'department': 'Finance',
            'quantity': 1,
            'purchase_cost': Decimal('1000.00'),
            'purchase_date': date(2025, 2, 15),
            'status': 'active',
            'condition': 'good',
            'vendor_name': 'Global IT Solutions',
            'category_code': 'IT-HW',
            'item_type_name': 'laptop'
        },
        {
            'asset_code': '60-0-00-003',
            'name': 'Toyota Hilux',
            'serial_number': 'TOY-HILUX-987',
            'property_id': 'PROP-002',
            'department': 'Logistics',
            'quantity': 1,
            'purchase_cost': Decimal('35000.00'),
            'purchase_date': date(2024, 6, 20),
            'status': 'active',
            'condition': 'good',
            'vendor_name': 'Ethiopian Motor Corporation',
            'category_code': 'VEH',
            'item_type_name': 'light vehicle'
        },
        {
            'asset_code': '60-0-00-004',
            'name': 'Executive Mahogany Desk',
            'serial_number': 'FUR-DSK-001',
            'property_id': 'PROP-001',
            'department': 'Administration',
            'quantity': 1,
            'purchase_cost': Decimal('450.00'),
            'purchase_date': date(2023, 11, 5),
            'status': 'active',
            'condition': 'excellent',
            'vendor_name': 'Office Furniture Depot',
            'category_code': 'FUR',
            'item_type_name': 'office furniture'
        },
        {
            'asset_code': '60-0-00-005',
            'name': 'Cummins 150kVA Generator',
            'serial_number': 'GEN-CUM-999',
            'property_id': 'PROP-003',
            'department': 'Production',
            'quantity': 1,
            'purchase_cost': Decimal('15000.00'),
            'purchase_date': date(2023, 1, 15),
            'status': 'active',
            'condition': 'fair',
            'vendor_name': 'Ethiopian Motor Corporation',
            'category_code': 'OFF-EQ',
            'item_type_name': 'generator'
        }
    ]

    for a in asset_data:
        asset, created = Asset.objects.get_or_create(
            asset_code=a['asset_code'],
            defaults={
                'name': a['name'],
                'serial_number': a['serial_number'],
                'property': properties[a['property_id']],
                'department': a['department'],
                'quantity': a['quantity'],
                'purchase_cost': a['purchase_cost'],
                'purchase_date': a['purchase_date'],
                'status': a['status'],
                'condition': a['condition'],
                'vendor': a['vendor_name'],
                'category': categories[a['category_code']],
                'item_type': item_types[a['item_type_name']],
                'owner': superadmin
            }
        )
        action = "Created" if created else "Found"
        print(f"  - {action} Asset: {asset.name} ({asset.asset_code})")

    print("=" * 60)
    print("SAMS Database Seeding Completed Successfully!")
    print("=" * 60)

if __name__ == "__main__":
    seed_db()
