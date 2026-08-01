"""
Production Settings for SAMS Backend.
"""
import os
from .base import *

# Override for production
DEBUG = False

# Security — Vercel handles SSL at the edge, so don't redirect here
# (SECURE_SSL_REDIRECT=True causes redirect loops on Vercel serverless)
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Allowed hosts
if not ALLOWED_HOSTS or ALLOWED_HOSTS == ['']:
    ALLOWED_HOSTS = ['*']

# CORS — explicit whitelist in production
_cors_origins_env = os.environ.get(
    'CORS_ALLOWED_ORIGINS',
    'https://sams-house-management.vercel.app'
)
CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors_origins_env.split(',') if o.strip()]
CORS_ALLOW_ALL_ORIGINS = False  # Explicit list only in production
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# Email backend for production
EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')

# Logging configuration (Console-only for serverless Vercel, File + Console for server/VM)
IS_VERCEL = os.environ.get('VERCEL') == '1' or 'VERCEL' in os.environ

_verbose_format = '{levelname} {asctime} {module} {message}{exc_info}'

if IS_VERCEL:
    LOGGING = {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'verbose': {
                'format': _verbose_format,
                'style': '{',
            },
        },
        'handlers': {
            'console': {
                'class': 'logging.StreamHandler',
                'formatter': 'verbose',
            },
        },
        'root': {
            'handlers': ['console'],
            'level': os.environ.get('LOG_LEVEL', 'INFO'),
        },
    }
else:
    (BASE_DIR / 'logs').mkdir(exist_ok=True)
    LOGGING = {
        **LOGGING,
        'formatters': {
            **LOGGING.get('formatters', {}),
            'verbose': {
                'format': _verbose_format,
                'style': '{',
            },
        },
        'handlers': {
            'console': {
                'class': 'logging.StreamHandler',
                'formatter': 'verbose',
            },
            'file': {
                'class': 'logging.handlers.RotatingFileHandler',
                'filename': BASE_DIR / 'logs' / 'django.log',
                'maxBytes': 1024 * 1024 * 10,  # 10 MB
                'backupCount': 10,
                'formatter': 'verbose',
            },
        },
        'root': {
            'handlers': ['console', 'file'],
            'level': os.environ.get('LOG_LEVEL', 'WARNING'),
        },
    }

# Rate limiting
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour',
    },
}
