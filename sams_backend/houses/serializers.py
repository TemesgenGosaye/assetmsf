"""
Serializers for the houses app.
"""
from rest_framework import serializers
from .models import House, HouseApplication


class HouseSerializer(serializers.ModelSerializer):
    """Full read serializer."""

    damaged_items = serializers.SerializerMethodField()

    class Meta:
        model  = House
        fields = [
            "id",
            "house_id",
            "location",
            "house_type",
            "status",
            "damaged_door",
            "damaged_windows",
            "damaged_walls",
            "damaged_switch",
            "damaged_bulb",
            "damaged_water",
            "damaged_items",
            "description",
            "capacity",
            "created_at",
            "updated_at",
            "is_active",
        ]
        read_only_fields = ["id", "house_id", "created_at", "updated_at", "is_active"]

    def get_damaged_items(self, obj):
        if obj.status != "Inactive":
            return []
        items = []
        if obj.damaged_door:    items.append("door")
        if obj.damaged_windows: items.append("windows")
        if obj.damaged_walls:   items.append("walls")
        if obj.damaged_switch:  items.append("switch")
        if obj.damaged_bulb:    items.append("bulb")
        if obj.damaged_water:   items.append("water")
        return items


class HouseCreateUpdateSerializer(serializers.ModelSerializer):
    """Write serializer for creating / updating houses."""

    class Meta:
        model  = House
        fields = [
            "location",
            "house_type",
            "status",
            "damaged_door",
            "damaged_windows",
            "damaged_walls",
            "damaged_switch",
            "damaged_bulb",
            "damaged_water",
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


class HouseApplicationListSerializer(serializers.ModelSerializer):
    requester_name = serializers.CharField(source="requester.name", read_only=True)

    class Meta:
        model = HouseApplication
        fields = [
            "id",
            "application_no",
            "employee_name",
            "national_id",
            "requested_house_category",
            "preferred_location",
            "status",
            "submitted_at",
            "requester_name",
            "created_at",
            "updated_at",
        ]


class HouseApplicationDetailSerializer(serializers.ModelSerializer):
    requester_name = serializers.CharField(source="requester.name", read_only=True)
    reviewed_by_name = serializers.CharField(source="reviewed_by.name", read_only=True, allow_null=True)

    class Meta:
        model = HouseApplication
        fields = [
            "id",
            "application_no",
            "requester",
            "requester_name",
            "employee_id",
            "employee_name",
            "national_id",
            "gender",
            "job_position",
            "job_grade",
            "years_of_service",
            "marital_status",
            "has_disability",
            "family_size",
            "number_of_children",
            "requested_house_category",
            "reason_for_request",
            "preferred_location",
            "supporting_document",
            "status",
            "submitted_at",
            "reviewed_at",
            "reviewed_by",
            "reviewed_by_name",
            "rejection_reason",
            "returned_reason",
            "created_at",
            "updated_at",
            "is_active",
        ]
        read_only_fields = [
            "id", "application_no", "requester", "requester_name",
            "submitted_at", "reviewed_at", "reviewed_by", "reviewed_by_name",
            "created_at", "updated_at", "is_active",
        ]


class HouseApplicationCreateSerializer(serializers.ModelSerializer):
    supporting_document = serializers.FileField(required=False, allow_null=True)

    class Meta:
        model = HouseApplication
        fields = [
            "employee_id",
            "employee_name",
            "national_id",
            "gender",
            "job_position",
            "job_grade",
            "years_of_service",
            "marital_status",
            "has_disability",
            "family_size",
            "number_of_children",
            "requested_house_category",
            "reason_for_request",
            "preferred_location",
            "supporting_document",
            "status",
        ]

    def validate_years_of_service(self, value):
        if value < 0:
            raise serializers.ValidationError("Years of service cannot be negative.")
        return value

    def validate_supporting_document(self, value):
        if value:
            if value.size > 5 * 1024 * 1024:
                raise serializers.ValidationError("File size must not exceed 5 MB.")
            ext = value.name.split('.')[-1].lower() if '.' in value.name else ''
            if ext not in ('pdf', 'jpg', 'jpeg', 'png'):
                raise serializers.ValidationError("Only PDF, JPG, and PNG files are allowed.")
        return value


class HouseApplicationStatusSerializer(serializers.ModelSerializer):
    """Serializer for status transitions (admin/manager only)."""
    class Meta:
        model = HouseApplication
        fields = ["status", "rejection_reason", "returned_reason"]
