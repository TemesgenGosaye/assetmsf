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
from common.views import health_check
from authentication.views import (
    list_permissions, set_permissions,
    user_preferences,
    list_user_access, set_user_access,
    list_user_dept_access, set_user_dept_access
)

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),

    # API Documentation
    # path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    # path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    # path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Health Check
    path('api/health/', health_check, name='health_check'),

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
    
    # Frontend-compatible user management endpoints
    path('api/permissions/', list_permissions, name='list_permissions'),
    path('api/permissions/set/', set_permissions, name='set_permissions'),
    path('api/preferences/<str:user_id>/', user_preferences, name='user_preferences'),
    path('api/user-access/', list_user_access, name='list_user_access'),
    path('api/user-access/set/', set_user_access, name='set_user_access'),
    path('api/user-dept-access/', list_user_dept_access, name='list_user_dept_access'),
    path('api/user-dept-access/set/', set_user_dept_access, name='set_user_dept_access'),
]
