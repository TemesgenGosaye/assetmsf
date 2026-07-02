"""
Serializers for asset management.
"""
from rest_framework import serializers
from .models import Asset, AssetAttachment
from properties.models import Property
from categories.models import Category, ItemType
from authentication.models import User


class AssetSerializer(serializers.ModelSerializer):
    """Serializer for Asset model."""
    property_name = serializers.CharField(source='property.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    item_type_name = serializers.CharField(source='item_type.name', read_only=True, allow_null=True)
    owner_name = serializers.CharField(source='owner.name', read_only=True, allow_null=True)
    owner_email = serializers.CharField(source='owner.email', read_only=True, allow_null=True)
    is_under_warranty = serializers.SerializerMethodField()
    is_amc_active = serializers.SerializerMethodField()
    current_value_calculated = serializers.SerializerMethodField()
    
    class Meta:
        model = Asset
        fields = [
            'id', 'asset_code', 'barcode', 'qr_code', 'rfid', 'serial_number',
            'name', 'description', 'category', 'category_name', 'item_type',
            'item_type_name', 'subcategory', 'manufacturer', 'model',
            'property', 'property_name', 'property_id', 'department', 'location',
            'owner', 'owner_name', 'owner_email', 'purchase_date', 'purchase_cost',
            'po_number', 'vendor', 'invoice_number', 'warranty_expiry',
            'warranty_provider', 'warranty_notes', 'current_value',
            'depreciation_rate', 'accumulated_depreciation', 'status',
            'condition', 'amc_enabled', 'amc_provider', 'amc_start_date',
            'amc_end_date', 'amc_cost', 'quantity', 'expiry_date', 'notes',
            'metadata', 'image', 'documents', 'is_under_warranty',
            'is_amc_active', 'current_value_calculated', 'created_at',
            'updated_at', 'is_active'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_active']
    
    def get_is_under_warranty(self, obj):
        """Check if asset is under warranty."""
        return obj.is_under_warranty()
    
    def get_is_amc_active(self, obj):
        """Check if AMC is active."""
        return obj.is_amc_active()
    
    def get_current_value_calculated(self, obj):
        """Get calculated current value."""
        return obj.get_current_value()


class AssetCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating assets."""
    
    class Meta:
        model = Asset
        fields = [
            'asset_code', 'barcode', 'qr_code', 'rfid', 'serial_number',
            'name', 'description', 'category', 'item_type', 'subcategory',
            'manufacturer', 'model', 'property', 'property_id', 'department',
            'location', 'owner', 'purchase_date', 'purchase_cost', 'po_number',
            'vendor', 'invoice_number', 'warranty_expiry', 'warranty_provider',
            'warranty_notes', 'current_value', 'depreciation_rate',
            'accumulated_depreciation', 'status', 'condition', 'amc_enabled',
            'amc_provider', 'amc_start_date', 'amc_end_date', 'amc_cost',
            'quantity', 'expiry_date', 'notes', 'metadata', 'image', 'documents'
        ]
    
    def validate_property(self, value):
        """Validate property exists."""
        if not Property.objects.filter(id=value.id, is_active=True).exists():
            raise serializers.ValidationError("Property not found or inactive.")
        return value
    
    def validate_category(self, value):
        """Validate category exists if provided."""
        if value and not Category.objects.filter(id=value.id, is_active=True).exists():
            raise serializers.ValidationError("Category not found or inactive.")
        return value
    
    def validate_item_type(self, value):
        """Validate item type exists if provided."""
        if value and not ItemType.objects.filter(id=value.id, is_active=True).exists():
            raise serializers.ValidationError("Item type not found or inactive.")
        return value


class AssetUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating assets."""
    
    class Meta:
        model = Asset
        fields = [
            'barcode', 'qr_code', 'rfid', 'serial_number', 'name',
            'description', 'category', 'item_type', 'subcategory',
            'manufacturer', 'model', 'department', 'location', 'owner',
            'purchase_date', 'purchase_cost', 'po_number', 'vendor',
            'invoice_number', 'warranty_expiry', 'warranty_provider',
            'warranty_notes', 'current_value', 'depreciation_rate',
            'accumulated_depreciation', 'status', 'condition',
            'amc_enabled', 'amc_provider', 'amc_start_date', 'amc_end_date',
            'amc_cost', 'quantity', 'expiry_date', 'notes', 'metadata',
            'image', 'documents'
        ]


class AssetAttachmentSerializer(serializers.ModelSerializer):
    """Serializer for AssetAttachment model."""
    uploaded_by_name = serializers.CharField(source='uploaded_by.name', read_only=True, allow_null=True)
    
    class Meta:
        model = AssetAttachment
        fields = [
            'id', 'asset', 'file', 'file_name', 'file_type', 'file_size',
            'description', 'uploaded_by', 'uploaded_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class AssetAttachmentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating asset attachments."""
    
    class Meta:
        model = AssetAttachment
        fields = ['asset', 'file', 'file_name', 'file_type', 'file_size', 'description']
