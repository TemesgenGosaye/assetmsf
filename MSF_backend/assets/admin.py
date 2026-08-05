"""
Admin configuration for assets app.
"""
from django.contrib import admin
from .models import Asset, AssetAttachment


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    """Admin interface for Asset model."""
    list_display = ['asset_code', 'name', 'property', 'department', 'status', 'condition', 'is_active']
    list_filter = ['status', 'condition', 'category', 'property', 'department']
    search_fields = ['asset_code', 'name', 'serial_number', 'barcode']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']


@admin.register(AssetAttachment)
class AssetAttachmentAdmin(admin.ModelAdmin):
    """Admin interface for AssetAttachment model."""
    list_display = ['asset', 'file_name', 'file_type', 'uploaded_by']
    list_filter = ['file_type']
    search_fields = ['file_name', 'asset__name']
