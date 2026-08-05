"""
Serializers for department management.
"""
from rest_framework import serializers
from .models import Department


class DepartmentSerializer(serializers.ModelSerializer):
    """Serializer for Department model."""
    hierarchy = serializers.SerializerMethodField()
    parent_name = serializers.CharField(source='parent.name', read_only=True, allow_null=True)
    head_name = serializers.CharField(source='head.name', read_only=True, allow_null=True)
    head_email = serializers.CharField(source='head.email', read_only=True, allow_null=True)
    
    class Meta:
        model = Department
        fields = [
            'id', 'name', 'code', 'description', 'parent', 'parent_name',
            'head', 'head_name', 'head_email', 'location', 'contact_email',
            'contact_phone', 'hierarchy', 'created_at', 'updated_at', 'is_active'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_active']
    
    def get_hierarchy(self, obj):
        """Get the full hierarchy path."""
        return obj.get_hierarchy()


class DepartmentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating departments."""
    
    class Meta:
        model = Department
        fields = [
            'name', 'code', 'description', 'parent', 'head',
            'location', 'contact_email', 'contact_phone'
        ]


class DepartmentUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating departments."""
    
    class Meta:
        model = Department
        fields = [
            'name', 'description', 'parent', 'head',
            'location', 'contact_email', 'contact_phone'
        ]
