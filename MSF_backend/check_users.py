import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from authentication.models import User

users = User.objects.all()
print(f'Total users: {users.count()}')
for u in users:
    print(f'ID: {u.id}, Email: {u.email}, Status: {u.status}, is_active: {u.is_active}, Role: {u.role}')
