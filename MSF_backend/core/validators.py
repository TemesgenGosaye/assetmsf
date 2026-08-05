"""
Custom validators for models and serializers.
"""
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
import re


class AssetCodeValidator:
    """Validator for asset codes."""
    
    def __call__(self, value):
        if not value:
            return
        
        # Asset code should be in format: AST-XXXXX or similar
        pattern = r'^[A-Z]{3}-\d{5,}$'
        if not re.match(pattern, value):
            raise ValidationError(
                _('Asset code must be in format XXX-XXXXX (e.g., AST-00001).'),
                code='invalid_asset_code'
            )


class EmailValidator:
    """Custom email validator."""
    
    def __call__(self, value):
        if not value:
            return
        
        # Basic email validation
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, value):
            raise ValidationError(
                _('Enter a valid email address.'),
                code='invalid_email'
            )


class PhoneValidator:
    """Validator for phone numbers."""
    
    def __call__(self, value):
        if not value:
            return
        
        # Remove all non-digit characters
        digits = re.sub(r'[^\d]', '', value)
        
        # Phone number should have 10-15 digits
        if len(digits) < 10 or len(digits) > 15:
            raise ValidationError(
                _('Phone number must have 10-15 digits.'),
                code='invalid_phone'
            )


class PasswordValidator:
    """Validator for password strength."""
    
    def __call__(self, value):
        if not value:
            return
        
        if len(value) < 8:
            raise ValidationError(
                _('Password must be at least 8 characters long.'),
                code='password_too_short'
            )
        
        if not re.search(r'[A-Z]', value):
            raise ValidationError(
                _('Password must contain at least one uppercase letter.'),
                code='password_no_uppercase'
            )
        
        if not re.search(r'[a-z]', value):
            raise ValidationError(
                _('Password must contain at least one lowercase letter.'),
                code='password_no_lowercase'
            )
        
        if not re.search(r'\d', value):
            raise ValidationError(
                _('Password must contain at least one digit.'),
                code='password_no_digit'
            )
        
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', value):
            raise ValidationError(
                _('Password must contain at least one special character.'),
                code='password_no_special'
            )


class URLValidator:
    """Validator for URLs."""
    
    def __call__(self, value):
        if not value:
            return
        
        pattern = r'^https?://[^\s/$.?#].[^\s]*$'
        if not re.match(pattern, value):
            raise ValidationError(
                _('Enter a valid URL.'),
                code='invalid_url'
            )
