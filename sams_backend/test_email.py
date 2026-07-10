"""
Test script to verify email configuration.
Run this to check if email sending is working correctly.
"""
import os
import django
import sys

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.core.mail import send_mail
from django.conf import settings

def test_email_config():
    """Test email configuration by sending a test email."""
    print("=" * 60)
    print("Email Configuration Test")
    print("=" * 60)
    
    # Display current email settings
    print(f"\nEmail Backend: {settings.EMAIL_BACKEND}")
    print(f"Email Host: {settings.EMAIL_HOST}")
    print(f"Email Port: {settings.EMAIL_PORT}")
    print(f"Email Use TLS: {settings.EMAIL_USE_TLS}")
    print(f"Default From Email: {settings.DEFAULT_FROM_EMAIL}")
    print(f"Email User: {settings.EMAIL_HOST_USER}")
    
    # Check if using console backend
    if 'console' in settings.EMAIL_BACKEND:
        print("\n⚠️  WARNING: Using console backend - emails will be printed to console only")
        print("   Update EMAIL_BACKEND in .env for real email sending")
    
    # Ask for test email
    test_email = input("\nEnter email address to send test email (or press Enter to skip): ").strip()
    
    if not test_email:
        print("\nTest skipped.")
        return
    
    try:
        print(f"\nSending test email to {test_email}...")
        
        subject = "SAMS Email Configuration Test"
        message = """
        This is a test email from the SAMS (Smart Asset Management System).
        
        If you received this email, your email configuration is working correctly!
        
        Metahara Sugar Factory
        Oromia, Ethiopia
        """
        
        html_message = """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Email Test</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: #f5f5f5; padding: 20px; border-radius: 8px; }
                .header { background: #0B4F2F; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: white; padding: 20px; border-radius: 0 0 8px 8px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Email Configuration Test</h1>
                </div>
                <div class="content">
                    <p>This is a test email from the SAMS (Smart Asset Management System).</p>
                    <p><strong>If you received this email, your email configuration is working correctly!</strong></p>
                    <p>Metahara Sugar Factory<br>Oromia, Ethiopia</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        send_mail(
            subject=subject,
            message=message,
            html_message=html_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[test_email],
            fail_silently=False
        )
        
        print("✅ Email sent successfully!")
        print(f"   Please check {test_email} inbox (and spam folder)")
        
    except Exception as e:
        print(f"❌ Failed to send email: {str(e)}")
        print("\nTroubleshooting tips:")
        print("1. Check EMAIL_HOST_USER and EMAIL_HOST_PASSWORD in .env")
        print("2. For Gmail, use an App Password (not your regular password)")
        print("3. Ensure 2FA is enabled on your Google account")
        print("4. Check if your firewall allows SMTP traffic (port 587)")
        print("5. See EMAIL_SETUP.md for detailed instructions")

if __name__ == "__main__":
    test_email_config()
