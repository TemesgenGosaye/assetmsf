"""
Serializers for the houses app.
"""
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from .models import (
    House, HouseApplication, ScoringConfig, AllocationLog, get_eligible_category,
    HouseInspection, HouseMaintenanceRequest, HouseTransfer, HouseNotification
)
from employees.models import Employee



class HouseSerializer(serializers.ModelSerializer):
    """Full read serializer."""

    damaged_items = serializers.SerializerMethodField()
    allocation_status = serializers.SerializerMethodField()
    assigned_employee_id = serializers.SerializerMethodField()
    assigned_employee_name = serializers.SerializerMethodField()
    assigned_application_no = serializers.SerializerMethodField()

    class Meta:
        model  = House
        fields = [
            "id",
            "house_id",
            "house_number",
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
            "inside_items",
            "description",
            "capacity",
            "allocation_category",
            "allocation_status",
            "assigned_employee_id",
            "assigned_employee_name",
            "assigned_application_no",
            "created_at",
            "updated_at",
            "is_active",
        ]
        read_only_fields = ["id", "house_id", "house_number", "created_at", "updated_at", "is_active"]

    def get_allocation_status(self, obj):
        app = obj.allocations.filter(is_active=True, status="Allocated").first()
        return "Assigned" if app else "Unassigned"

    def get_assigned_employee_id(self, obj):
        app = obj.allocations.filter(is_active=True, status="Allocated").first()
        return app.employee_id if app else None

    def get_assigned_employee_name(self, obj):
        app = obj.allocations.filter(is_active=True, status="Allocated").first()
        return app.employee_name if app else None

    def get_assigned_application_no(self, obj):
        app = obj.allocations.filter(is_active=True, status="Allocated").first()
        return app.application_no if app else None

    def get_damaged_items(self, obj):
        if obj.status == "Inactive":
            items = []
            if obj.damaged_door:    items.append("door")
            if obj.damaged_windows: items.append("windows")
            if obj.damaged_walls:   items.append("walls")
            if obj.damaged_switch:  items.append("switch")
            if obj.damaged_bulb:    items.append("bulb")
            if obj.damaged_water:   items.append("water")
            return items
        return []


class HouseCreateUpdateSerializer(serializers.ModelSerializer):
    """Write serializer for creating / updating houses."""

    populate_items = serializers.BooleanField(
        default=False,
        write_only=True,
        help_text=_("Auto-populate with default items: Bed, Chair, Table, Locker"),
    )

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
            "inside_items",
            "description",
            "capacity",
            "allocation_category",
            "populate_items",
        ]

    def validate_location(self, value):
        if not value.strip():
            raise serializers.ValidationError("Location cannot be blank.")
        return value.strip()

    def validate_capacity(self, value):
        if value < 1:
            raise serializers.ValidationError("Capacity must be at least 1.")
        return value

    def validate_house_type(self, value):
        if value not in House.HouseType.values:
            raise serializers.ValidationError(
                f"House type must be one of {', '.join(House.HouseType.values)}."
            )
        return value

    def validate_status(self, value):
        if value not in House.Status.values:
            raise serializers.ValidationError(
                f"Status must be one of {', '.join(House.Status.values)}."
            )
        return value

    def validate_description(self, value):
        return value.strip() if isinstance(value, str) else value

    def create(self, validated_data):
        populate_items = validated_data.pop("populate_items", False)
        inside_items = validated_data.get("inside_items", [])
        if populate_items and not inside_items:
            validated_data["inside_items"] = ["Bed", "Chair", "Table", "Locker"]
        return super().create(validated_data)

    def update(self, instance, validated_data):
        populate_items = validated_data.pop("populate_items", False)
        inside_items = validated_data.get("inside_items", instance.inside_items)
        if populate_items and not inside_items:
            validated_data["inside_items"] = ["Bed", "Chair", "Table", "Locker"]
        return super().update(instance, validated_data)


class HouseApplicationListSerializer(serializers.ModelSerializer):
    requester_name = serializers.CharField(source="requester.name", read_only=True)
    allocated_house_hid = serializers.SerializerMethodField()
    queue_position = serializers.SerializerMethodField()

    class Meta:
        model = HouseApplication
        fields = [
            "id",
            "application_no",
            "employee_id",
            "employee_name",
            "national_id",
            "gender",
            "job_grade",
            "job_type",
            "years_of_service",
            "has_disability",
            "family_size",
            "requested_house_category",
            "eligible_house_category",
            "priority_score",
            "queue_position",
            "preferred_location",
            "status",
            "submitted_at",
            "allocated_house_hid",
            "allocated_at",
            "requester_name",
            "created_at",
            "updated_at",
        ]

    def get_allocated_house_hid(self, obj):
        if obj.allocated_house_id:
            try:
                return obj.allocated_house.house_id
            except Exception:
                return None
        return None

    def get_queue_position(self, obj):
        """Calculate queue position based on priority score."""
        if obj.status not in ("Submitted", "Under Review", "Verified", "Waiting for Allocation"):
            return None
        higher = HouseApplication.objects.filter(
            is_active=True,
            eligible_house_category=obj.eligible_house_category,
            status__in=["Submitted", "Under Review", "Verified", "Waiting for Allocation"],
            priority_score__gt=obj.priority_score,
        ).count()
        return higher + 1


class HouseApplicationDetailSerializer(serializers.ModelSerializer):
    requester_name = serializers.CharField(source="requester.name", read_only=True)
    reviewed_by_name = serializers.CharField(source="reviewed_by.name", read_only=True, allow_null=True)
    allocated_by_name = serializers.CharField(source="allocated_by.name", read_only=True, allow_null=True)
    allocated_house_hid = serializers.SerializerMethodField()
    queue_position = serializers.SerializerMethodField()

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
            "job_type",
            "position_type",
            "years_of_service",
            "marital_status",
            "has_disability",
            "family_size",
            "number_of_children",
            "requested_house_category",
            "eligible_house_category",
            "priority_score",
            "reason_for_request",
            "preferred_location",
            "supporting_document",
            "status",
            "submitted_at",
            "reviewed_at",
            "reviewed_by",
            "reviewed_by_name",
            "allocated_house",
            "allocated_house_hid",
            "allocated_at",
            "allocated_by",
            "allocated_by_name",
            "rejection_reason",
            "returned_reason",
            "queue_position",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id", "application_no", "requester", "requester_name",
            "submitted_at", "reviewed_at", "reviewed_by", "reviewed_by_name",
            "allocated_house", "allocated_house_hid", "allocated_at",
            "allocated_by", "allocated_by_name",
            "eligible_house_category", "priority_score",
            "created_at", "updated_at", "is_active",
        ]

    def get_allocated_house_hid(self, obj):
        if obj.allocated_house_id:
            try:
                return obj.allocated_house.house_id
            except Exception:
                return None
        return None

    def get_queue_position(self, obj):
        if obj.status not in ("Submitted", "Under Review", "Verified", "Waiting for Allocation"):
            return None
        higher = HouseApplication.objects.filter(
            is_active=True,
            eligible_house_category=obj.eligible_house_category,
            status__in=["Submitted", "Under Review", "Verified", "Waiting for Allocation"],
            priority_score__gt=obj.priority_score,
        ).count()
        return higher + 1


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
            "job_type",
            "position_type",
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

    def validate_employee_id(self, value):
        """Verify that the employee_id exists in the employees table."""
        value = value.strip()
        if not Employee.objects.filter(employee_id=value, is_active=True).exists():
            raise serializers.ValidationError(
                f"Employee ID '{value}' does not exist in the system. Please verify and try again."
            )
        return value

    def validate_supporting_document(self, value):
        if value:
            if value.size > 5 * 1024 * 1024:
                raise serializers.ValidationError("File size must not exceed 5 MB.")
            ext = value.name.split('.')[-1].lower() if '.' in value.name else ''
            if ext not in ('pdf', 'jpg', 'jpeg', 'png'):
                raise serializers.ValidationError("Only PDF, JPG, and PNG files are allowed.")
        return value

    def create(self, validated_data):
        instance = super().create(validated_data)
        # Auto-calculate eligible category and priority score
        instance.eligible_house_category = get_eligible_category(instance.job_grade)
        from .allocation_engine import calculate_priority_score
        instance.priority_score = calculate_priority_score(instance)
        instance.save(update_fields=["eligible_house_category", "priority_score", "updated_at"])
        return instance


class HouseApplicationStatusSerializer(serializers.ModelSerializer):
    """Serializer for status transitions (admin/manager only)."""
    class Meta:
        model = HouseApplication
        fields = ["status", "rejection_reason", "returned_reason"]


class ScoringConfigSerializer(serializers.ModelSerializer):
    total_weight = serializers.SerializerMethodField()

    class Meta:
        model = ScoringConfig
        fields = [
            "id", "name",
            "job_grade_weight", "years_of_service_weight",
            "family_size_weight", "disability_weight", "fifo_weight",
            "total_weight", "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "total_weight"]

    def get_total_weight(self, obj):
        return str(obj.total_weight)

    def validate(self, data):
        """Ensure weights sum to exactly 100."""
        job = data.get("job_grade_weight", self.instance.job_grade_weight if self.instance else 30)
        service = data.get("years_of_service_weight", self.instance.years_of_service_weight if self.instance else 25)
        family = data.get("family_size_weight", self.instance.family_size_weight if self.instance else 20)
        disability = data.get("disability_weight", self.instance.disability_weight if self.instance else 15)
        fifo = data.get("fifo_weight", self.instance.fifo_weight if self.instance else 10)
        total = job + service + family + disability + fifo
        if total != 100:
            raise serializers.ValidationError(
                f"Weights must sum to exactly 100. Current total: {total}"
            )
        return data


class AllocationLogSerializer(serializers.ModelSerializer):
    application_no = serializers.CharField(source="application.application_no", read_only=True)
    employee_name = serializers.CharField(source="application.employee_name", read_only=True)
    house_id = serializers.CharField(source="house.house_id", read_only=True, allow_null=True)
    performed_by_name = serializers.CharField(source="performed_by.name", read_only=True, allow_null=True)

    class Meta:
        model = AllocationLog
        fields = [
            "id", "application", "application_no", "employee_name",
            "house", "house_id", "action", "priority_score",
            "eligible_category", "notes", "performed_by", "performed_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class HouseInspectionSerializer(serializers.ModelSerializer):
    house_id = serializers.CharField(source="house.house_id", read_only=True)
    inspector_name = serializers.CharField(source="inspector.name", read_only=True, allow_null=True)

    class Meta:
        model = HouseInspection
        fields = [
            "id", "house", "house_id", "inspector", "inspector_name",
            "inspection_date", "inspection_type", "status", "findings",
            "notes", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class HouseMaintenanceRequestSerializer(serializers.ModelSerializer):
    house_id = serializers.CharField(source="house.house_id", read_only=True)
    house_number = serializers.CharField(source="house.house_number", read_only=True)
    reported_by_name = serializers.CharField(source="reported_by.name", read_only=True, allow_null=True)

    class Meta:
        model = HouseMaintenanceRequest
        fields = [
            "id", "house", "house_id", "house_number", "reported_by",
            "reported_by_name", "issue_title", "category", "priority",
            "status", "estimated_cost", "description", "resolved_at",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class HouseTransferSerializer(serializers.ModelSerializer):
    current_house_id = serializers.CharField(source="current_house.house_id", read_only=True, allow_null=True)
    target_house_id = serializers.CharField(source="target_house.house_id", read_only=True, allow_null=True)
    approved_by_name = serializers.CharField(source="approved_by.name", read_only=True, allow_null=True)

    class Meta:
        model = HouseTransfer
        fields = [
            "id", "transfer_no", "employee_id", "employee_name",
            "current_house", "current_house_id", "target_house", "target_house_id",
            "reason", "priority_score", "status", "approved_by",
            "approved_by_name", "completed_at", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "transfer_no", "created_at", "updated_at"]


class HouseNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = HouseNotification
        fields = [
            "id", "recipient", "title", "message", "notification_type",
            "is_read", "link", "created_at",
        ]
        read_only_fields = ["id", "recipient", "created_at"]
