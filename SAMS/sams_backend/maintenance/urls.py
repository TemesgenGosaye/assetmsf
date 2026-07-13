"""
URL configuration for maintenance app.
"""
from django.urls import path
from .views import (
    MaintenanceTicketListView, MaintenanceTicketDetailView,
    TicketEventListView, TicketAttachmentListView,
    MaintenanceScheduleListView, MaintenanceScheduleDetailView
)

urlpatterns = [
    path('', MaintenanceTicketListView.as_view(), name='ticket_list'),
    path('<uuid:id>/', MaintenanceTicketDetailView.as_view(), name='ticket_detail'),
    path('<uuid:ticket_id>/events/', TicketEventListView.as_view(), name='ticket_event_list'),
    path('<uuid:ticket_id>/attachments/', TicketAttachmentListView.as_view(), name='ticket_attachment_list'),
    path('schedules/', MaintenanceScheduleListView.as_view(), name='schedule_list'),
    path('schedules/<uuid:id>/', MaintenanceScheduleDetailView.as_view(), name='schedule_detail'),
]
