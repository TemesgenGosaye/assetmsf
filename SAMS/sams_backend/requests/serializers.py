"""
Serializers for approval workflow management.
"""
from rest_framework import serializers
from .models import ApprovalRequest, ApprovalEvent
from assets.models import Asset
from authentication.models import User


class ApprovalRequestSerializer(serializers.ModelSerializer):
    """Serializer for ApprovalRequest model."""
    asset_name = serializers.CharField(source='asset.name', read_only=True, allow_null=True)
    asset_code = serializers.CharField(source='asset.asset_code', read_only=True, allow_null=True)
    requester_name = serializers.CharField(source='requester.name', read_only=True)
    requester_email = serializers.CharField(source='requester.email', read_only=True)
    current_approver_name = serializers.CharField(source='current_approver.name', read_only=True, allow_null=True)
    current_approver_email = serializers.CharField(source='current_approver.email', read_only=True, allow_null=True)
    decided_by_name = serializers.CharField(source='decided_by.name', read_only=True, allow_null=True)
    forwarded_by_name = serializers.CharField(source='forwarded_by.name', read_only=True, allow_null=True)
    is_pending = serializers.SerializerMethodField()
    can_be_forwarded = serializers.SerializerMethodField()
    
    class Meta:
        model = ApprovalRequest
        fields = [
            'id', 'request_type', 'title', 'description', 'asset', 'asset_name',
            'asset_code', 'requester', 'requester_name', 'requester_email',
            'requester_department', 'current_approver', 'current_approver_name',
            'current_approver_email', 'status', 'decision', 'decided_at',
            'decided_by', 'decided_by_name', 'forwarded_by', 'forwarded_by_name',
            'forwarded_at', 'request_data', 'metadata', 'is_pending',
            'can_be_forwarded', 'created_at', 'updated_at', 'is_active'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_active']
    
    def get_is_pending(self, obj):
        """Check if request is pending."""
        return obj.is_pending()
    
    def get_can_be_forwarded(self, obj):
        """Check if request can be forwarded."""
        return obj.can_be_forwarded()


class ApprovalRequestCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating approval requests."""
    
    class Meta:
        model = ApprovalRequest
        fields = [
            'request_type', 'title', 'description', 'asset', 'request_data'
        ]
    
    def validate_asset(self, value):
        """Validate asset exists if provided."""
        if value and not Asset.objects.filter(id=value.id, is_active=True).exists():
            raise serializers.ValidationError("Asset not found or inactive.")
        return value


class ApprovalEventSerializer(serializers.ModelSerializer):
    """Serializer for ApprovalEvent model."""
    actor_name = serializers.CharField(read_only=True)
    
    class Meta:
        model = ApprovalEvent
        fields = [
            'id', 'approval', 'action', 'actor', 'actor_name', 'actor_email',
            'notes', 'old_status', 'new_status', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class ApprovalEventCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating approval events."""
    
    class Meta:
        model = ApprovalEvent
        fields = ['action', 'notes']
