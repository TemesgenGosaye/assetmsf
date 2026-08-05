import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from authentication.models import User

# Create an applicant user
try:
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
