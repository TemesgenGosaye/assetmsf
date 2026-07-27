import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

users_to_create = [
    {
        'email': 'superadmin@msf.org',
        'password': 'SuperAdmin@2025',
        'name': 'Super Admin',
        'role': 'SUPER_ADMIN',
        'is_staff': True,
        'is_superuser': True
    },
    {
        'email': 'admin@demo.com',
        'password': 'admin123',
        'name': 'Admin User',
        'role': 'ADMIN',
        'is_staff': True,
        'is_superuser': False
    },
    {
        'email': 'test@demo.com',
        'password': 'demo123',
        'name': 'Test User',
        'role': 'FIELD_STAFF',
        'is_staff': False,
        'is_superuser': False
    },
    {
        'email': 'applicant@metaharasugar.gov.et',
        'password': 'applicant123',
        'name': 'Applicant User',
        'role': 'APPLICANT',
        'is_staff': False,
        'is_superuser': False
    },
    {
        'email': 'tsegaye@admin.com',
        'password': 'admin123',
        'name': 'Tsegaye Mokonen',
        'role': 'ADMIN',
        'is_staff': True,
        'is_superuser': False
    }
]

print("Seeding test users...")
for udata in users_to_create:
    email = udata['email']
    try:
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'name': udata['name'],
                'role': udata['role'],
                'is_staff': udata['is_staff'],
                'is_superuser': udata['is_superuser'],
                'status': 'active'
            }
        )
        if created:
            user.set_password(udata['password'])
            user.save()
            print(f"Created user: {email} with role {udata['role']}")
        else:
            # Update password and info to ensure it matches credentials
            user.set_password(udata['password'])
            user.name = udata['name']
            user.role = udata['role']
            user.is_staff = udata['is_staff']
            user.is_superuser = udata['is_superuser']
            user.status = 'active'
            user.save()
            print(f"Updated existing user: {email}")
    except Exception as e:
        print(f"Error for user {email}: {e}")

print("Seeding complete!")
