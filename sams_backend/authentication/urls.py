"""
URL configuration for authentication app.
"""
from django.urls import path
from .views import (
    CustomTokenObtainPairView, register, current_user, update_current_user,
    change_password, logout, UserListView, UserDetailView,
    UserSettingsView, UserPermissionListView, UserPropertyAccessListView,
    UserDepartmentAccessListView, password_reset_request, password_reset_verify,
    verify_password, verify_superuser
)

urlpatterns = [
    # Authentication
    path('login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('register/', register, name='register'),
    path('logout/', logout, name='logout'),
    path('me/', current_user, name='current_user'),
    path('me/update/', update_current_user, name='update_current_user'),
    path('change-password/', change_password, name='change_password'),
    path('verify-password/', verify_password, name='verify_password'),
    path('verify-superuser/', verify_superuser, name='verify_superuser'),
    
    # Password Reset
    path('password-reset/request/', password_reset_request, name='password_reset_request'),
    path('password-reset/verify/', password_reset_verify, name='password_reset_verify'),
    
    # User Management
    path('users/', UserListView.as_view(), name='user_list'),
    path('users/<int:id>/', UserDetailView.as_view(), name='user_detail'),
    
    # User Settings
    path('settings/', UserSettingsView.as_view(), name='user_settings'),
    
    # User Permissions
    path('users/<int:user_id>/permissions/', UserPermissionListView.as_view(), name='user_permissions'),
    path('users/<int:user_id>/properties/', UserPropertyAccessListView.as_view(), name='user_property_access'),
    path('users/<int:user_id>/departments/', UserDepartmentAccessListView.as_view(), name='user_department_access'),
]
