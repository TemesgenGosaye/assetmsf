import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from authentication.models import User

users = [
    # Admins
    {"email": "temesgen@msf.com", "name": "Temesgen", "role": "ADMIN", "password": "admin123", "is_staff": True},
    {"email": "tsegaye@msf.com", "name": "Tsegaye", "role": "ADMIN", "password": "admin123", "is_staff": True},
    {"email": "lebata@msf.com", "name": "Lebata", "role": "ADMIN", "password": "admin123", "is_staff": True},
    {"email": "yitgesu@msf.com", "name": "Yitgesu", "role": "ADMIN", "password": "admin123", "is_staff": True},
    {"email": "ermias@msf.com", "name": "Ermias", "role": "ADMIN", "password": "admin123", "is_staff": True},
    {"email": "biniam@msf.com", "name": "Biniam", "role": "ADMIN", "password": "admin123", "is_staff": True},
    # Applicants
    {"email": "helen@msf.com", "name": "Helen", "role": "APPLICANT", "password": "user123"},
    {"email": "abdi@msf.com", "name": "Abdi", "role": "APPLICANT", "password": "user123"},
]

for u in users:
    pw = u.pop("password")
    is_staff = u.pop("is_staff", False)
    user, created = User.objects.get_or_create(
        email=u["email"],
        defaults={**u, "status": "active", "is_staff": is_staff},
    )
    if created:
        user.set_password(pw)
        user.save()
        print(f"CREATED  {u['email']:30s} role={u['role']:12s} pw={pw}")
    else:
        # Update if exists
        changed = False
        for k, v in u.items():
            if getattr(user, k, None) != v:
                setattr(user, k, v)
                changed = True
        if is_staff != user.is_staff:
            user.is_staff = is_staff
            changed = True
        user.set_password(pw)
        changed = True
        if changed:
            user.save()
            print(f"UPDATED  {u['email']:30s} role={u['role']:12s} pw={pw}")
        else:
            print(f"EXISTS   {u['email']:30s} role={u['role']:12s}")

print("\nAll users:")
for u in User.objects.all().order_by("role", "email"):
    print(f"  {u.email:30s} {u.role:12s} active={u.is_active} staff={u.is_staff}")
