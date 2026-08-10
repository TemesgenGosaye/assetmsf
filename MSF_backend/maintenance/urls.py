"""
URL configuration for maintenance app.
"""
from django.urls import path
from .views import (
    MaintenanceTicketListView, MaintenanceTicketDetailView,
    TicketEventListView, TicketAttachmentListView,
    MaintenanceScheduleListView, MaintenanceScheduleDetailView,
    MaintenanceScheduleActionView, MaintenanceAnalyticsView,
)

urlpatterns = [
    path('', MaintenanceTicketListView.as_view(), name='ticket_list'),
    path('<uuid:id>/', MaintenanceTicketDetailView.as_view(), name='ticket_detail'),
    path('<uuid:ticket_id>/events/', TicketEventListView.as_view(), name='ticket_event_list'),
    path('<uuid:ticket_id>/attachments/', TicketAttachmentListView.as_view(), name='ticket_attachment_list'),
    path('schedules/', MaintenanceScheduleListView.as_view(), name='schedule_list'),
    path('schedules/<uuid:id>/', MaintenanceScheduleDetailView.as_view(), name='schedule_detail'),
    path('schedules/<uuid:id>/perform/', MaintenanceScheduleActionView.as_view(), name='schedule_perform'),
    path('analytics/', MaintenanceAnalyticsView.as_view(), name='maintenance_analytics'),
]
