"""
Serializers for authentication and user management.
"""
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import get_user_model
from .models import User, UserSettings, UserPermission, UserPropertyAccess, UserDepartmentAccess, FinalApprover

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""
    profile_image = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'name', 'phone', 'department', 'role', 'status',
            'profile_image', 'email_notifications', 'dark_mode',
            'must_change_password',
            'created_at', 'updated_at', 'is_active'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_active']


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating users."""
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True, required=True)
    role = serializers.CharField(required=False, default='FIELD_STAFF')
    status = serializers.CharField(required=False, default='active')

    class Meta:
        model = User
        fields = [
            'email', 'name', 'phone', 'department', 'role', 'status',
            'password', 'password_confirm', 'email_notifications', 'dark_mode',
            'must_change_password'
        ]

    def validate_status(self, value):
        """Normalize status to lowercase to match backend choices."""
        normalized = value.lower().strip()
        valid = {c[0] for c in User.Status.choices}
        if normalized not in valid:
            raise serializers.ValidationError(f'"{value}" is not a valid choice.')
        return normalized

    def validate_role(self, value):
        """Normalize role to UPPERCASE to match backend choices."""
        normalized = value.upper().replace(' ', '_').strip()
        valid = {c[0] for c in User.Role.choices}
        if normalized not in valid:
            raise serializers.ValidationError(f'"{value}" is not a valid choice.')
        return normalized

    def validate(self, attrs):
        """Validate that passwords match."""
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs

    def create(self, validated_data):
        """Create user with hashed password."""
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user = User.objects.create_user(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating users."""
    status = serializers.CharField(required=False)
    
    class Meta:
        model = User
        fields = [
            'name', 'phone', 'department', 'status', 'profile_image',
            'email_notifications', 'dark_mode', 'must_change_password'
        ]

    def validate_status(self, value):
        """Normalize status to lowercase to match backend choices."""
        if not value:
            return value
        normalized = value.lower().strip()
        valid = {c[0] for c in User.Status.choices}
        if normalized not in valid:
            raise serializers.ValidationError(f'"{value}" is not a valid choice.')
        return normalized


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for changing password."""
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(required=True)

    def validate(self, attrs):
        """Validate that new passwords match."""
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({"new_password": "Password fields didn't match."})
        return attrs

    def validate_old_password(self, value):
        """Validate old password."""
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value


class LoginSerializer(serializers.Serializer):
    """Serializer for login."""
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True)


class UserSettingsSerializer(serializers.ModelSerializer):
    """Serializer for user settings."""
    
    class Meta:
        model = UserSettings
        fields = [
            'id', 'notifications', 'email_notifications', 'notification_types',
            'dark_mode', 'dashboard_prefs'
        ]
        read_only_fields = ['id']


class UserPermissionSerializer(serializers.ModelSerializer):
    """Serializer for user permissions."""
    
    class Meta:
        model = UserPermission
        fields = ['id', 'page', 'can_view', 'can_edit']
        read_only_fields = ['id']


class UserPropertyAccessSerializer(serializers.ModelSerializer):
    """Serializer for user property access."""
    
    class Meta:
        model = UserPropertyAccess
        fields = ['id', 'property_id']
        read_only_fields = ['id']


class UserDepartmentAccessSerializer(serializers.ModelSerializer):
    """Serializer for user department access."""
    
    class Meta:
        model = UserDepartmentAccess
        fields = ['id', 'department']
        read_only_fields = ['id']


class FinalApproverSerializer(serializers.ModelSerializer):
    """Serializer for FinalApprover model."""
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = FinalApprover
        fields = ['property_id', 'user_id', 'user_name']
        read_only_fields = ['user_name']

    def get_user_name(self, obj):
        return obj.user.name if obj.user else None
