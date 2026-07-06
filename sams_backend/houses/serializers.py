"""
Serializers for the houses app.
"""
from rest_framework import serializers
from .models import House


class HouseSerializer(serializers.ModelSerializer):
    """Full read serializer."""

    class Meta:
        model  = House
        fields = [
            "id",
            "house_id",
            "location",
            "house_type",
            "status",
            "description",
            "capacity",
            "created_at",
            "updated_at",
            "is_active",
        ]
        read_only_fields = ["id", "house_id", "created_at", "updated_at", "is_active"]


class HouseCreateUpdateSerializer(serializers.ModelSerializer):
    """Write serializer for creating / updating houses."""

    class Meta:
        model  = House
        fields = [
            "location",
            "house_type",
            "status",
            "description",
            "capacity",
        ]

    def validate_location(self, value):
        if not value.strip():
            raise serializers.ValidationError("Location cannot be blank.")
        return value.strip()

    def validate_capacity(self, value):
        if value < 1:
            raise serializers.ValidationError("Capacity must be at least 1.")
        return value
