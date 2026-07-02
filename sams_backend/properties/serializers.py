"""
Serializers for property management.
"""
from rest_framework import serializers
from .models import Property


class PropertySerializer(serializers.ModelSerializer):
    """Serializer for Property model."""
    full_address = serializers.SerializerMethodField()
    manager_name = serializers.CharField(source='manager.name', read_only=True, allow_null=True)
    manager_email = serializers.CharField(source='manager.email', read_only=True, allow_null=True)
    
    class Meta:
        model = Property
        fields = [
            'id', 'name', 'address', 'city', 'state', 'country', 'postal_code',
            'latitude', 'longitude', 'status', 'manager', 'manager_name',
            'manager_email', 'contact_email', 'contact_phone', 'total_area',
            'description', 'full_address', 'created_at', 'updated_at', 'is_active'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_active']
    
    def get_full_address(self, obj):
        """Get the full address."""
        return obj.get_full_address()


class PropertyCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating properties."""
    
    class Meta:
        model = Property
        fields = [
            'id', 'name', 'address', 'city', 'state', 'country', 'postal_code',
            'latitude', 'longitude', 'status', 'manager', 'contact_email',
            'contact_phone', 'total_area', 'description'
        ]


class PropertyUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating properties."""
    
    class Meta:
        model = Property
        fields = [
            'name', 'address', 'city', 'state', 'country', 'postal_code',
            'latitude', 'longitude', 'status', 'manager', 'contact_email',
            'contact_phone', 'total_area', 'description'
        ]
