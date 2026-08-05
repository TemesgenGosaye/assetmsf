import os, json
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
import django
django.setup()
from django.test import Client
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from houses.models import HouseApplication, House

U = get_user_model()
u = U.objects.filter(role__in=[U.Role.ADMIN, U.Role.SUPER_ADMIN, U.Role.MANAGER]).first()
print("User:", u.email if u else None, "role:", u.role if u else None)

c = Client()
token = str(RefreshToken.for_user(u).access_token)
c.defaults["HTTP_AUTHORIZATION"] = f"Bearer {token}"

# 1) status update from Submitted -> Verified (frontend "Verify" path; was 400)
app = HouseApplication.objects.filter(status="Submitted").first()
print("App:", app.id if app else None, app.status if app else "")
if app:
    r = c.patch(
        f"/api/houses/applications/{app.id}/status/",
        data=json.dumps({"status": "Verified"}),
        content_type="application/json",
    )
    print("STATUS Submitted->Verified ->", r.status_code)
    print(r.content[:300])
    if r.status_code == 200:
        app.refresh_from_db()
        print("  app.status now:", app.status)

# 2) auto-allocate with a house_id (was 500: house.house_number AttributeError)
waiting = HouseApplication.objects.filter(
    status__in=["Verified", "Waiting for Allocation"], is_active=True,
).select_related("emp_record")
house = None
for wa in waiting:
    candidates = House.objects.filter(
        house_type=wa.eligible_house_category, status="Active", is_active=True,
    )
    for h in candidates:
        if h.is_available:
            house = h
            break
    if house:
        break
if house:
    r2 = c.post("/api/houses/auto-allocate/",
                data=json.dumps({"house_id": house.house_id}), content_type="application/json")
    print("AUTO-ALLOCATE house_id ->", r2.status_code)
    print(r2.content[:900])
else:
    print("AUTO-ALLOCATE house_id -> no eligible house/candidate found")

# 3) batch-allocate
r3 = c.post("/api/houses/batch-allocate/", data=json.dumps({}), content_type="application/json")
print("BATCH-ALLOCATE ->", r3.status_code)
print(r3.content[:900])

# 4) check houses
print("Houses available:", [(h.house_id, h.house_type, h.status, h.capacity) for h in House.objects.all()[:6]])
