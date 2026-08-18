
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
import django
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
for u in User.objects.all():
    if u.email == 'superadmin@msf.org':
        u.set_password('SuperAdmin@2025')
    else:
        u.set_password('admin123')
    u.save(update_fields=['password'])
print('ALL passwords reset')
import os as _os; _os._exit(0)
