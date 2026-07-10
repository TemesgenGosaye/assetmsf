"""
URL configuration for notifications app.
"""
from django.urls import path
from .views import NotificationListView, NotificationDetailView, mark_all_read, clear_all_notifications

urlpatterns = [
    path('', NotificationListView.as_view(), name='notification_list'),
    path('<uuid:id>/', NotificationDetailView.as_view(), name='notification_detail'),
    path('mark-all-read/', mark_all_read, name='notification_mark_all_read'),
    path('clear-all/', clear_all_notifications, name='notification_clear_all'),
    path('clear/', clear_all_notifications, name='notification_clear'),
    path('role/', clear_all_notifications, name='notification_role'),
]
