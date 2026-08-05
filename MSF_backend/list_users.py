"""
List all users with their credentials and roles
"""
import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from authentication.models import User

users = User.objects.all()
print('Available Users:')
print('=' * 80)
for u in users:
    print(f'Email: {u.email}')
    print(f'Name: {u.name}')
    print(f'Role: {u.role}')
    print(f'Status: {u.status}')
    print(f'Department: {u.department}')
    print('Password: applicant123 (for applicant) or check your records')
    print('-' * 80)
