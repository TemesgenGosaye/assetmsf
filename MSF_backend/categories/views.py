"""
Views for category and item type management.
"""
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from core.responses import StandardResponse
from core.permissions import IsAdminOrManager
from .serializers import CategorySerializer, CategoryCreateSerializer, ItemTypeSerializer, ItemTypeCreateSerializer
from .models import Category, ItemType


class CategoryListView(generics.ListCreateAPIView):
    """List and create categories."""
    queryset = Category.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        """Return appropriate serializer based on request method."""
        if self.request.method == 'POST':
            return CategoryCreateSerializer
        return CategorySerializer
    
    def list(self, request, *args, **kwargs):
        """List categories with standard response format."""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Categories retrieved successfully")
    
    def create(self, request, *args, **kwargs):
        """Create category with standard response format."""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return StandardResponse.created(
                CategorySerializer(serializer.instance).data,
                "Category created successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a category."""
    queryset = Category.objects.filter(is_active=True)
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    lookup_field = 'id'
    
    def retrieve(self, request, *args, **kwargs):
        """Retrieve category with standard response format."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return StandardResponse.success(serializer.data, "Category retrieved successfully")
    
    def update(self, request, *args, **kwargs):
        """Update category with standard response format."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = CategoryCreateSerializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return StandardResponse.success(
                CategorySerializer(serializer.instance).data,
                "Category updated successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)
    
    def destroy(self, request, *args, **kwargs):
        """Soft delete category."""
        instance = self.get_object()
        instance.soft_delete(request.user)
        return StandardResponse.no_content("Category deleted successfully")


class ItemTypeListView(generics.ListCreateAPIView):
    """List and create item types."""
    queryset = ItemType.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        """Return appropriate serializer based on request method."""
        if self.request.method == 'POST':
            return ItemTypeCreateSerializer
        return ItemTypeSerializer
    
    def list(self, request, *args, **kwargs):
        """List item types with standard response format."""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Item types retrieved successfully")
    
    def create(self, request, *args, **kwargs):
        """Create item type with standard response format."""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return StandardResponse.created(
                ItemTypeSerializer(serializer.instance).data,
                "Item type created successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class ItemTypeDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete an item type."""
    queryset = ItemType.objects.filter(is_active=True)
    serializer_class = ItemTypeSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    lookup_field = 'id'
    
    def retrieve(self, request, *args, **kwargs):
        """Retrieve item type with standard response format."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return StandardResponse.success(serializer.data, "Item type retrieved successfully")
    
    def update(self, request, *args, **kwargs):
        """Update item type with standard response format."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = ItemTypeCreateSerializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return StandardResponse.success(
                ItemTypeSerializer(serializer.instance).data,
                "Item type updated successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)
    
    def destroy(self, request, *args, **kwargs):
        """Soft delete item type."""
        instance = self.get_object()
        instance.soft_delete(request.user)
        return StandardResponse.no_content("Item type deleted successfully")
