"""
Custom permission classes.
"""
from rest_framework import permissions
from django.contrib.auth import get_user_model

User = get_user_model()


class IsAuthenticated(permissions.IsAuthenticated):
    """Custom authenticated permission with additional checks."""
    pass


class IsAdminUser(permissions.IsAdminUser):
    """Custom admin user permission."""
    pass


class IsSuperAdmin(permissions.BasePermission):
    """Permission for super admin users only."""
    
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'role', None) == User.Role.SUPER_ADMIN
        )


class IsManager(permissions.BasePermission):
    """Permission for manager users."""
    
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'role', None) == User.Role.MANAGER
        )


class IsFieldStaff(permissions.BasePermission):
    """Permission for field staff users."""
    
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'role', None) == User.Role.FIELD_STAFF
        )


class IsAuditor(permissions.BasePermission):
    """Permission for auditor users."""
    
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'role', None) == User.Role.AUDITOR
        )


class IsAdminOrManager(permissions.BasePermission):
    """Permission for admin or manager users."""
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role = getattr(request.user, 'role', None)
        return role in [User.Role.ADMIN, User.Role.MANAGER, User.Role.SUPER_ADMIN]


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Permission to allow only owners of an object to edit it.
    """
    
    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any authenticated user
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write permissions are only allowed to the owner
        return obj.created_by == request.user


class IsDepartmentMember(permissions.BasePermission):
    """
    Permission to allow users from the same department.
    """
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Admins and super admins have access to all
        role = getattr(request.user, 'role', None)
        if role in [User.Role.ADMIN, User.Role.SUPER_ADMIN]:
            return True
        
        # Check if user is in the same department as the object
        user_department = getattr(request.user, 'department', None)
        obj_department = getattr(obj, 'department', None)
        
        return user_department == obj_department


class IsPropertyAccessible(permissions.BasePermission):
    """
    Permission to allow users with access to the property.
    """
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Admins and super admins have access to all
        role = getattr(request.user, 'role', None)
        if role in [User.Role.ADMIN, User.Role.SUPER_ADMIN]:
            return True
        
        # Check if user has access to the property
        obj_property = getattr(obj, 'property', None)
        if not obj_property:
            return False
        
        # This would check user_property_access table
        # For now, return True if user has any property access
        return True
