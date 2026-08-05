"""
Admin configuration for maintenance app.
"""
from django.contrib import admin
from .models import MaintenanceTicket, TicketEvent, TicketAttachment, MaintenanceSchedule


@admin.register(MaintenanceTicket)
class MaintenanceTicketAdmin(admin.ModelAdmin):
    """Admin interface for MaintenanceTicket model."""
    list_display = ['id', 'title', 'asset', 'status', 'priority', 'assigned_to', 'due_date']
    list_filter = ['status', 'priority', 'assigned_to']
    search_fields = ['title', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']


@admin.register(TicketEvent)
class TicketEventAdmin(admin.ModelAdmin):
    """Admin interface for TicketEvent model."""
    list_display = ['ticket', 'event_type', 'created_at']
    list_filter = ['event_type']
    search_fields = ['message']
    readonly_fields = ['created_at']


@admin.register(TicketAttachment)
class TicketAttachmentAdmin(admin.ModelAdmin):
    """Admin interface for TicketAttachment model."""
    list_display = ['ticket', 'file_name', 'file_type', 'uploaded_by']
    list_filter = ['file_type']
    search_fields = ['file_name']


@admin.register(MaintenanceSchedule)
class MaintenanceScheduleAdmin(admin.ModelAdmin):
    """Admin interface for MaintenanceSchedule model."""
    list_display = ['asset', 'name', 'frequency', 'next_due', 'is_active']
    list_filter = ['frequency', 'is_active']
    search_fields = ['name', 'description']
