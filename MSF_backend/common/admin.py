"""
Admin configuration for common app.
"""
from django.contrib import admin
from .models import QRCode, Vendor


@admin.register(QRCode)
class QRCodeAdmin(admin.ModelAdmin):
    """Admin interface for QRCode model."""
    list_display = ['asset_id', 'asset_name', 'property', 'generated_date', 'status', 'printed']
    list_filter = ['status', 'printed']
    search_fields = ['asset_id', 'asset_name']
    readonly_fields = ['created_at']


@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    """Admin interface for Vendor model."""
    list_display = ['name', 'code', 'status', 'city', 'state']
    list_filter = ['status']
    search_fields = ['name', 'code', 'contact_person', 'email']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']
