"""
Admin configuration for authentication app.
"""
from django.contrib import admin
from .models import User, UserSettings, UserPermission, UserPropertyAccess, UserDepartmentAccess, FinalApprover, PasswordResetOTP


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    """Admin interface for User model."""
    list_display = ['email', 'name', 'role', 'status', 'department', 'is_active', 'created_at']
    list_filter = ['role', 'status', 'is_active']
    search_fields = ['email', 'name', 'department']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(UserSettings)
class UserSettingsAdmin(admin.ModelAdmin):
    """Admin interface for UserSettings model."""
    list_display = ['user', 'notifications', 'email_notifications', 'dark_mode']
    list_filter = ['notifications', 'email_notifications', 'dark_mode']
    search_fields = ['user__email']


@admin.register(UserPermission)
class UserPermissionAdmin(admin.ModelAdmin):
    """Admin interface for UserPermission model."""
    list_display = ['user', 'page', 'can_view', 'can_edit']
    list_filter = ['page', 'can_view', 'can_edit']
    search_fields = ['user__email']


@admin.register(UserPropertyAccess)
class UserPropertyAccessAdmin(admin.ModelAdmin):
    """Admin interface for UserPropertyAccess model."""
    list_display = ['user', 'property_id']
    list_filter = ['property_id']
    search_fields = ['user__email', 'property_id']


@admin.register(UserDepartmentAccess)
class UserDepartmentAccessAdmin(admin.ModelAdmin):
    """Admin interface for UserDepartmentAccess model."""
    list_display = ['user', 'department']
    list_filter = ['department']
    search_fields = ['user__email', 'department']


@admin.register(FinalApprover)
class FinalApproverAdmin(admin.ModelAdmin):
    """Admin interface for FinalApprover model."""
    list_display = ['property_id', 'user']
    search_fields = ['property_id', 'user__email']


@admin.register(PasswordResetOTP)
class PasswordResetOTPAdmin(admin.ModelAdmin):
    """Admin interface for PasswordResetOTP model."""
    list_display = ['user', 'otp', 'created_at', 'is_used']
    list_filter = ['is_used', 'created_at']
    search_fields = ['user__email']
    readonly_fields = ['id', 'created_at']
    date_hierarchy = 'created_at'
