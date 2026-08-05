"""
Admin configuration for requests app.
"""
from django.contrib import admin
from .models import ApprovalRequest, ApprovalEvent


@admin.register(ApprovalRequest)
class ApprovalRequestAdmin(admin.ModelAdmin):
    """Admin interface for ApprovalRequest model."""
    list_display = ['id', 'request_type', 'title', 'requester', 'status', 'current_approver']
    list_filter = ['request_type', 'status']
    search_fields = ['title', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']


@admin.register(ApprovalEvent)
class ApprovalEventAdmin(admin.ModelAdmin):
    """Admin interface for ApprovalEvent model."""
    list_display = ['approval', 'action', 'actor', 'created_at']
    list_filter = ['action']
    search_fields = ['notes']
