import os, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'MSF_backend.settings')
import django; django.setup()

from assets.models import Asset
from categories.models import ItemType, Category
from departments.models import Department

print("=== EXISTING ASSETS ===")
for a in Asset.objects.all().order_by('asset_code'):
    it_name = a.item_type.name if a.item_type else 'None'
    cat_name = a.category.name if a.category else 'None'
    print(f"  code={a.asset_code} | name={a.name} | dept={a.department} | item_type={it_name} | category={cat_name}")
print(f"Total assets: {Asset.objects.count()}")

print("\n=== ITEM TYPES (first 20) ===")
for it in ItemType.objects.all()[:20]:
    cat_name = it.category.name if it.category else 'None'
    print(f"  name={it.name} | category={cat_name}")
print(f"Total item types: {ItemType.objects.count()}")

print("\n=== CATEGORIES ===")
for c in Category.objects.all():
    print(f"  code={c.code} | name={c.name}")
print(f"Total categories: {Category.objects.count()}")

print("\n=== DEPARTMENTS (first 15) ===")
for d in Department.objects.all()[:15]:
    print(f"  code={d.code} | name={d.name} | level={d.level}")
print(f"Total departments: {Department.objects.count()}")
