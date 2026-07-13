"""
Serializers for common functionality.
"""
from rest_framework import serializers
from .models import QRCode, Vendor


class QRCodeSerializer(serializers.ModelSerializer):
    """Serializer for QRCode model."""
    
    class Meta:
        model = QRCode
        fields = [
            'id', 'asset_id', 'asset_name', 'property', 'generated_date',
            'status', 'printed', 'image_url', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class QRCodeCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating QR codes."""
    
    class Meta:
        model = QRCode
        fields = ['asset_id', 'asset_name', 'property', 'generated_date', 'status', 'printed', 'image_url']


class VendorSerializer(serializers.ModelSerializer):
    """Serializer for Vendor model."""
    
    class Meta:
        model = Vendor
        fields = [
            'id', 'name', 'code', 'contact_person', 'email', 'phone',
            'address', 'city', 'state', 'country', 'postal_code', 'status',
            'tax_id', 'payment_terms', 'notes', 'created_at', 'updated_at', 'is_active'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_active']


class VendorCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating vendors."""
    
    class Meta:
        model = Vendor
        fields = [
            'name', 'code', 'contact_person', 'email', 'phone', 'address',
            'city', 'state', 'country', 'postal_code', 'status', 'tax_id',
            'payment_terms', 'notes'
        ]


class VendorUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating vendors."""
    
    class Meta:
        model = Vendor
        fields = [
            'name', 'contact_person', 'email', 'phone', 'address', 'city',
            'state', 'country', 'postal_code', 'status', 'tax_id',
            'payment_terms', 'notes'
        ]
