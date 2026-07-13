"""
Admin configuration for properties app.
"""
from django.contrib import admin
from .models import Property


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    """Admin interface for Property model."""
    list_display = ['id', 'name', 'type', 'city', 'state', 'status', 'manager', 'is_active']
    list_filter = ['status', 'city', 'state']
    search_fields = ['name', 'address', 'city']
    readonly_fields = ['created_at', 'updated_at', 'created_by', 'updated_by']
