"""
Admin configuration for dashboard app.
"""
from django.contrib import admin
from .models import RecentActivity, SystemSettings, PropertyLicense, LicenseMeta


@admin.register(RecentActivity)
class RecentActivityAdmin(admin.ModelAdmin):
    """Admin interface for RecentActivity model."""
    list_display = ['user', 'type', 'message', 'created_at']
    list_filter = ['type']
    search_fields = ['message']
    readonly_fields = ['created_at']


@admin.register(SystemSettings)
class SystemSettingsAdmin(admin.ModelAdmin):
    """Admin interface for SystemSettings model."""
    list_display = ['id', 'timezone', 'language', 'backup_frequency', 'auto_backup']
    readonly_fields = ['id']


@admin.register(PropertyLicense)
class PropertyLicenseAdmin(admin.ModelAdmin):
    """Admin interface for PropertyLicense model."""
    list_display = ['property_id', 'asset_limit', 'plan']
    list_filter = ['plan']
    search_fields = ['property_id']


@admin.register(LicenseMeta)
class LicenseMetaAdmin(admin.ModelAdmin):
    """Admin interface for LicenseMeta model."""
    list_display = ['key']
    search_fields = ['key']
