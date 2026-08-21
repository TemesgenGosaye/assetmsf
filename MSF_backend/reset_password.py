import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from authentication.models import User

email = "tsegaye@msf.com"
new_password = "admin12345"

try:
    user = User.objects.get(email__iexact=email)
    user.set_password(new_password)
    user.save()
    print(f"✓ Password reset successfully for {email}")
    print(f"  User ID: {user.id}")
    print(f"  Name: {user.name}")
    print(f"  Role: {user.role}")
    print(f"  New password: {new_password}")
except User.DoesNotExist:
    print(f"✗ User not found: {email}")
