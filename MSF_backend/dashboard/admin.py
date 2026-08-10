"""
Admin configuration for dashboard app.
"""
from django.contrib import admin
from .models import RecentActivity, SystemSettings


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
