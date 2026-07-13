"""
Development Settings for SAMS Backend.
"""
from .base import *

# Override for development
DEBUG = True

# Allow all hosts in development
ALLOWED_HOSTS = ['*']

# Disable security headers in development
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False

# Show detailed error pages
DEBUG_PROPAGATE_EXCEPTIONS = True

# Email backend for development (console)
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Disable throttling in development
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    'DEFAULT_THROTTLE_CLASSES': [],
    'DEFAULT_THROTTLE_RATES': {},
}
