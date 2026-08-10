"""
Serializers for dashboard management.
"""
from rest_framework import serializers
from .models import RecentActivity, SystemSettings


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
