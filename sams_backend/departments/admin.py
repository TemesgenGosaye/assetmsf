"""
Admin configuration for departments app.
"""
from django.contrib import admin
from .models import Department


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    """Admin interface for Department model."""
    list_display = ['name', 'code', 'parent', 'head', 'is_active']
    list_filter = ['is_active']
    search_fields = ['name', 'code', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']
