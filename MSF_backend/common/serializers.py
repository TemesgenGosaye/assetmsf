"""
Serializers for common functionality.
"""
from rest_framework import serializers
from .models import QRCode, Vendor


class QRCodeSerializer(serializers.ModelSerializer):
    """Serializer for QRCode model."""
    asset_detail = serializers.SerializerMethodField()

    class Meta:
        model = QRCode
        fields = [
            'id', 'asset', 'asset_code', 'asset_identifier', 'asset_name',
            'property', 'department', 'generated_date',
            'status', 'printed', 'image_url', 'asset_detail', 'created_at',
        ]
        read_only_fields = ['id', 'asset_code', 'asset_identifier', 'created_at']

    def get_asset_detail(self, obj):
        if obj.asset:
            return {
                'id': str(obj.asset.id),
                'name': obj.asset.name,
                'asset_code': obj.asset.asset_code,
                'department': obj.asset.department,
                'property': obj.asset.property,
                'type': getattr(obj.asset, 'item_type', None) and str(obj.asset.item_type) or '',
                'condition': obj.asset.condition or '',
                'description': obj.asset.description or '',
            }
        return None


class QRCodeCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating QR codes."""

    class Meta:
        model = QRCode
        fields = [
            'asset', 'asset_name', 'property', 'department',
            'generated_date', 'status', 'printed', 'image_url',
        ]

    def create(self, validated_data):
        asset = validated_data.get('asset')
        if asset:
            validated_data.setdefault('asset_code', asset.asset_code)
            validated_data.setdefault('asset_identifier', asset.asset_code)
            validated_data.setdefault('asset_name', asset.name)
            validated_data.setdefault('department', asset.department)
            validated_data.setdefault('property', asset.property)
        return super().create(validated_data)


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
