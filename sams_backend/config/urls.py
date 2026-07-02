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

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),

    # API Documentation
    # path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    # path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    # path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

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
]
