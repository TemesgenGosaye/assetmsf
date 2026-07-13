"""
Serializers for dashboard management.
"""
from rest_framework import serializers
from .models import RecentActivity, SystemSettings, PropertyLicense, LicenseMeta


class RecentActivitySerializer(serializers.ModelSerializer):
    """Serializer for RecentActivity model."""
    
    class Meta:
        model = RecentActivity
        fields = ['id', 'type', 'message', 'user_name', 'metadata', 'created_at']
        read_only_fields = ['id', 'created_at']


class SystemSettingsSerializer(serializers.ModelSerializer):
    """Serializer for SystemSettings model."""
    
    class Meta:
        model = SystemSettings
        fields = [
            'id', 'timezone', 'language', 'backup_frequency',
            'auto_backup', 'appearance', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PropertyLicenseSerializer(serializers.ModelSerializer):
    """Serializer for PropertyLicense model."""
    
    class Meta:
        model = PropertyLicense
        fields = ['property_id', 'asset_limit', 'plan', 'updated_at']
        read_only_fields = ['updated_at']


class LicenseMetaSerializer(serializers.ModelSerializer):
    """Serializer for LicenseMeta model."""
    
    class Meta:
        model = LicenseMeta
        fields = ['key', 'value']
