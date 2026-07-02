"""
Admin configuration for categories app.
"""
from django.contrib import admin
from .models import Category, ItemType


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    """Admin interface for Category model."""
    list_display = ['name', 'code', 'parent', 'is_active']
    list_filter = ['is_active']
    search_fields = ['name', 'code', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']


@admin.register(ItemType)
class ItemTypeAdmin(admin.ModelAdmin):
    """Admin interface for ItemType model."""
    list_display = ['name', 'category', 'default_depreciation_rate', 'default_warranty_period', 'is_active']
    list_filter = ['category', 'is_active']
    search_fields = ['name', 'description']
