"""
URL configuration for dashboard app.
"""
from django.urls import path
from .views import (
    RecentActivityListView, log_activity, SystemSettingsView,
    PropertyLicenseListView, PropertyLicenseDetailView, LicenseMetaView
)

urlpatterns = [
    path('activity/', RecentActivityListView.as_view(), name='activity_list'),
    path('activity/log/', log_activity, name='activity_log'),
    path('settings/', SystemSettingsView.as_view(), name='system_settings'),
    path('licenses/', PropertyLicenseListView.as_view(), name='license_list'),
    path('licenses/<str:property_id>/', PropertyLicenseDetailView.as_view(), name='license_detail'),
    path('license-meta/<str:key>/', LicenseMetaView.as_view(), name='license_meta'),
]
