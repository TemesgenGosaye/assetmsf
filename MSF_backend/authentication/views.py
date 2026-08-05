"""
Views for authentication and user management.
"""
from rest_framework import status, generics
from django.shortcuts import render
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils import timezone
from core.responses import StandardResponse
from .serializers import (
    UserSerializer, UserCreateSerializer, UserUpdateSerializer,
    ChangePasswordSerializer, LoginSerializer, UserSettingsSerializer,
    UserPermissionSerializer, UserPropertyAccessSerializer, UserDepartmentAccessSerializer,
    FinalApproverSerializer
)
from .models import UserSettings, UserPermission, UserPropertyAccess, UserDepartmentAccess, PasswordResetOTP, FinalApprover


# ======================
# Permissions Views
# ======================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_permissions(request):
    """List permissions for a user (accepts user_id from query param or uses current user)."""
    user_id = request.query_params.get('user_id') or request.user.id
    permissions = UserPermission.objects.filter(user_id=user_id)
    serializer = UserPermissionSerializer(permissions, many=True)
    return StandardResponse.success(serializer.data, "Permissions retrieved successfully")


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def set_permissions(request):
    """Bulk set permissions for a user."""
    user_id = request.data.get('user_id')
    permissions_data = request.data.get('permissions', [])
    
    # Delete existing permissions for this user
    UserPermission.objects.filter(user_id=user_id).delete()
    
    # Create new permissions
    for perm in permissions_data:
        UserPermission.objects.create(
            user_id=user_id,
            page=perm['page'],
            can_view=perm.get('can_view', True),
            can_edit=perm.get('can_edit', False)
        )
    
    return StandardResponse.success(None, "Permissions set successfully")


# ======================
# User Preferences Views
# ======================
@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def user_preferences(request, user_id=None):
    """Get or update user preferences (stored in dashboard_prefs JSON field)."""
    # Get or create user settings
    user = request.user
    if user_id and (user.is_superuser or user.is_staff or str(user.id) == str(user_id)):
        user = User.objects.get(id=user_id)
    
    settings, created = UserSettings.objects.get_or_create(user=user)
    
    if request.method == 'GET':
        # Build preferences from dashboard_prefs
        prefs = settings.dashboard_prefs or {}
        default_prefs = {
            "user_id": str(user.id),
            "user_email": user.email,
            "show_newsletter": False,
            "show_help_center": True,
            "compact_mode": False,
            "enable_beta_features": False,
            "default_landing_page": None,
            "feature_flags": {},
            "sidebar_collapsed": False,
            "enable_sounds": True,
            "density": "comfortable",
            "auto_theme": False,
            "show_announcements": True,
            "sticky_header": False,
            "top_nav_mode": False,
            "created_at": settings.created_at.isoformat() if settings.created_at else None,
            "updated_at": settings.updated_at.isoformat() if settings.updated_at else None
        }
        # Merge defaults with stored prefs
        merged = {**default_prefs, **prefs}
        merged['user_id'] = str(user.id)
        merged['user_email'] = user.email
        return StandardResponse.success(merged, "Preferences retrieved successfully")
    
    elif request.method == 'PATCH':
        # Update preferences in dashboard_prefs
        patch = request.data
        current_prefs = settings.dashboard_prefs or {}
        current_prefs.update(patch)
        # Remove user_id and user_email from stored prefs (they are dynamic)
        current_prefs.pop('user_id', None)
        current_prefs.pop('user_email', None)
        current_prefs.pop('created_at', None)
        current_prefs.pop('updated_at', None)
        settings.dashboard_prefs = current_prefs
        settings.save()
        
        # Return merged prefs
        prefs = settings.dashboard_prefs or {}
        default_prefs = {
            "user_id": str(user.id),
            "user_email": user.email,
            "show_newsletter": False,
            "show_help_center": True,
            "compact_mode": False,
            "enable_beta_features": False,
            "default_landing_page": None,
            "feature_flags": {},
            "sidebar_collapsed": False,
            "enable_sounds": True,
            "density": "comfortable",
            "auto_theme": False,
            "show_announcements": True,
            "sticky_header": False,
            "top_nav_mode": False,
            "created_at": settings.created_at.isoformat() if settings.created_at else None,
            "updated_at": settings.updated_at.isoformat() if settings.updated_at else None
        }
        merged = {**default_prefs, **prefs}
        merged['user_id'] = str(user.id)
        merged['user_email'] = user.email
        return StandardResponse.success(merged, "Preferences updated successfully")


# ======================
# User Access Views
# ======================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_user_access(request):
    """List property access for a user (accepts user_id from query param or uses current user)."""
    user_id = request.query_params.get('user_id') or request.user.id
    access = UserPropertyAccess.objects.filter(user_id=user_id)
    serializer = UserPropertyAccessSerializer(access, many=True)
    return StandardResponse.success(serializer.data, "Property access retrieved successfully")


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def set_user_access(request):
    """Bulk set property access for a user."""
    user_id = request.data.get('user_id')
    property_ids = request.data.get('property_ids', [])
    
    # Delete existing access for this user
    UserPropertyAccess.objects.filter(user_id=user_id).delete()
    
    # Create new access entries
    for prop_id in property_ids:
        UserPropertyAccess.objects.create(
            user_id=user_id,
            property_id=str(prop_id)
        )
    
    return StandardResponse.success(None, "Property access set successfully")


# ======================
# User Department Access Views
# ======================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_user_dept_access(request):
    """List department access for a user (accepts user_id from query param or uses current user)."""
    user_id = request.query_params.get('user_id') or request.user.id
    access = UserDepartmentAccess.objects.filter(user_id=user_id)
    serializer = UserDepartmentAccessSerializer(access, many=True)
    return StandardResponse.success(serializer.data, "Department access retrieved successfully")


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def set_user_dept_access(request):
    """Bulk set department access for a user."""
    user_id = request.data.get('user_id')
    departments = request.data.get('departments', [])
    
    # Delete existing access for this user
    UserDepartmentAccess.objects.filter(user_id=user_id).delete()
    
    # Create new access entries
    for dept in departments:
        UserDepartmentAccess.objects.create(
            user_id=user_id,
            department=str(dept)
        )
    
    return StandardResponse.success(None, "Department access set successfully")

User = get_user_model()


class CustomTokenObtainPairView(generics.GenericAPIView):
    """Custom JWT token view with additional user data."""
    permission_classes = (AllowAny,)
    serializer_class = LoginSerializer
    
    def post(self, request, *args, **kwargs):
        """Handle login with email-based authentication."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data.get('email')
        password = serializer.validated_data.get('password')
        
        # Authenticate using email
        from django.contrib.auth import authenticate
        user = authenticate(request, username=email, password=password)
        
        if not user:
            # Fallback: try to get user by email and check password manually
            try:
                user_obj = User.objects.get(email__iexact=email)
                if user_obj.check_password(password):
                    user = user_obj
                else:
                    return StandardResponse.unauthorized("Invalid credentials")
            except User.DoesNotExist:
                return StandardResponse.unauthorized("Invalid credentials")
        
        if not user.is_active:
            return StandardResponse.bad_request("User account is disabled")
        
        refresh = RefreshToken.for_user(user)
        
        # Update user login info
        user.last_login_ip = self.get_client_ip(request)
        user.last_login_user_agent = request.META.get('HTTP_USER_AGENT', '')
        user.save(update_fields=['last_login_ip', 'last_login_user_agent'])
        
        data = {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': UserSerializer(user).data
        }
        
        return StandardResponse.success(data, "Login successful", status.HTTP_200_OK)
    
    def get_client_ip(self, request):
        """Get client IP address."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

# Internal login page (HTML form)
@api_view(['GET'])
@permission_classes([AllowAny])
def login_page(request):
    """Render the internal credential login page."""
    return render(request, 'authentication/login.html')


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """Register a new user."""
    serializer = UserCreateSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        # Create default settings
        UserSettings.objects.create(user=user)
        return StandardResponse.created(
            UserSerializer(user).data,
            "User registered successfully"
        )
    return StandardResponse.validation_error(
        "Validation failed",
        serializer.errors
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    """Get current user information."""
    serializer = UserSerializer(request.user)
    return StandardResponse.success(serializer.data, "User retrieved successfully")


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_current_user(request):
    """Update current user information."""
    serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return StandardResponse.success(
            serializer.data,
            "User updated successfully"
        )
    return StandardResponse.validation_error(
        "Validation failed",
        serializer.errors
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Change user password."""
    serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return StandardResponse.success(None, "Password changed successfully")
    return StandardResponse.validation_error(
        "Validation failed",
        serializer.errors
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """Logout user by blacklisting refresh token."""
    try:
        refresh_token = request.data.get('refresh_token')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
        return StandardResponse.success(None, "Logout successful")
    except Exception as e:
        return StandardResponse.bad_request("Logout failed", str(e))


class UserListView(generics.ListCreateAPIView):
    """List and create users (admin only)."""
    queryset = User.objects.filter(is_active=True)
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter queryset based on user role."""
        user = self.request.user
        if user.is_super_admin() or user.is_admin():
            return User.objects.filter(is_active=True)
        return User.objects.filter(id=user.id)
    
    def create(self, request, *args, **kwargs):
        """Create user with default settings. Only admins/superadmins can create users."""
        user = request.user
        if not (user.is_super_admin() or user.is_admin()):
            return StandardResponse.forbidden("Only admins can create users")
        serializer = UserCreateSerializer(data=request.data)
        if serializer.is_valid():
            new_user = serializer.save()
            UserSettings.objects.create(user=new_user)
            return StandardResponse.created(
                UserSerializer(new_user).data,
                "User created successfully"
            )
        return StandardResponse.validation_error(
            "Validation failed",
            serializer.errors
        )


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a user."""
    queryset = User.objects.filter(is_active=True)
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'
    
    def destroy(self, request, *args, **kwargs):
        """Soft delete user."""
        user = self.get_object()
        user.soft_delete(request.user)
        return StandardResponse.no_content("User deleted successfully")


class UserSettingsView(generics.RetrieveUpdateAPIView):
    """Retrieve or update user settings."""
    serializer_class = UserSettingsSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        """Get or create user settings."""
        settings, created = UserSettings.objects.get_or_create(
            user=self.request.user
        )
        return settings


class UserPermissionListView(generics.ListCreateAPIView):
    """List and create user permissions."""
    serializer_class = UserPermissionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Get permissions for the specified user."""
        user_id = self.kwargs.get('user_id')
        return UserPermission.objects.filter(user_id=user_id)
    
    def create(self, request, *args, **kwargs):
        """Create user permission."""
        user_id = self.kwargs.get('user_id')
        serializer = UserPermissionSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user_id=user_id)
            return StandardResponse.created(
                serializer.data,
                "Permission created successfully"
            )
        return StandardResponse.validation_error(
            "Validation failed",
            serializer.errors
        )


class UserPropertyAccessListView(generics.ListCreateAPIView):
    """List and create user property access."""
    serializer_class = UserPropertyAccessSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Get property access for the specified user."""
        user_id = self.kwargs.get('user_id')
        return UserPropertyAccess.objects.filter(user_id=user_id)
    
    def create(self, request, *args, **kwargs):
        """Create property access."""
        user_id = self.kwargs.get('user_id')
        serializer = UserPropertyAccessSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user_id=user_id)
            return StandardResponse.created(
                serializer.data,
                "Property access granted successfully"
            )
        return StandardResponse.validation_error(
            "Validation failed",
            serializer.errors
        )


class UserDepartmentAccessListView(generics.ListCreateAPIView):
    """List and create user department access."""
    serializer_class = UserDepartmentAccessSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Get department access for the specified user."""
        user_id = self.kwargs.get('user_id')
        return UserDepartmentAccess.objects.filter(user_id=user_id)
    
    def create(self, request, *args, **kwargs):
        """Create department access."""
        user_id = self.kwargs.get('user_id')
        serializer = UserDepartmentAccessSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user_id=user_id)
            return StandardResponse.created(
                serializer.data,
                "Department access granted successfully"
            )
        return StandardResponse.validation_error(
            "Validation failed",
            serializer.errors
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_password(request):
    """Verify the currently logged-in user's password. Used for CRUD confirmation dialogs."""
    password = request.data.get('password')
    if not password:
        return StandardResponse.bad_request("Password is required")
    if request.user.check_password(password):
        return StandardResponse.success({'valid': True}, "Password verified")
    return StandardResponse.error("Invalid password", None, status.HTTP_401_UNAUTHORIZED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_superuser(request):
    """
    Verify that the currently logged-in user is an admin/superuser by checking
    their password. Used to gate destructive CRUD operations in the UI.
    Only password is required — the user is already identified by the JWT token.
    """
    password = request.data.get('password')
    if not password:
        return StandardResponse.bad_request("Password is required")

    user = request.user

    # Must be admin or superuser
    if not (user.is_superuser or user.is_staff or user.role in ('ADMIN', 'SUPER_ADMIN')):
        return StandardResponse.error(
            "You do not have superuser privileges.",
            None,
            status.HTTP_403_FORBIDDEN
        )

    if user.check_password(password):
        return StandardResponse.success({'valid': True}, "Superuser verified")

    return StandardResponse.error("Incorrect password.", None, status.HTTP_401_UNAUTHORIZED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_set_password(request, user_id):
    """
    Admin endpoint to set a user's password without needing the old password.
    Requires admin/superadmin role.
    """
    requesting_user = request.user
    if not (requesting_user.is_super_admin() or requesting_user.is_admin()):
        return StandardResponse.forbidden("Only admins can set user passwords")

    new_password = request.data.get('new_password')
    if not new_password:
        return StandardResponse.bad_request("new_password is required")

    try:
        target_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return StandardResponse.not_found("User not found")

    try:
        validate_password(new_password, user=target_user)
    except ValidationError as e:
        return StandardResponse.validation_error("Invalid password", e.messages)

    target_user.set_password(new_password)
    target_user.save()

    return StandardResponse.success(None, "Password set successfully")


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_request(request):
    """
    Request a password reset OTP to be sent to the user's email.
    """
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Password reset request received. Data: {request.data}")
    
    email = request.data.get('email')
    if not email:
        return StandardResponse.bad_request("Email is required")
    
    try:
        user = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        return StandardResponse.not_found("No account found with this email address")
    
    # Rate limiting: max 3 requests per hour
    one_hour_ago = timezone.now() - timezone.timedelta(hours=1)
    recent_requests = PasswordResetOTP.objects.filter(
        user=user,
        created_at__gte=one_hour_ago
    ).count()
    
    if recent_requests >= 3:
        return StandardResponse.error(
            None,
            "Too many requests, please try again later",
            status.HTTP_429_TOO_MANY_REQUESTS
        )
    
    # Generate and save OTP
    otp_code = PasswordResetOTP.generate_otp()
    PasswordResetOTP.objects.create(
        user=user,
        otp=otp_code
    )
    
    # Send email with HTML template for professional appearance
    subject = "MSF — Password Reset Code"
    html_message = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
            body {{
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f5f5f5;
                margin: 0;
                padding: 20px;
            }}
            .container {{
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                overflow: hidden;
            }}
            .header {{
                background: linear-gradient(135deg, #0B4F2F 0%, #0E5A37 100%);
                color: white;
                padding: 30px;
                text-align: center;
            }}
            .header h1 {{
                margin: 0;
                font-size: 24px;
                font-weight: 600;
            }}
            .content {{
                padding: 40px 30px;
            }}
            .code {{
                background-color: #f8f9fa;
                border: 2px dashed #0B4F2F;
                border-radius: 8px;
                padding: 20px;
                text-align: center;
                font-size: 32px;
                font-weight: bold;
                color: #0B4F2F;
                letter-spacing: 5px;
                margin: 20px 0;
            }}
            .info {{
                color: #666;
                font-size: 14px;
                line-height: 1.6;
            }}
            .warning {{
                background-color: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 15px;
                margin-top: 20px;
                font-size: 13px;
                color: #856404;
            }}
            .footer {{
                background-color: #f8f9fa;
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #999;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Password Reset Request</h1>
            </div>
            <div class="content">
                <p class="info">Hello {user.name or 'User'},</p>
                <p class="info">You have requested to reset your password for the MSF Asset Management System. Use the verification code below to proceed:</p>
                
                <div class="code">{otp_code}</div>
                
                <p class="info"><strong>This code will expire in 10 minutes.</strong></p>
                <p class="info">If you didn't request this password reset, you can safely ignore this email.</p>
                
                <div class="warning">
                    <strong>Security Notice:</strong> Never share this code with anyone. MSF staff will never ask for your verification code.
                </div>
            </div>
            <div class="footer">
                <p>This is an automated message from MSF Asset Management System.</p>
                <p>Metahara Sugar Factory • Oromia, Ethiopia</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    text_message = f"""
    Your password reset code is: {otp_code}
    
    This code will expire in 10 minutes.
    
    If you didn't request this, you can safely ignore this email.
    
    Security Notice: Never share this code with anyone. MSF staff will never ask for your verification code.
    """
    
    try:
        send_mail(
            subject=subject,
            message=text_message,
            html_message=html_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False
        )
    except Exception as e:
        # Log the error but don't expose to client
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to send password reset email to {email}: {str(e)}")
        return StandardResponse.error(
            None,
            "Failed to send email. Please contact support.",
            status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    return StandardResponse.success(
        {'email': email},
        "Password reset code sent successfully"
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_verify(request):
    """
    Verify OTP and reset password.
    """
    email = request.data.get('email')
    otp = request.data.get('otp')
    new_password = request.data.get('new_password')
    
    if not email or not otp or not new_password:
        return StandardResponse.bad_request("Email, OTP, and new password are required")
    
    try:
        user = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        return StandardResponse.bad_request("Invalid code or email")
    
    # Find valid OTP
    try:
        otp_instance = PasswordResetOTP.objects.filter(
            user=user,
            otp=otp,
            is_used=False
        ).latest('created_at')
    except PasswordResetOTP.DoesNotExist:
        return StandardResponse.bad_request("Invalid code or email")
    
    # Check if OTP is valid
    if not otp_instance.is_valid():
        return StandardResponse.bad_request("Invalid code or email")
    
    # Validate password
    try:
        validate_password(new_password, user=user)
    except ValidationError as e:
        return StandardResponse.validation_error("Invalid password", e.messages)
    
    # Mark OTP as used
    otp_instance.is_used = True
    otp_instance.save(update_fields=['is_used'])
    
    # Reset password
    user.set_password(new_password)
    user.save()
    
    return StandardResponse.success(None, "Password reset successfully")


# ======================
# Final Approver Views (frontend compat)
# ======================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_final_approver(request, property_id):
    """Get final approver for a property."""
    try:
        fa = FinalApprover.objects.get(property_id=property_id)
        serializer = FinalApproverSerializer(fa)
        return StandardResponse.success(serializer.data, "Final approver retrieved successfully")
    except FinalApprover.DoesNotExist:
        return StandardResponse.success(None, "No final approver set")


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def list_final_approvers(request):
    """List final approvers or set a final approver for a property."""
    if request.method == 'POST':
        property_id = request.data.get('property_id')
        user_id = request.data.get('user_id')
        if not property_id or not user_id:
            return StandardResponse.bad_request("property_id and user_id are required")
        FinalApprover.objects.update_or_create(
            property_id=property_id,
            defaults={'user_id': user_id}
        )
        return StandardResponse.success(None, "Final approver set successfully")
    # GET
    user_id = request.query_params.get('user_id')
    email = request.query_params.get('email')
    qs = FinalApprover.objects.select_related('user').all()
    if user_id:
        qs = qs.filter(user_id=user_id)
    if email:
        qs = qs.filter(user__email=email)
    serializer = FinalApproverSerializer(qs, many=True)
    return StandardResponse.success(serializer.data, "Final approvers retrieved successfully")


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def set_final_approver_props_for_user(request):
    """Batch-set final approver properties for a user."""
    user_id = request.data.get('user_id')
    property_ids = request.data.get('property_ids', [])
    if not user_id:
        return StandardResponse.bad_request("user_id is required")
    FinalApprover.objects.filter(user_id=user_id).exclude(property_id__in=property_ids).delete()
    for pid in property_ids:
        FinalApprover.objects.update_or_create(
            property_id=pid,
            defaults={'user_id': user_id}
        )
    return StandardResponse.success(None, "Final approver properties set successfully")


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def set_final_approver_by_email(request):
    """Batch-set final approver properties by email."""
    email = request.data.get('email')
    user_name = request.data.get('user_name')
    property_ids = request.data.get('property_ids', [])
    if not email:
        return StandardResponse.bad_request("email is required")
    User = get_user_model()
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return StandardResponse.not_found("User with this email not found")
    FinalApprover.objects.filter(user=user).exclude(property_id__in=property_ids).delete()
    for pid in property_ids:
        FinalApprover.objects.update_or_create(
            property_id=pid,
            defaults={'user': user}
        )
    return StandardResponse.success(None, "Final approver properties set successfully")


# ======================
# User Settings Compat View (frontend compat)
# ======================
class CompatUserSettingsView(generics.RetrieveUpdateAPIView):
    """Retrieve or update user settings for a given user_id (frontend compat)."""
    serializer_class = UserSettingsSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        user_id = self.kwargs.get('user_id') or self.request.user.id
        settings, created = UserSettings.objects.get_or_create(
            user_id=user_id
        )
        return settings
