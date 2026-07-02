
import os
import django
import traceback

# Setup Django first
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from django.test import RequestFactory
from django.contrib.auth import get_user_model, authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from core.responses import StandardResponse
from authentication.serializers import UserSerializer

User = get_user_model()

# Test 1: Check our test user exists
print("Checking if test user exists...")
user = None
try:
    user = User.objects.get(email='test@demo.com')
    print(f"User found: {user.email}, name: {user.name}, role: {user.role}")
    print(f"User is active: {user.is_active}")
    print(f"Checking password 'demo123': {user.check_password('demo123')}")
except User.DoesNotExist:
    print("User not found")

# Test each step
if user:
    print("\nTesting authenticate...")
    try:
        factory = RequestFactory()
        req = factory.post('/api/auth/login/', content_type='application/json')
        auth_result = authenticate(req, username='test@demo.com', password='demo123')
        print(f"authenticate result: {auth_result}")
    except Exception as e:
        print("authenticate error:")
        traceback.print_exc()

    print("\nTesting RefreshToken...")
    try:
        refresh = RefreshToken.for_user(user)
        print(f"Refresh token: {refresh}")
        print(f"Access token: {refresh.access_token}")
    except Exception as e:
        print("RefreshToken error:")
        traceback.print_exc()

    print("\nTesting UserSerializer...")
    try:
        serialized = UserSerializer(user)
        print(f"Serialized data: {serialized.data}")
    except Exception as e:
        print("UserSerializer error:")
        traceback.print_exc()

    print("\nTesting get_client_ip...")
    try:
        factory = RequestFactory()
        req = factory.post('/api/auth/login/')
        print(f"REMOTE_ADDR: {req.META.get('REMOTE_ADDR')}")
    except Exception as e:
        print("get_client_ip error:")
        traceback.print_exc()

    print("\nTesting user.save()...")
    try:
        user.last_login_ip = '127.0.0.1'
        user.last_login_user_agent = 'test'
        user.save(update_fields=['last_login_ip', 'last_login_user_agent'])
        print("save succeeded")
    except Exception as e:
        print("user.save error:")
        traceback.print_exc()
