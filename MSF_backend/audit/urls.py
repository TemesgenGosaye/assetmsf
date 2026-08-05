"""
URL configuration for audit app.
"""
from django.urls import path
from .views import (
    AuditSessionListView, AuditSessionDetailView,
    start_audit_session, end_audit_session, create_audit_session,
    AuditAssignmentListView, AuditScanListView, AuditInchargeListView,
)

urlpatterns = [
    # Frontend-compatible routes (must be registered before generic <id> routes)
    path('sessions/', AuditSessionListView.as_view(), name='audit_session_list_compat'),
    path('sessions/start/', create_audit_session, name='audit_session_create_compat'),
    path('sessions/<str:id>/', AuditSessionDetailView.as_view(), name='audit_session_detail_compat'),
    path('sessions/<str:id>/end/', end_audit_session, name='audit_session_end_compat'),
    path('sessions/<str:id>/start/', start_audit_session, name='audit_session_start_compat'),
    # Legacy routes
    path('', AuditSessionListView.as_view(), name='audit_session_list'),
    path('<str:id>/', AuditSessionDetailView.as_view(), name='audit_session_detail'),
    path('<str:id>/start/', start_audit_session, name='audit_session_start'),
    path('<str:id>/end/', end_audit_session, name='audit_session_end'),
    path('<str:session_id>/assignments/', AuditAssignmentListView.as_view(), name='audit_assignment_list'),
    path('<str:session_id>/scans/', AuditScanListView.as_view(), name='audit_scan_list'),
    path('<str:session_id>/incharges/', AuditInchargeListView.as_view(), name='audit_incharge_list'),
]
