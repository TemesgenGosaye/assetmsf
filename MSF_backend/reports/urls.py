"""
URL configuration for reports app.
"""
from django.urls import path
from .views import ReportListView, ReportDetailView, clear_reports

urlpatterns = [
    path('', ReportListView.as_view(), name='report_list'),
    path('<uuid:id>/', ReportDetailView.as_view(), name='report_detail'),
    path('clear-all/', clear_reports, name='report_clear_all'),
]
