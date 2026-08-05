# Email Configuration for Password Reset

The password reset functionality requires a working email configuration to send verification codes to users. Follow these steps to set up email sending.

## Gmail SMTP Configuration (Recommended)

### 1. Enable 2-Factor Authentication
- Go to your Google Account settings
- Enable 2-Factor Authentication (2FA)

### 2. Generate App Password
- Go to Google Account > Security
- Select "App passwords" under 2-Step Verification
- Create a new app password with name "SAMS Backend"
- Copy the generated password (16 characters)

### 3. Update Environment Variables
Edit the `.env` file in the backend directory:

```env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-16-char-app-password
EMAIL_PORT=587
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=noreply@metaharasugar.gov.et
```

**Replace:**
- `your-email@gmail.com` with your Gmail address
- `your-16-char-app-password` with the app password you generated
- `noreply@metaharasugar.gov.et` with your desired from email

## Alternative SMTP Providers

### Outlook/Office 365
```env
EMAIL_HOST=smtp.office365.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
```

### SendGrid
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=your-sendgrid-api-key
```

### Amazon SES
```env
EMAIL_HOST=email-smtp.us-east-1.amazonaws.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-aws-access-key
EMAIL_HOST_PASSWORD=your-aws-secret-key
```

## Testing Email Configuration

After updating the `.env` file, restart the Django server and test the password reset functionality:

1. Go to the login page
2. Click "Forgot password?"
3. Enter a registered email address
4. Check your email inbox for the verification code

## Troubleshooting

### Email not sending
- Verify SMTP credentials are correct
- Check if your email provider requires app-specific passwords
- Ensure firewall allows SMTP traffic (port 587)
- Check Django logs for error messages

### Gmail authentication errors
- Make sure 2FA is enabled on your Google account
- Use an app password, not your regular password
- Check if "Less secure apps" is disabled (use app password instead)

### Rate limiting
- Gmail has sending limits (500 emails/day for free accounts)
- Consider using a transactional email service for production

## Production Considerations

For production deployment:
- Use a dedicated transactional email service (SendGrid, Mailgun, AWS SES)
- Set up email templates with proper branding
- Configure email logging and monitoring
- Set up bounce and complaint handling
- Use environment-specific email configurations

## Console Backend (Development Only)

For development without real email sending, you can use the console backend:

```env
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```

This will print email content to the console instead of sending real emails. **Do not use in production.**
