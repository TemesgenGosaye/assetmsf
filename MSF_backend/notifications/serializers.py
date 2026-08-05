"""
Serializers for notification management.
"""
from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for Notification model."""
    
    class Meta:
        model = Notification
        fields = [
            'id', 'user', 'title', 'message', 'type', 'read', 'user_name',
            'action_url', 'metadata', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class NotificationUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating notifications."""
    
    class Meta:
        model = Notification
        fields = ['read']
