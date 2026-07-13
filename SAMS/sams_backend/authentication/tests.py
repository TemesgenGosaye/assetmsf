"""
Tests for password reset functionality.
"""
from django.test import TestCase
from django.utils import timezone
from django.core import mail
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from authentication.models import PasswordResetOTP

User = get_user_model()


class PasswordResetTests(TestCase):
    """Test cases for password reset functionality."""
    
    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        
        # Create test user
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpassword123',
            name='Test User'
        )
    
    def test_password_reset_request_success(self):
        """Test successful OTP request."""
        response = self.client.post(
            '/api/auth/password-reset/request/',
            {'email': 'test@example.com'},
            format='json'
        )
        
        self.assertEqual(response.status_code, 200)
        
        # Check that OTP was created
        otp = PasswordResetOTP.objects.filter(user=self.user).latest('created_at')
        self.assertIsNotNone(otp)
        self.assertFalse(otp.is_used)
        self.assertEqual(len(otp.otp), 6)
        
        # Check that email was sent
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('MSF — Password Reset Code', mail.outbox[0].subject)
        self.assertIn(otp.otp, mail.outbox[0].body)
    
    def test_password_reset_request_nonexistent_email(self):
        """Test OTP request for nonexistent email returns success (security)."""
        response = self.client.post(
            '/api/auth/password-reset/request/',
            {'email': 'nonexistent@example.com'},
            format='json'
        )
        
        self.assertEqual(response.status_code, 200)
        
        # No OTP should be created
        self.assertEqual(PasswordResetOTP.objects.count(), 0)
        
        # No email should be sent
        self.assertEqual(len(mail.outbox), 0)
    
    def test_password_reset_verify_success(self):
        """Test successful password reset with valid OTP."""
        # Create OTP
        otp = PasswordResetOTP.objects.create(
            user=self.user,
            otp='123456'
        )
        
        # Test password reset
        response = self.client.post(
            '/api/auth/password-reset/verify/',
            {
                'email': 'test@example.com',
                'otp': '123456',
                'new_password': 'newtestpassword123'
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, 200)
        
        # Check that OTP was marked as used
        otp.refresh_from_db()
        self.assertTrue(otp.is_used)
        
        # Check that password was changed
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('newtestpassword123'))
    
    def test_password_reset_verify_invalid_otp(self):
        """Test password reset with invalid OTP."""
        # Create OTP
        PasswordResetOTP.objects.create(
            user=self.user,
            otp='123456'
        )
        
        # Test with wrong OTP
        response = self.client.post(
            '/api/auth/password-reset/verify/',
            {
                'email': 'test@example.com',
                'otp': '999999',
                'new_password': 'newtestpassword123'
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, 400)
        
        # Check that password was not changed
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('testpassword123'))
    
    def test_password_reset_verify_expired_otp(self):
        """Test password reset with expired OTP."""
        # Create expired OTP
        otp = PasswordResetOTP.objects.create(
            user=self.user,
            otp='123456'
        )
        otp.created_at = timezone.now() - timezone.timedelta(minutes=11)
        otp.save(update_fields=['created_at'])
        
        # Test
        response = self.client.post(
            '/api/auth/password-reset/verify/',
            {
                'email': 'test@example.com',
                'otp': '123456',
                'new_password': 'newtestpassword123'
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, 400)
        
        # Check that password was not changed
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('testpassword123'))
    
    def test_password_reset_rate_limiting(self):
        """Test that rate limiting works (max 3 requests per hour)."""
        # Make 3 requests
        for i in range(3):
            response = self.client.post(
                '/api/auth/password-reset/request/',
                {'email': 'test@example.com'},
                format='json'
            )
            self.assertEqual(response.status_code, 200)
        
        # 4th request should be rate limited
        response = self.client.post(
            '/api/auth/password-reset/request/',
            {'email': 'test@example.com'},
            format='json'
        )
        
        self.assertEqual(response.status_code, 429)
