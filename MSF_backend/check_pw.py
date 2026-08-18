import os, sys
sys.path.insert(0, r'F:\MetaharaSugarFactory Asset and House\MetaharaSugarFactory Asset and House\MSF_backend')
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings.development'
import django; django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
for email in ['superadmin@msf.org', 'admin@demo.com', 'temesgen@msf.com', 'biniam@msf.com']:
    try:
        u = User.objects.get(email=email)
        pw_admin123 = u.check_password('admin123')
        pw_super = u.check_password('SuperAdmin@2025')
        print(f'{email}: admin123={pw_admin123} SuperAdmin@2025={pw_super} active={u.is_active} status={u.status}')
    except Exception as e:
        print(f'{email}: ERROR {e}')

# Force set all passwords
print('\nForce-setting passwords...')
for email, pw in [('superadmin@msf.org', 'SuperAdmin@2025'), ('admin@demo.com', 'admin123'), ('temesgen@msf.com', 'admin123'), ('biniam@msf.com', 'admin123')]:
    try:
        u = User.objects.get(email=email)
        u.set_password(pw)
        u.save()
        u.refresh_from_db()
        print(f'{email}: now check_password={u.check_password(pw)}')
    except Exception as e:
        print(f'{email}: ERROR {e}')
