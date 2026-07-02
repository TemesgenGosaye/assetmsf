"""
Views for department management.
"""
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from core.responses import StandardResponse
from core.permissions import IsAdminOrManager
from .serializers import DepartmentSerializer, DepartmentCreateSerializer, DepartmentUpdateSerializer
from .models import Department


class DepartmentListView(generics.ListCreateAPIView):
    """List and create departments."""
    queryset = Department.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        """Return appropriate serializer based on request method."""
        if self.request.method == 'POST':
            return DepartmentCreateSerializer
        return DepartmentSerializer
    
    def get_queryset(self):
        """Filter queryset based on user permissions."""
        user = self.request.user
        if user.is_super_admin() or user.is_admin():
            return Department.objects.filter(is_active=True)
        # Non-admin users can only see their own department
        if user.department:
            return Department.objects.filter(is_active=True, name=user.department)
        return Department.objects.none()
    
    def list(self, request, *args, **kwargs):
        """List departments with standard response format."""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Departments retrieved successfully")
    
    def create(self, request, *args, **kwargs):
        """Create department with standard response format."""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return StandardResponse.created(
                DepartmentSerializer(serializer.instance).data,
                "Department created successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class DepartmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a department."""
    queryset = Department.objects.filter(is_active=True)
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    lookup_field = 'id'
    
    def retrieve(self, request, *args, **kwargs):
        """Retrieve department with standard response format."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return StandardResponse.success(serializer.data, "Department retrieved successfully")
    
    def update(self, request, *args, **kwargs):
        """Update department with standard response format."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = DepartmentUpdateSerializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return StandardResponse.success(
                DepartmentSerializer(serializer.instance).data,
                "Department updated successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)
    
    def destroy(self, request, *args, **kwargs):
        """Soft delete department."""
        instance = self.get_object()
        instance.soft_delete(request.user)
        return StandardResponse.no_content("Department deleted successfully")
