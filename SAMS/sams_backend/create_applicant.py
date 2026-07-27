import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from authentication.models import User

try:
    if User.objects.filter(email='applicant@metaharasugar.gov.et').exists():
        print("Applicant user already exists.")
    else:
        applicant = User.objects.create_user(
            email='applicant@metaharasugar.gov.et',
            password='applicant123',
            name='Applicant User',
            role='APPLICANT',
            status='active'
        )
        print(f"Applicant user created successfully: {applicant.email}")
        print(f"Role: {applicant.role}")
        print(f"Status: {applicant.status}")
except Exception as e:
    print(f"Error creating applicant: {e}")
