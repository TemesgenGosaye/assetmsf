"""
URL Configuration for SAMS Backend.
"""
from django.contrib import admin
from django.urls import path, include
# from drf_spectacular.views import (
#     SpectacularAPIView,
#     SpectacularRedocView,
#     SpectacularSwaggerView,
# )
from common.views import health_check, root_api_view, setup_database_view
from authentication.views import (
    list_permissions, set_permissions,
    user_preferences,
    list_user_access, set_user_access,
    list_user_dept_access, set_user_dept_access,
    get_final_approver, list_final_approvers,
    set_final_approver_props_for_user,
    set_final_approver_by_email,
    CompatUserSettingsView,
)
from dashboard.views import RecentActivityListView, log_activity, SystemSettingsView
from common.views import QRCodeListView, QRCodeDetailView, delete_all_qr_codes

urlpatterns = [
    # Root & Health Check
    path('', root_api_view, name='root_api'),
    path('api/', root_api_view, name='api_root'),
    path('api/health/', health_check, name='health_check'),

    # Ops / one-time database setup (protected by SETUP_KEY)
    path('api/setup-database/', setup_database_view, name='setup_database'),

    # Admin
    path('admin/', admin.site.urls),

    # API endpoints
    path('api/auth/', include('authentication.urls')),
    path('api/users/', include('users.urls')),
    path('api/departments/', include('departments.urls')),
    path('api/properties/', include('properties.urls')),
    path('api/assets/', include('assets.urls')),
    path('api/categories/', include('categories.urls')),
    path('api/maintenance/', include('maintenance.urls')),
    path('api/requests/', include('requests.urls')),
    path('api/inventory/', include('inventory.urls')),
    path('api/vendors/', include('vendors.urls')),
    path('api/procurement/', include('procurement.urls')),
    path('api/notifications/', include('notifications.urls')),
    path('api/audit/', include('audit.urls')),
    path('api/reports/', include('reports.urls')),
    path('api/dashboard/', include('dashboard.urls')),
    path('api/common/', include('common.urls')),
    path('api/employees/', include('employees.urls')),
    path('api/houses/',   include('houses.urls')),
    path('api/newsletter/', include('newsletter.urls')),
    
    # Additional paths for frontend compatibility
    path('api/approvals/', include('requests.urls')),
    path('api/tickets/', include('maintenance.urls')),
    path('api/item-types/', include('categories.urls')),
    path('api/categories/item-types/', include('categories.urls')),
    
    # Frontend-compatible user management endpoints
    path('api/permissions/', list_permissions, name='list_permissions'),
    path('api/permissions/set/', set_permissions, name='set_permissions'),
    path('api/preferences/<str:user_id>/', user_preferences, name='user_preferences'),
    path('api/user-access/', list_user_access, name='list_user_access'),
    path('api/user-access/set/', set_user_access, name='set_user_access'),
    path('api/user-dept-access/', list_user_dept_access, name='list_user_dept_access'),
    path('api/user-dept-access/set/', set_user_dept_access, name='set_user_dept_access'),
    
    # Frontend-compatible settings endpoints
    path('api/settings/system/', SystemSettingsView.as_view(), name='compat_system_settings'),
    path('api/settings/user/<str:user_id>/', CompatUserSettingsView.as_view(), name='compat_user_settings'),
    
    # Frontend-compatible activity endpoints
    path('api/activity/', RecentActivityListView.as_view(), name='compat_activity_list'),
    path('api/activity/log/', log_activity, name='compat_activity_log'),
    
    # Frontend-compatible QR code endpoints
    path('api/qr-codes/', QRCodeListView.as_view(), name='compat_qr_code_list'),
    path('api/qr-codes/<uuid:id>/', QRCodeDetailView.as_view(), name='compat_qr_code_detail'),
    path('api/qr-codes/delete-all/', delete_all_qr_codes, name='compat_qr_code_delete_all'),
    path('api/qr-codes/clear/', delete_all_qr_codes, name='compat_qr_code_clear'),
    
    # Frontend-compatible final approver endpoints
    path('api/final-approvers/', list_final_approvers, name='compat_final_approver_list'),
    path('api/final-approvers/<str:property_id>/', get_final_approver, name='compat_final_approver_detail'),
    path('api/final-approvers/set/', set_final_approver_props_for_user, name='compat_final_approver_set'),
    path('api/final-approvers/set-by-email/', set_final_approver_by_email, name='compat_final_approver_set_email'),
]
