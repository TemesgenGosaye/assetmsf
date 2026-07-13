"""
Admin configuration for notifications app.
"""
from django.contrib import admin
from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Admin interface for Notification model."""
    list_display = ['user', 'title', 'type', 'read', 'created_at']
    list_filter = ['type', 'read']
    search_fields = ['title', 'message']
    readonly_fields = ['created_at']
