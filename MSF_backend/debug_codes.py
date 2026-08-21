"""Debug: find which item types produce duplicate codes."""
import os, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'MSF_backend.settings')
import django; django.setup()

from categories.constants import ASSET_MASTER
from categories.models import ItemType
from collections import Counter

code_lookup = {}
for group_code, group_name, items in ASSET_MASTER:
    for item_code, item_name in items:
        code_lookup[item_name.lower().strip()] = item_code

results = []
for it in ItemType.objects.all():
    name = it.name
    clean_name = name.split(': ', 1)[1].strip() if ': ' in name else name.strip()
    code = code_lookup.get(clean_name.lower())
    if not code:
        for k, v in code_lookup.items():
            if clean_name.lower() in k or k in clean_name.lower():
                code = v
                break
    results.append((it.id, it.name, code))

codes = [r[2] for r in results]
dups = {c: n for c, n in Counter(codes).items() if n > 1}
print(f"Total items: {len(results)}")
print(f"Items with code: {sum(1 for r in results if r[2])}")
print(f"Items without code: {sum(1 for r in results if not r[2])}")
print(f"\nDuplicate codes ({len(dups)}):")
for code, count in sorted(dups.items()):
    items = [(r[1], r[2]) for r in results if r[2] == code]
    print(f"  Code '{code}' ({count}x):")
    for name, c in items:
        print(f"    - {name}")

# Also check items without any code
print(f"\nItems without code:")
for r in results:
    if not r[2]:
        print(f"  - {r[1]}")
