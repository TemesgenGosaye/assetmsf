import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from django.contrib.auth import authenticate
from authentication.models import User

test_email = "tsegaye@msf.com"
test_password = "admin12345"

print(f"Testing authentication for: {test_email}")
print(f"Password: {test_password}")
print()

# Test 1: Direct authentication
print("Test 1: Django authenticate()")
user = authenticate(username=test_email, password=test_password)
if user:
    print(f"✓ Authentication successful!")
    print(f"  User: {user.email}")
    print(f"  Role: {user.role}")
    print(f"  is_active: {user.is_active}")
else:
    print(f"✗ Authentication failed!")

print()

# Test 2: Manual password check
print("Test 2: Manual password check")
try:
    user_obj = User.objects.get(email__iexact=test_email)
    is_valid = user_obj.check_password(test_password)
    print(f"✓ User found: {user_obj.email}")
    print(f"  Password valid: {is_valid}")
    print(f"  is_active: {user_obj.is_active}")
    print(f"  status: {user_obj.status}")
except User.DoesNotExist:
    print("✗ User not found")
