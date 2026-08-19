"""
Views for department management.
"""
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from core.responses import StandardResponse
from core.permissions import IsAdminOrManager
from .serializers import (
    DepartmentSerializer,
    DepartmentCreateSerializer,
    DepartmentUpdateSerializer,
    DepartmentTreeSerializer,
)
from .models import Department


class DepartmentListView(generics.ListCreateAPIView):
    """List and create departments."""
    queryset = Department.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return DepartmentCreateSerializer
        return DepartmentSerializer

    def get_queryset(self):
        qs = Department.objects.filter(is_active=True)
        user = self.request.user

        # Non-admin users see only their own department
        if not (user.is_super_admin() or user.is_admin()):
            if user.department:
                qs = qs.filter(name=user.department)
            else:
                return Department.objects.none()

        # Optional query-param filters
        level = self.request.query_params.get('level')
        if level is not None:
            qs = qs.filter(level=level)

        parent = self.request.query_params.get('parent')
        if parent is not None:
            qs = qs.filter(parent_id=parent) if parent else qs.filter(parent__isnull=True)

        root_only = self.request.query_params.get('root_only')
        if root_only == 'true':
            qs = qs.filter(parent__isnull=True)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(name__icontains=search) | qs.filter(code__icontains=search)

        return qs.order_by('sort_order', 'name')

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Departments retrieved successfully")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            dept = serializer.save(created_by=request.user)
            # Auto-compute level from parent
            if dept.parent_id:
                dept.level = dept.parent.level + 1
                dept.save(update_fields=['level'])
            return StandardResponse.created(
                DepartmentSerializer(dept).data,
                "Department created successfully",
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class DepartmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a department."""
    queryset = Department.objects.filter(is_active=True)
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    lookup_field = 'id'

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return StandardResponse.success(serializer.data, "Department retrieved successfully")

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = DepartmentUpdateSerializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            dept = serializer.save(updated_by=request.user)
            # Recompute level if parent changed
            if 'parent' in request.data:
                dept.level = dept.parent.level + 1 if dept.parent_id else 0
                dept.save(update_fields=['level'])
            return StandardResponse.success(
                DepartmentSerializer(dept).data,
                "Department updated successfully",
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.soft_delete(request.user)
        return StandardResponse.no_content("Department deleted successfully")


class DepartmentTreeView(APIView):
    """
    GET /api/departments/tree/
    Returns the full department hierarchy as a nested tree.
    Top-level departments have their children nested inline.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        roots = Department.objects.filter(
            is_active=True, parent__isnull=True
        ).order_by('sort_order', 'name')
        tree = DepartmentTreeSerializer(roots, many=True).data
        return StandardResponse.success(tree, "Department tree retrieved successfully")
