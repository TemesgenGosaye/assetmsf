"""
Admin configuration for assets app.
"""
from django.contrib import admin
from .models import Asset, AssetAttachment, AssetLifecycleEvent


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


@admin.register(AssetLifecycleEvent)
class AssetLifecycleEventAdmin(admin.ModelAdmin):
    """Admin interface for the asset lifecycle audit trail."""
    list_display = ['asset', 'event_type', 'actor_name', 'message', 'occurred_at']
    list_filter = ['event_type', 'occurred_at']
    search_fields = ['asset__asset_code', 'asset__name', 'actor_name', 'message']
    readonly_fields = [f.name for f in AssetLifecycleEvent._meta.fields]
