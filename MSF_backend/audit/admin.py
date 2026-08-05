"""
Admin configuration for audit app.
"""
from django.contrib import admin
from .models import AuditSession, AuditAssignment, AuditReview, AuditReport, AuditIncharge, AuditScan


@admin.register(AuditSession)
class AuditSessionAdmin(admin.ModelAdmin):
    """Admin interface for AuditSession model."""
    list_display = ['id', 'name', 'property', 'status', 'frequency', 'scheduled_date']
    list_filter = ['status', 'frequency']
    search_fields = ['name', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']


@admin.register(AuditAssignment)
class AuditAssignmentAdmin(admin.ModelAdmin):
    """Admin interface for AuditAssignment model."""
    list_display = ['session', 'department', 'assigned_to', 'status']
    list_filter = ['status']
    search_fields = ['department']


@admin.register(AuditReview)
class AuditReviewAdmin(admin.ModelAdmin):
    """Admin interface for AuditReview model."""
    list_display = ['assignment', 'reviewer', 'assets_reviewed', 'verified_count', 'damaged_count']
    readonly_fields = ['submitted_at']


@admin.register(AuditReport)
class AuditReportAdmin(admin.ModelAdmin):
    """Admin interface for AuditReport model."""
    list_display = ['session', 'report_type', 'generated_by', 'generated_at']
    list_filter = ['report_type']
    readonly_fields = ['generated_at']


@admin.register(AuditIncharge)
class AuditInchargeAdmin(admin.ModelAdmin):
    """Admin interface for AuditIncharge model."""
    list_display = ['session', 'user', 'role']
    list_filter = ['role']


@admin.register(AuditScan)
class AuditScanAdmin(admin.ModelAdmin):
    """Admin interface for AuditScan model."""
    list_display = ['session', 'asset_id', 'department', 'status', 'scanned_by', 'scanned_at']
    list_filter = ['status']
    search_fields = ['asset_id']
    readonly_fields = ['scanned_at']
