"""
Utility functions for the SAMS backend.
"""
from django.utils import timezone
from datetime import datetime, timedelta
import pytz


def get_current_time():
    """Get current time in UTC."""
    return timezone.now()


def convert_to_utc(dt):
    """Convert a datetime to UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = pytz.utc.localize(dt)
    return dt.astimezone(pytz.utc)


def get_time_diff(start, end):
    """Get the difference between two datetimes."""
    if start is None or end is None:
        return None
    return end - start


def format_duration(timedelta_obj):
    """Format a timedelta object into a human-readable string."""
    if timedelta_obj is None:
        return "0 minutes"
    
    total_seconds = int(timedelta_obj.total_seconds())
    days = total_seconds // 86400
    hours = (total_seconds % 86400) // 3600
    minutes = (total_seconds % 3600) // 60
    
    parts = []
    if days > 0:
        parts.append(f"{days} day{'s' if days != 1 else ''}")
    if hours > 0:
        parts.append(f"{hours} hour{'s' if hours != 1 else ''}")
    if minutes > 0 or not parts:
        parts.append(f"{minutes} minute{'s' if minutes != 1 else ''}")
    
    return ", ".join(parts)


def generate_asset_code(prefix='AST', sequence=1):
    """Generate an asset code with prefix and sequence number."""
    return f"{prefix}-{str(sequence).zfill(5)}"


def normalize_email(email):
    """Normalize email address."""
    if not email:
        return None
    return email.strip().lower()


def normalize_phone(phone):
    """Normalize phone number."""
    if not phone:
        return None
    # Remove all non-digit characters
    return ''.join(filter(str.isdigit, phone))


def truncate_string(text, max_length=50):
    """Truncate a string to max_length and add ellipsis if needed."""
    if not text:
        return ""
    if len(text) <= max_length:
        return text
    return text[:max_length - 3] + "..."


def get_client_ip(request):
    """Get the client IP address from the request."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def get_user_agent(request):
    """Get the user agent from the request."""
    return request.META.get('HTTP_USER_AGENT', '')


def chunk_list(lst, chunk_size):
    """Split a list into chunks of specified size."""
    for i in range(0, len(lst), chunk_size):
        yield lst[i:i + chunk_size]
