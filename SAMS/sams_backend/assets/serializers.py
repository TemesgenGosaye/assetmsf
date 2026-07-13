"""
Serializers for asset management.
"""
from rest_framework import serializers
from django.db import models
from .models import Asset, AssetAttachment
from properties.models import Property
from categories.models import Category, ItemType
from authentication.models import User


class AssetSerializer(serializers.ModelSerializer):
    """Serializer for Asset model."""
    id = serializers.CharField(source='asset_code', read_only=True)
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
            'manufacturer', 'model', 'property', 'department',
            'location', 'owner', 'purchase_date', 'purchase_cost', 'po_number',
            'vendor', 'invoice_number', 'warranty_expiry', 'warranty_provider',
            'warranty_notes', 'current_value', 'depreciation_rate',
            'accumulated_depreciation', 'status', 'condition', 'amc_enabled',
            'amc_provider', 'amc_start_date', 'amc_end_date', 'amc_cost',
            'quantity', 'expiry_date', 'notes', 'metadata', 'image', 'documents'
        ]
        extra_kwargs = {
            'asset_code': {'required': False, 'allow_blank': True},
            'department': {'required': False, 'allow_blank': True},
            'status': {'required': False},
            'condition': {'required': False},
            'purchase_date': {'required': False, 'allow_null': True},
            'expiry_date': {'required': False, 'allow_null': True},
            'warranty_expiry': {'required': False, 'allow_null': True},
            'amc_start_date': {'required': False, 'allow_null': True},
            'amc_end_date': {'required': False, 'allow_null': True},
        }
    
    def to_internal_value(self, data):
        """Convert empty string date fields to None before field validation."""
        date_fields = ['purchase_date', 'expiry_date', 'warranty_expiry',
                       'amc_start_date', 'amc_end_date']
        if isinstance(data, dict):
            data = data.copy()
            for field in date_fields:
                if field in data and data[field] == '':
                    data[field] = None
        return super().to_internal_value(data)

    def generate_asset_code(self):
        """Generate a unique asset code, skipping any already taken (including soft-deleted)."""
        import re
        # Use all() not just active, to avoid collisions with soft-deleted codes
        max_code = Asset.objects.all().order_by().aggregate(
            max_code=models.Max('asset_code')
        )['max_code']
        next_num = 1
        if max_code:
            match = re.search(r'(\d+)$', max_code)
            if match:
                next_num = int(match.group(1)) + 1
        
        # Ensure uniqueness — increment until we find a free slot
        while True:
            candidate = f"AST-{str(next_num).zfill(6)}"
            if not Asset.objects.filter(asset_code=candidate).exists():
                return candidate
            next_num += 1
    
    def validate(self, attrs):
        """Validate and prepare data."""
        # Auto-generate asset code if not provided
        if not attrs.get('asset_code'):
            attrs['asset_code'] = self.generate_asset_code()
        
        # Normalize status to lowercase
        if 'status' in attrs and attrs['status']:
            attrs['status'] = attrs['status'].lower()
        
        # Normalize condition to lowercase; map 'new' → 'good'
        if 'condition' in attrs and attrs['condition']:
            cond = attrs['condition'].lower()
            attrs['condition'] = 'good' if cond == 'new' else cond
        
        # Default department to empty string if missing
        if not attrs.get('department'):
            attrs['department'] = ''
        
        # Handle item_type by name if provided as string
        request = self.context.get('request')
        item_type_name = request.data.get('item_type_name') if request else None
        if item_type_name and not attrs.get('item_type'):
            try:
                item_type = ItemType.objects.get(name__iexact=item_type_name, is_active=True)
                attrs['item_type'] = item_type
            except ItemType.DoesNotExist:
                # Create item type if it doesn't exist
                item_type = ItemType.objects.create(name=item_type_name)
                attrs['item_type'] = item_type
        
        return attrs
    
    def validate_property(self, value):
        """Validate property exists - value can be a string ID or a Property instance."""
        from properties.models import Property as PropModel
        if hasattr(value, 'id'):
            # Already a model instance
            if not value.is_active:
                raise serializers.ValidationError("Property not found or inactive.")
            return value
        # String ID
        if not PropModel.objects.filter(id=str(value), is_active=True).exists():
            raise serializers.ValidationError("Property not found or inactive.")
        return value
    
    def validate_category(self, value):
        """Validate category exists if provided."""
        if value and not Category.objects.filter(id=value, is_active=True).exists():
            raise serializers.ValidationError("Category not found or inactive.")
        return value
    
    def validate_item_type(self, value):
        """Validate item type exists if provided."""
        if value and not ItemType.objects.filter(id=value, is_active=True).exists():
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
        extra_kwargs = {
            'department': {'required': False, 'allow_blank': True},
            'status': {'required': False},
            'condition': {'required': False},
        }
    
    def validate(self, attrs):
        """Normalize status/condition on update."""
        if 'status' in attrs and attrs['status']:
            attrs['status'] = attrs['status'].lower()
        if 'condition' in attrs and attrs['condition']:
            cond = attrs['condition'].lower()
            attrs['condition'] = 'good' if cond == 'new' else cond
        return attrs


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
