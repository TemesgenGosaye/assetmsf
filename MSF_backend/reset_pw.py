import os, sys
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings.development'
import django; django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
default_pw = 'admin123'
for u in User.objects.all():
    u.set_password(default_pw)
    u.save(update_fields=['password'])
print('All users reset to password: admin123')
for u in User.objects.all():
    ok = u.check_password(default_pw)
    print(f'  {u.email} ({u.role}): check={ok}')
