"""
Admin configuration for reports app.
"""
from django.contrib import admin
from .models import Report


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    """Admin interface for Report model."""
    list_display = ['name', 'type', 'format', 'status', 'created_by_name', 'created_at']
    list_filter = ['type', 'format', 'status']
    search_fields = ['name']
    readonly_fields = ['created_at', 'updated_at', 'created_by', 'updated_by']
