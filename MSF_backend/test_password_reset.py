"""
Test script to debug password reset request
"""
import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from authentication.views import password_reset_request
from django.test import RequestFactory
import json

factory = RequestFactory()
request = factory.post(
    '/api/auth/password-reset/request/',
    json.dumps({'email': 'applicant@metaharasugar.gov.et'}),
    content_type='application/json'
)

try:
    response = password_reset_request(request)
    print('Status:', response.status_code)
    print('Data:', response.data)
except Exception as e:
    print('Error:', str(e))
    import traceback
    traceback.print_exc()
