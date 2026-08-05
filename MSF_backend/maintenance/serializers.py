"""
Serializers for maintenance ticket management.
"""
from rest_framework import serializers
from .models import MaintenanceTicket, TicketEvent, TicketAttachment, MaintenanceSchedule
from assets.models import Asset
from authentication.models import User


class MaintenanceTicketSerializer(serializers.ModelSerializer):
    """Serializer for MaintenanceTicket model."""
    asset_name = serializers.CharField(source='asset.name', read_only=True, allow_null=True)
    asset_code = serializers.CharField(source='asset.asset_code', read_only=True, allow_null=True)
    assigned_to_name = serializers.CharField(source='assigned_to.name', read_only=True, allow_null=True)
    assigned_to_email = serializers.CharField(source='assigned_to.email', read_only=True, allow_null=True)
    assigned_by_name = serializers.CharField(source='assigned_by.name', read_only=True, allow_null=True)
    resolved_by_name = serializers.CharField(source='resolved_by.name', read_only=True, allow_null=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True, allow_null=True)
    assignee = serializers.UUIDField(source='assigned_to', read_only=True, allow_null=True)
    is_closed = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    
    class Meta:
        model = MaintenanceTicket
        fields = [
            'id', 'title', 'description', 'asset', 'asset_name', 'asset_code',
            'property_id', 'target_role', 'close_note',
            'assigned_to', 'assignee', 'assigned_to_name', 'assigned_to_email', 'assigned_by',
            'assigned_by_name', 'assigned_at', 'status', 'priority', 'resolution',
            'resolved_at', 'resolved_by', 'resolved_by_name', 'due_date',
            'sla_breach', 'location', 'estimated_cost', 'actual_cost',
            'metadata', 'is_closed', 'is_overdue', 'created_at', 'updated_at', 'is_active',
            'created_by', 'created_by_name',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_active']
    
    def get_is_closed(self, obj):
        return obj.is_closed()
    
    def get_is_overdue(self, obj):
        return obj.is_overdue()


class MaintenanceTicketCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating maintenance tickets from frontend."""
    
    class Meta:
        model = MaintenanceTicket
        fields = [
            'id', 'title', 'description', 'property_id', 'target_role', 'close_note',
            'assigned_to', 'priority', 'due_date', 'status',
        ]
        extra_kwargs = {
            'id': {'required': False, 'allow_null': True},
            'assigned_to': {'required': False, 'allow_null': True},
            'priority': {'required': False},
            'status': {'required': False},
            'due_date': {'required': False, 'allow_null': True},
        }


class MaintenanceTicketUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating maintenance tickets."""
    
    class Meta:
        model = MaintenanceTicket
        fields = [
            'title', 'description', 'assigned_to', 'status', 'priority',
            'resolution', 'due_date', 'location', 'estimated_cost', 'actual_cost',
            'property_id', 'target_role', 'close_note',
        ]
    
    def validate_status(self, value):
        """Validate status transition."""
        if self.instance and self.instance.is_closed():
            raise serializers.ValidationError("Cannot modify status of a closed ticket.")
        return value


class TicketEventSerializer(serializers.ModelSerializer):
    """Serializer for TicketEvent model."""
    actor_name = serializers.CharField(read_only=True)
    
    class Meta:
        model = TicketEvent
        fields = [
            'id', 'ticket', 'event_type', 'actor', 'actor_name', 'actor_email',
            'message', 'old_value', 'new_value', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class TicketEventCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating ticket events."""
    
    class Meta:
        model = TicketEvent
        fields = ['event_type', 'message', 'old_value', 'new_value']


class TicketAttachmentSerializer(serializers.ModelSerializer):
    """Serializer for TicketAttachment model."""
    uploaded_by_name = serializers.CharField(source='uploaded_by.name', read_only=True, allow_null=True)
    
    class Meta:
        model = TicketAttachment
        fields = [
            'id', 'ticket', 'file', 'file_name', 'file_type', 'file_size',
            'description', 'uploaded_by', 'uploaded_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class TicketAttachmentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating ticket attachments."""
    
    class Meta:
        model = TicketAttachment
        fields = ['ticket', 'file', 'file_name', 'file_type', 'file_size', 'description']


class MaintenanceScheduleSerializer(serializers.ModelSerializer):
    """Serializer for MaintenanceSchedule model."""
    asset_name = serializers.CharField(source='asset.name', read_only=True)
    asset_code = serializers.CharField(source='asset.asset_code', read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.name', read_only=True, allow_null=True)
    is_overdue = serializers.SerializerMethodField()
    
    class Meta:
        model = MaintenanceSchedule
        fields = [
            'id', 'asset', 'asset_name', 'asset_code', 'name', 'description',
            'frequency', 'start_date', 'end_date', 'last_performed', 'next_due',
            'assigned_to', 'assigned_to_name', 'estimated_duration_hours',
            'is_active', 'is_overdue', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_is_overdue(self, obj):
        """Check if maintenance is overdue."""
        return obj.is_overdue()


class MaintenanceScheduleCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating maintenance schedules."""
    
    class Meta:
        model = MaintenanceSchedule
        fields = [
            'asset', 'name', 'description', 'frequency', 'start_date',
            'end_date', 'assigned_to', 'estimated_duration_hours'
        ]
