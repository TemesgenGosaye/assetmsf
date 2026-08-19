"""
Admin configuration for departments app.
"""
from django.contrib import admin
from .models import Department


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    """Admin interface for Department model."""
    list_display = ['code', 'name', 'level', 'parent', 'sort_order', 'head', 'is_active']
    list_filter = ['is_active', 'level']
    search_fields = ['name', 'code', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']
    list_editable = ['sort_order', 'is_active']
    ordering = ['sort_order', 'name']
    list_per_page = 50

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('parent', 'head')
