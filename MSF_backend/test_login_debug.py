import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from django.contrib.auth import authenticate
from authentication.models import User

# Test with a known user
test_email = "admin@demo.com"
test_password = "password"  # You'll need to provide the actual password

print(f"Testing login for: {test_email}")
print(f"Attempting authentication...")

user = authenticate(username=test_email, password=test_password)

if user:
    print(f"✓ Authentication successful!")
    print(f"  User ID: {user.id}")
    print(f"  Email: {user.email}")
    print(f"  Role: {user.role}")
    print(f"  Status: {user.status}")
    print(f"  is_active: {user.is_active}")
else:
    print(f"✗ Authentication failed!")
    print("Trying manual password check...")
    try:
        user_obj = User.objects.get(email__iexact=test_email)
        print(f"  User found: {user_obj.email}")
        print(f"  Checking password...")
        is_valid = user_obj.check_password(test_password)
        print(f"  Password valid: {is_valid}")
    except User.DoesNotExist:
        print("  User not found in database")
