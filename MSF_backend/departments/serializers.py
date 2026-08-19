"""
Serializers for department management.
"""
from rest_framework import serializers
from .models import Department


class DepartmentSerializer(serializers.ModelSerializer):
    """Full serializer for Department model — includes hierarchy metadata."""
    hierarchy = serializers.SerializerMethodField()
    parent_name = serializers.CharField(source='parent.name', read_only=True, allow_null=True)
    head_name = serializers.CharField(source='head.name', read_only=True, allow_null=True)
    head_email = serializers.CharField(source='head.email', read_only=True, allow_null=True)
    children_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Department
        fields = [
            'id', 'name', 'code', 'description',
            'parent', 'parent_name', 'level', 'sort_order',
            'head', 'head_name', 'head_email',
            'location', 'contact_email', 'contact_phone',
            'hierarchy', 'children_count',
            'created_at', 'updated_at', 'is_active',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_active', 'level', 'sort_order']

    def get_hierarchy(self, obj):
        """Get the full hierarchy path."""
        return obj.get_hierarchy()


class DepartmentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating departments."""

    class Meta:
        model = Department
        fields = [
            'name', 'code', 'description', 'parent', 'head',
            'location', 'contact_email', 'contact_phone', 'sort_order',
        ]


class DepartmentUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating departments."""

    class Meta:
        model = Department
        fields = [
            'name', 'description', 'parent', 'head',
            'location', 'contact_email', 'contact_phone', 'sort_order',
        ]


class DepartmentTreeSerializer(serializers.ModelSerializer):
    """
    Recursive serializer for building a full department tree.
    Each node includes its `children` nested inline.
    """
    children = serializers.SerializerMethodField()
    head_name = serializers.CharField(source='head.name', read_only=True, allow_null=True)

    class Meta:
        model = Department
        fields = [
            'id', 'name', 'code', 'level', 'sort_order',
            'parent', 'head_name', 'children',
        ]

    def get_children(self, obj):
        """Return active children serialized recursively."""
        children = obj.children.filter(is_active=True).order_by('sort_order', 'name')
        return DepartmentTreeSerializer(children, many=True).data
