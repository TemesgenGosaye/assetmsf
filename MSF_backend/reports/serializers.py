"""
Serializers for report management.
"""
from rest_framework import serializers
from .models import Report


class ReportSerializer(serializers.ModelSerializer):
    """Serializer for Report model."""
    
    class Meta:
        model = Report
        fields = [
            'id', 'name', 'type', 'format', 'status', 'date_from', 'date_to',
            'file_url', 'file_size', 'filter_session_id', 'filter_department',
            'filter_property', 'filter_asset_type', 'created_by_name',
            'created_by_id', 'error_message', 'created_at', 'updated_at', 'is_active'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_active']


class ReportCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating reports."""
    
    class Meta:
        model = Report
        fields = [
            'name', 'type', 'format', 'date_from', 'date_to',
            'filter_session_id', 'filter_department', 'filter_property',
            'filter_asset_type'
        ]
