"""
Views for authentication and user management.
"""
from rest_framework import status, generics
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
    UserPermissionSerializer, UserPropertyAccessSerializer, UserDepartmentAccessSerializer
)
from .models import UserSettings, UserPermission, UserPropertyAccess, UserDepartmentAccess, PasswordResetOTP


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
    
    def post(self, request, *args, **kwargs):
        """Handle login with email-based authentication."""
        # Handle email-based authentication
        email = request.data.get('email')
        password = request.data.get('password')
        
        # Debug logging
        print(f"DEBUG: Login attempt - Email: {email}, Password: {'*' * len(password) if password else 'None'}")
        print(f"DEBUG: Request data: {request.data}")
        
        if not email or not password:
            return StandardResponse.bad_request("Email and password are required")
        
        # Authenticate using email
        from django.contrib.auth import authenticate
        user = authenticate(request, username=email, password=password)
        
        print(f"DEBUG: Auth result: {user}")
        
        if not user:
            # Fallback: try to get user by email and check password manually
            try:
                user_obj = User.objects.get(email__iexact=email)
                print(f"DEBUG: Found user by email: {user_obj.email}")
                print(f"DEBUG: Password check: {user_obj.check_password(password)}")
                if user_obj.check_password(password):
                    user = user_obj
                else:
                    return StandardResponse.unauthorized("Invalid credentials")
            except User.DoesNotExist:
                print(f"DEBUG: User not found for email: {email}")
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
        """Create user with default settings."""
        serializer = UserCreateSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            UserSettings.objects.create(user=user)
            return StandardResponse.created(
                UserSerializer(user).data,
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
@permission_classes([AllowAny])
def password_reset_request(request):
    """
    Request a password reset OTP to be sent to the user's email.
    """
    email = request.data.get('email')
    if not email:
        return StandardResponse.bad_request("Email is required")
    
    try:
        user = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        return StandardResponse.success(
            None,
            "If this email exists, a code has been sent"
        )
    
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
    
    # Send email
    subject = "MSF — Password Reset Code"
    message = f"""
    Your password reset code is: {otp_code}
    
    This code will expire in 10 minutes.
    
    If you didn't request this, you can safely ignore this email.
    """
    
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False
        )
    except Exception as e:
        # Don't expose email sending errors to client
        pass
    
    return StandardResponse.success(
        None,
        "If this email exists, a code has been sent"
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
