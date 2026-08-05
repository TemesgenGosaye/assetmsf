"""
Serializers for audit management.
"""
from rest_framework import serializers
from .models import AuditSession, AuditAssignment, AuditReview, AuditReport, AuditIncharge, AuditScan
from properties.models import Property
from authentication.models import User


class AuditSessionSerializer(serializers.ModelSerializer):
    """Serializer for AuditSession model."""
    property_name = serializers.CharField(source='property.name', read_only=True)
    initiated_by_name = serializers.CharField(source='initiated_by.name', read_only=True, allow_null=True)
    completion_percentage = serializers.SerializerMethodField()
    
    class Meta:
        model = AuditSession
        fields = [
            'id', 'name', 'description', 'property', 'property_name', 'status',
            'frequency', 'scheduled_date', 'start_date', 'end_date', 'initiated_by',
            'initiated_by_name', 'total_assets', 'verified_assets', 'damaged_assets',
            'missing_assets', 'notes', 'metadata', 'completion_percentage',
            'created_at', 'updated_at', 'is_active'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_active']
    
    def get_completion_percentage(self, obj):
        """Get completion percentage."""
        return obj.get_completion_percentage()


class AuditSessionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating audit sessions."""
    
    class Meta:
        model = AuditSession
        fields = [
            'id', 'name', 'description', 'property', 'frequency', 'scheduled_date'
        ]


class AuditAssignmentSerializer(serializers.ModelSerializer):
    """Serializer for AuditAssignment model."""
    assigned_to_name = serializers.CharField(source='assigned_to.name', read_only=True, allow_null=True)
    
    class Meta:
        model = AuditAssignment
        fields = [
            'id', 'session', 'department', 'assigned_to', 'assigned_to_name',
            'assigned_at', 'status'
        ]
        read_only_fields = ['id', 'assigned_at']


class AuditReviewSerializer(serializers.ModelSerializer):
    """Serializer for AuditReview model."""
    reviewer_name = serializers.CharField(source='reviewer.name', read_only=True, allow_null=True)
    
    class Meta:
        model = AuditReview
        fields = [
            'id', 'assignment', 'reviewer', 'reviewer_name', 'assets_reviewed',
            'verified_count', 'damaged_count', 'missing_count', 'notes',
            'submitted_at'
        ]
        read_only_fields = ['id', 'submitted_at']


class AuditScanSerializer(serializers.ModelSerializer):
    """Serializer for AuditScan model."""
    scanned_by_name = serializers.CharField(read_only=True)
    
    class Meta:
        model = AuditScan
        fields = [
            'id', 'session', 'asset_id', 'property_id', 'department', 'status',
            'scanned_by', 'scanned_by_name', 'scanned_by_email', 'comment',
            'scanned_at'
        ]
        read_only_fields = ['id', 'scanned_at']


class AuditScanCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating audit scans."""
    
    class Meta:
        model = AuditScan
        fields = ['asset_id', 'property_id', 'department', 'status', 'comment']


class AuditInchargeSerializer(serializers.ModelSerializer):
    """Serializer for AuditIncharge model."""
    user_name = serializers.CharField(source='user.name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    
    class Meta:
        model = AuditIncharge
        fields = ['id', 'session', 'user', 'user_name', 'user_email', 'role', 'assigned_at']
        read_only_fields = ['id', 'assigned_at']
