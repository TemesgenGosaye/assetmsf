"""
Serializers for category and item type management.
"""
from rest_framework import serializers
from .models import Category, ItemType


class CategorySerializer(serializers.ModelSerializer):
    """Serializer for Category model."""
    parent_name = serializers.CharField(source='parent.name', read_only=True, allow_null=True)
    
    class Meta:
        model = Category
        fields = [
            'id', 'name', 'code', 'description', 'parent', 'parent_name',
            'icon', 'color', 'created_at', 'updated_at', 'is_active'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_active']


class CategoryCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating categories."""
    
    class Meta:
        model = Category
        fields = ['name', 'code', 'description', 'parent', 'icon', 'color']


class ItemTypeSerializer(serializers.ModelSerializer):
    """Serializer for ItemType model."""
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    
    class Meta:
        model = ItemType
        fields = [
            'id', 'name', 'category', 'category_name', 'description',
            'default_depreciation_rate', 'default_warranty_period',
            'created_at', 'updated_at', 'is_active'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_active']


class ItemTypeCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating item types."""
    
    class Meta:
        model = ItemType
        fields = [
            'name', 'category', 'description',
            'default_depreciation_rate', 'default_warranty_period'
        ]
