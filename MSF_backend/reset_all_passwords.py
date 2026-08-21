import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from authentication.models import User

admin_password = "admin12345"
user_password = "user12345"

users = User.objects.all()
print(f"Total users: {users.count()}")
print()

for user in users:
    if user.role in ['ADMIN', 'SUPER_ADMIN']:
        user.set_password(admin_password)
        user.save()
        print(f"✓ {user.email} (ADMIN) -> {admin_password}")
    else:
        user.set_password(user_password)
        user.save()
        print(f"✓ {user.email} ({user.role}) -> {user_password}")

print()
print("All passwords reset successfully!")
