"""
URL configuration for dashboard app.
"""
from django.urls import path
from .views import (
    RecentActivityListView, log_activity, SystemSettingsView
)

urlpatterns = [
    path('activity/', RecentActivityListView.as_view(), name='activity_list'),
    path('activity/log/', log_activity, name='activity_log'),
    path('settings/', SystemSettingsView.as_view(), name='system_settings'),
]
