"""Check properties, asset model fields, and test creating an asset."""
import os, sys, json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
import django
django.setup()

from properties.models import Property
from categories.models import ItemType
from assets.models import Asset
from django.contrib.auth import get_user_model

User = get_user_model()

# Check properties
props = Property.objects.all().values('id','name','is_active','status')
print("=== PROPERTIES ===")
for p in props:
    print(f'  {p["id"]!r:20} | {p["name"]!r:20} | active={p["is_active"]}')

# Check item types
items = ItemType.objects.all().values('id','name','is_active')
print("\n=== ITEM TYPES (current) ===")
for i in items:
    print(f'  id={i["id"]} | {i["name"]!r} | active={i["is_active"]}')

# Check existing assets
assets = Asset.objects.all().values('id','asset_code','name','status','condition','department','quantity','property_id')[:10]
print("\n=== EXISTING ASSETS (first 10) ===")
for a in assets:
    print(f'  {a["asset_code"]!r:20} | {a["name"]!r:20} | qty={a["quantity"]} | prop={a["property_id"]}')

# Test creating an asset using model directly to check field constraints
admin = User.objects.filter(role__in=['ADMIN', 'SUPER_ADMIN'], is_active=True).first()
prop = Property.objects.filter(id='PROP-001', is_active=True).first()
print(f"\n=== MODEL FIELD CONSTRAINTS ===")
print(f"Admin: {admin.email if admin else 'N/A'}")
print(f"Property: {prop.id if prop else 'N/A'}")

# Check model field details
from django.db import models
for field in Asset._meta.get_fields():
    if hasattr(field, 'null') and not field.auto_created and not field.one_to_one and not field.many_to_many and not field.one_to_many:
        null = field.null
        blank = getattr(field, 'blank', None)
        default = getattr(field, 'default', 'NOT SET')
        unique = getattr(field, 'unique', False)
        is_fk = field.many_to_one or field.one_to_one or field.one_to_many
        fk_to = field.related_model.__name__ if is_fk else ''
        print(f'  {field.name:25} | null={null} blank={blank} unique={unique} default={default!r:15} | {"FK→"+fk_to if is_fk else ""}')

# Check the serializer manually
print("\n=== SERIALIZER FIELD ANALYSIS ===")
from rest_framework import serializers as drf_s
from assets.serializers import AssetCreateSerializer

# Check which fields are required
ser = AssetCreateSerializer()
for field_name, field in ser.fields.items():
    required = field.required
    allow_null = field.allow_null
    allow_blank = getattr(field, 'allow_blank', None)
    write_only = field.write_only
    read_only = field.read_only
    ftype = type(field).__name__
    print(f'  {field_name:25} | {ftype:25} | required={required} allow_null={allow_null} allow_blank={allow_blank}')

# Now try to create via model directly 
print("\n=== TEST CREATION VIA MODEL ===")
try:
    Asset.objects.create(
        asset_code='TEST-000001',
        name='Direct Model Test',
        property=prop,
        department='IT',
        quantity=1,
        status='active',
        condition='good',
        created_by=admin,
        updated_by=admin,
    )
    print("  Direct model creation: SUCCESS ✓")
    Asset.objects.filter(asset_code='TEST-000001').delete()
    print("  (deleted)")
except Exception as e:
    print(f"  Direct model creation FAILED: {e}")

print("\nDone!")
