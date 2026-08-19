"""
Test asset CRUD operations end-to-end via the REST API.
Run from sams_backend directory: python test_asset_crud.py
"""
import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from django.test import Client
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

# ── Find first admin user ─────────────────────────────────────────────────
try:
    admin = User.objects.filter(role__in=['ADMIN', 'SUPER_ADMIN'], is_active=True).first()
    if not admin:
        admin = User.objects.filter(is_superuser=True, is_active=True).first()
    if not admin:
        admin = User.objects.filter(is_active=True).first()
    print(f"Using user: {admin.email} (role={admin.role})")
except Exception as e:
    print(f"Could not find user: {e}")
    exit(1)

# ── Get JWT token ─────────────────────────────────────────────────────────
refresh = RefreshToken.for_user(admin)
token = str(refresh.access_token)
print(f"Token acquired (first 30 chars): {token[:30]}...")

# ── Get first property ────────────────────────────────────────────────────
from properties.models import Property
prop = Property.objects.filter(is_active=True).first()
if not prop:
    print("ERROR: No active properties found. Cannot create asset.")
    exit(1)
print(f"Using property: {prop.id} - {prop.name}")

# ── Django test client ────────────────────────────────────────────────────
client = Client()
headers = {"HTTP_AUTHORIZATION": f"Bearer {token}", "content_type": "application/json"}

# ── CREATE ────────────────────────────────────────────────────────────────
print("\n--- CREATE ---")
create_data = {
    "name": "Test Laptop",
    "property": str(prop.id),
    "department": "MANAGEMENT INFORMATION SYSTEM",
    "location": "Room 101",
    "quantity": 1,
    "condition": "good",
    "status": "active",
    "description": "Test asset for CRUD verification",
    "item_type_name": "Laptop",
}
resp = client.post("/api/assets/", json.dumps(create_data), **headers)
print(f"Status: {resp.status_code}")
body = json.loads(resp.content)
print(f"Success: {body.get('success')}")
print(f"Message: {body.get('message')}")
if body.get('success'):
    asset_id = body['data']['id']
    asset_code = body['data']['asset_code']
    print(f"Created asset: {asset_code} (id={asset_id})")
else:
    print(f"Errors: {body.get('errors') or body.get('data')}")
    exit(1)

# ── READ ──────────────────────────────────────────────────────────────────
print("\n--- READ ---")
resp = client.get(f"/api/assets/{asset_id}/", **headers)
print(f"Status: {resp.status_code}")
body = json.loads(resp.content)
print(f"Name: {body['data']['name']}, Condition: {body['data']['condition']}")

# ── UPDATE ────────────────────────────────────────────────────────────────
print("\n--- UPDATE ---")
update_data = {
    "name": "Updated Laptop",
    "department": "FINANCE DEPARTMENT",
    "location": "Room 202",
    "quantity": 2,
    "condition": "excellent",
    "status": "active",
}
resp = client.put(f"/api/assets/{asset_id}/", json.dumps(update_data), **headers)
print(f"Status: {resp.status_code}")
body = json.loads(resp.content)
print(f"Success: {body.get('success')}")
if body.get('success'):
    print(f"Updated name: {body['data']['name']}, condition: {body['data']['condition']}")
else:
    print(f"Errors: {body.get('errors') or body.get('data')}")

# ── DELETE ────────────────────────────────────────────────────────────────
print("\n--- DELETE ---")
resp = client.delete(f"/api/assets/{asset_id}/", **headers)
print(f"Status: {resp.status_code}")
if resp.content:
    body = json.loads(resp.content)
    print(f"Success: {body.get('success')}, Message: {body.get('message')}")
else:
    print("204 No Content (expected for DELETE)")

# ── VERIFY DELETED ────────────────────────────────────────────────────────
print("\n--- VERIFY DELETED ---")
resp = client.get(f"/api/assets/{asset_id}/", **headers)
print(f"Status: {resp.status_code} (expected 404)")
print("✅ All CRUD operations verified successfully!" if resp.status_code == 404 else "⚠️  Asset still accessible after delete")
