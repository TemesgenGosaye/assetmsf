"""
Serializers for the houses app — CRU, allocation, scoring, logs.
"""
from django.db import models
from rest_framework import serializers
from .models import (
    House, HouseApplication, HouseInspection, PostInspection, MaintenanceRequest,
    MaintenanceRequestLog, HouseTransfer, RentalContract, RentalInvoice, RentalPayment,
    ScoringConfig, EligibilityRule, AllocationLog,
    HouseOpportunity, Allocation, HouseAuditTrail, HouseHandoverReceipt,
    TerminationCase, TerminationTransaction,
)
from employees.models import Employee


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  HOUSE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class HouseSerializer(serializers.ModelSerializer):
    damaged_items = serializers.SerializerMethodField()
    allocation_status = serializers.SerializerMethodField()
    assigned_employee_id = serializers.SerializerMethodField()
    assigned_employee_name = serializers.SerializerMethodField()
    assigned_application_no = serializers.SerializerMethodField()
    current_occupancy = serializers.IntegerField(read_only=True, default=0)
    vacant = serializers.IntegerField(read_only=True, default=0)
    is_available = serializers.BooleanField(read_only=True, default=True)
    is_fully_vacant = serializers.BooleanField(read_only=True, default=False)
    room_vacant_count = serializers.IntegerField(read_only=True, default=0)
    available_rooms = serializers.SerializerMethodField()
    rooms = serializers.SerializerMethodField()
    rooms_summary = serializers.SerializerMethodField()

    class Meta:
        model = House
        fields = [
            "id", "house_id", "house_number", "location", "house_type", "status",
            "damaged_door", "damaged_windows", "damaged_walls",
            "damaged_switch", "damaged_bulb", "damaged_water",
            "damaged_items", "inside_items", "description", "capacity",
            "allocation_category",
            "room_count", "room_labels",
            "r1_status", "r1_occupant_name", "r1_occupant_id", "r1_notes",
            "r2_status", "r2_occupant_name", "r2_occupant_id", "r2_notes",
            "r3_status", "r3_occupant_name", "r3_occupant_id", "r3_notes",
            "rooms", "rooms_summary",
            "allocation_status", "assigned_employee_id",
            "assigned_employee_name", "assigned_application_no",
            "current_occupancy", "vacant", "is_available", "is_fully_vacant",
            "room_vacant_count", "available_rooms",
            "created_at", "updated_at", "is_active",
        ]
        read_only_fields = ["id", "house_id", "house_number", "room_count", "room_labels", "created_at", "updated_at", "is_active"]

    def get_allocation_status(self, obj):
        alloc = obj.allocation_records.filter(status=Allocation.Status.ACTIVE).first()
        return "Assigned" if alloc else "Unassigned"

    def get_assigned_employee_id(self, obj):
        alloc = obj.allocation_records.filter(status=Allocation.Status.ACTIVE).first()
        return alloc.employee_id if alloc else None

    def get_assigned_employee_name(self, obj):
        alloc = obj.allocation_records.filter(status=Allocation.Status.ACTIVE).first()
        return alloc.employee_name if alloc else None

    def get_assigned_application_no(self, obj):
        alloc = obj.allocation_records.filter(status=Allocation.Status.ACTIVE).first()
        return alloc.application.application_no if alloc else None

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

    def get_current_occupancy(self, obj):
        try:
            return obj.allocation_records.filter(status=Allocation.Status.ACTIVE).count()
        except Exception:
            return 0

    def get_vacant(self, obj):
        return obj.room_vacant_count

    def get_is_available(self, obj):
        return obj.status == "Active" and obj.room_vacant_count > 0

    def get_available_rooms(self, obj):
        return [r["label"] for r in obj.available_rooms]

    def get_rooms(self, obj):
        return obj.rooms

    def get_rooms_summary(self, obj):
        return obj.rooms_summary


class HouseCreateUpdateSerializer(serializers.ModelSerializer):
    populate_items = serializers.BooleanField(default=False, write_only=True)

    class Meta:
        model = House
        fields = [
            "location", "house_type", "status",
            "damaged_door", "damaged_windows", "damaged_walls",
            "damaged_switch", "damaged_bulb", "damaged_water",
            "inside_items", "description", "capacity",
            "allocation_category", "populate_items",
            "r1_status", "r1_occupant_name", "r1_occupant_id", "r1_notes",
            "r2_status", "r2_occupant_name", "r2_occupant_id", "r2_notes",
            "r3_status", "r3_occupant_name", "r3_occupant_id", "r3_notes",
        ]

    def validate_location(self, value):
        if not value.strip():
            raise serializers.ValidationError("Location cannot be blank.")
        return value.strip()

    def validate_capacity(self, value):
        if value < 1:
            raise serializers.ValidationError("Capacity must be at least 1.")
        return value

    def create(self, validated_data):
        populate = validated_data.pop("populate_items", False)
        if populate and not validated_data.get("inside_items"):
            validated_data["inside_items"] = ["Bed", "Chair", "Table", "Locker"]
        return super().create(validated_data)

    def update(self, instance, validated_data):
        populate = validated_data.pop("populate_items", False)
        if populate:
            validated_data["inside_items"] = ["Bed", "Chair", "Table", "Locker"]
        return super().update(instance, validated_data)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  APPLICATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class HouseApplicationListSerializer(serializers.ModelSerializer):
    requester_name = serializers.CharField(source="requester.name", read_only=True, default="")
    eligible_house_category = serializers.CharField(read_only=True, default="")
    priority_score = serializers.DecimalField(max_digits=8, decimal_places=4, read_only=True)
    queue_position = serializers.IntegerField(read_only=True, default=None)
    allocated_house_id = serializers.CharField(source="allocated_house.house_id", read_only=True, default=None)
    allocated_at = serializers.DateTimeField(read_only=True, default=None)
    allocated_by_name = serializers.CharField(source="allocated_by.name", read_only=True, default=None)
    allocated_resource = serializers.SerializerMethodField()

    class Meta:
        model = HouseApplication
        fields = [
            "id", "application_no", "requester", "requester_name",
            "employee_id", "employee_name", "national_id", "gender",
            "job_position", "job_grade", "job_type", "position_type",
            "years_of_service",
            "marital_status", "has_disability", "family_size", "number_of_children",
            "requested_house_category", "eligible_house_category", "allocation_mode",
            "reason_for_request", "preferred_location", "supporting_document",
            "priority_score", "queue_position", "score_breakdown",
            "eligibility_analysis", "allocation_confidence",
            "allocated_house_id", "allocated_room_label", "allocated_room_number",
            "allocated_resource", "allocated_at", "allocated_by_name",
            "allocation_notes", "status", "submitted_at", "created_at", "updated_at",
        ]

    def get_allocated_resource(self, obj):
        if not obj.allocated_house_id:
            return None
        base = obj.allocated_house.house_number or obj.allocated_house.house_id
        if obj.allocation_mode == "ROOM_ALLOCATION" and obj.allocated_room_label:
            return f"{base} — Room {obj.allocated_room_label}"
        return base


class HouseApplicationDetailSerializer(serializers.ModelSerializer):
    requester_name = serializers.CharField(source="requester.name", read_only=True, default="")
    reviewed_by_name = serializers.CharField(source="reviewed_by.name", read_only=True, default=None)
    eligible_house_category = serializers.CharField(read_only=True, default="")
    allocated_house_id = serializers.CharField(source="allocated_house.house_id", read_only=True, default=None)
    allocated_by_name = serializers.CharField(source="allocated_by.name", read_only=True, default=None)
    allocated_resource = serializers.SerializerMethodField()

    class Meta:
        model = HouseApplication
        fields = [
            "id", "application_no", "requester", "requester_name",
            "employee_id", "employee_name", "national_id", "gender",
            "job_position", "job_grade", "job_type", "position_type",
            "years_of_service",
            "marital_status", "has_disability", "family_size", "number_of_children",
            "requested_house_category", "eligible_house_category", "allocation_mode",
            "reason_for_request", "preferred_location", "supporting_document",
            "priority_score", "queue_position", "score_breakdown",
            "eligibility_analysis", "allocation_confidence",
            "allocated_house", "allocated_house_id", "allocated_room_label",
            "allocated_room_number", "allocated_resource", "allocated_at",
            "allocated_by", "allocated_by_name", "allocation_notes", "deallocation_reason",
            "status", "submitted_at", "reviewed_at", "reviewed_by", "reviewed_by_name",
            "rejection_reason", "returned_reason", "created_at", "updated_at", "is_active",
        ]
        read_only_fields = [
            "id", "application_no", "requester", "requester_name",
            "submitted_at", "reviewed_at", "reviewed_by", "reviewed_by_name",
            "allocated_at", "allocated_by", "allocated_by_name",
            "created_at", "updated_at", "is_active",
        ]

    def get_allocated_resource(self, obj):
        if not obj.allocated_house_id:
            return None
        base = obj.allocated_house.house_number or obj.allocated_house.house_id
        if obj.allocation_mode == "ROOM_ALLOCATION" and obj.allocated_room_label:
            return f"{base} — Room {obj.allocated_room_label}"
        return base


class HouseApplicationCreateSerializer(serializers.ModelSerializer):
    supporting_document = serializers.FileField(required=False, allow_null=True)

    class Meta:
        model = HouseApplication
        fields = [
            "employee_id", "employee_name", "national_id", "gender",
            "job_position", "job_grade", "job_type", "position_type",
            "years_of_service",
            "marital_status", "has_disability", "family_size", "number_of_children",
            "requested_house_category", "reason_for_request", "preferred_location",
            "supporting_document", "status",
        ]

    def validate_employee_id(self, value):
        emp = Employee.objects.filter(employee_id__iexact=value, status="Active").first()
        if not emp:
            raise serializers.ValidationError(
                f"Employee '{value}' does not exist or is not active."
            )
        
        has_alloc = Allocation.objects.filter(
            models.Q(employee_id__iexact=emp.employee_id) | models.Q(emp_record=emp),
            status=Allocation.Status.ACTIVE
        ).exists() or HouseApplication.objects.filter(
            models.Q(employee_id__iexact=emp.employee_id) | models.Q(emp_record=emp),
            status=HouseApplication.Status.ALLOCATED
        ).exists()

        if has_alloc:
            raise serializers.ValidationError(
                f"Employee '{value}' ({emp.full_name}) already has an active house allocation and cannot submit a new application."
            )
        return emp.employee_id

    def _link_employee(self, instance):
        if instance.employee_id:
            try:
                emp = Employee.objects.get(employee_id=instance.employee_id, status="Active")
                instance.emp_record = emp
            except Employee.DoesNotExist:
                pass

    def create(self, validated_data):
        instance = super().create(validated_data)
        self._link_employee(instance)
        if instance.emp_record:
            instance.save(update_fields=["emp_record"])
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        self._link_employee(instance)
        if instance.emp_record:
            instance.save(update_fields=["emp_record"])
        return instance


class HouseApplicationStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = HouseApplication
        fields = ["status", "rejection_reason", "returned_reason"]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  SCORING CONFIG
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class ScoringConfigSerializer(serializers.ModelSerializer):
    total_weight = serializers.IntegerField(read_only=True)

    class Meta:
        model = ScoringConfig
        fields = [
            "id", "name",
            "job_grade_weight", "years_of_service_weight",
            "family_size_weight", "disability_weight", "fifo_weight",
            "marital_status_weight", "employment_type_weight",
            "medical_priority_weight",
            "total_weight", "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  ELIGIBILITY RULE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class EligibilityRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = EligibilityRule
        fields = [
            "id", "min_grade", "max_grade", "house_type",
            "gender_eligibility", "requires_family", "min_family_size",
            "description", "priority", "is_active",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  ALLOCATION LOG
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class AllocationLogSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.CharField(read_only=True, default="")
    resource = serializers.SerializerMethodField()

    class Meta:
        model = AllocationLog
        fields = [
            "id", "application", "application_no",
            "employee_name", "employee_id",
            "house", "house_hid",
            "allocation_unit_type", "room_label", "room_number", "resource",
            "action", "old_status", "new_status",
            "priority_score", "eligible_category",
            "score_breakdown", "recommendation_reason",
            "notes", "performed_by", "performed_by_name", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_resource(self, obj):
        base = obj.house_hid or (obj.house.house_id if obj.house else "")
        if obj.allocation_unit_type == "ROOM_ALLOCATION" and obj.room_label:
            return f"{base} — Room {obj.room_label}"
        return base


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  HOUSE OPPORTUNITY  (house_opp)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class HouseOpportunitySerializer(serializers.ModelSerializer):
    house_id = serializers.CharField(source="house.house_id", read_only=True, default="")
    house_number = serializers.CharField(source="house.house_number", read_only=True, default="")
    house_type = serializers.CharField(source="house.house_type", read_only=True, default="")
    house_location = serializers.CharField(source="house.location", read_only=True, default="")
    house_status = serializers.CharField(source="house.status", read_only=True, default="")
    house_capacity = serializers.IntegerField(source="house.capacity", read_only=True, default=0)
    house_occupancy = serializers.IntegerField(read_only=True, default=0)
    house_vacant = serializers.IntegerField(read_only=True, default=0)
    house_available = serializers.BooleanField(read_only=True, default=False)
    application_no = serializers.CharField(source="application.application_no", read_only=True, default="")
    resource_label = serializers.CharField(read_only=True, default="")

    class Meta:
        model = HouseOpportunity
        fields = [
            "id", "application", "application_no",
            "house", "house_id", "house_number", "house_type", "house_location",
            "house_status", "house_capacity", "house_occupancy", "house_vacant",
            "house_available",
            "allocation_mode", "room_label", "room_number", "resource_label",
            "eligible_category", "compatibility_score", "priority_score",
            "match_reasons", "recommendation", "recommendation_reason",
            "status", "rank", "notes",
            "created_at", "updated_at", "is_active",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_house_occupancy(self, obj):
        return obj.house.current_occupancy


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  ALLOCATION  (Allocated House)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class AllocationSerializer(serializers.ModelSerializer):
    application_no = serializers.CharField(source="application.application_no", read_only=True, default="")
    house_id = serializers.CharField(source="house.house_id", read_only=True, default="")
    house_number = serializers.CharField(source="house.house_number", read_only=True, default="")
    house_type = serializers.CharField(source="house.house_type", read_only=True, default="")
    house_location = serializers.CharField(source="house.location", read_only=True, default="")
    employee = serializers.SerializerMethodField()
    allocated_by_name = serializers.CharField(source="allocated_by.name", read_only=True, default="")
    terminated_by_name = serializers.CharField(source="terminated_by.name", read_only=True, default="")
    opportunity_id = serializers.SerializerMethodField()
    resource = serializers.CharField(read_only=True, default="")

    class Meta:
        model = Allocation
        fields = [
            "id", "allocation_no",
            "application", "application_no",
            "house", "house_id", "house_number", "house_type", "house_location",
            "employee", "employee_id", "employee_name",
            "allocation_unit_type", "room_label", "room_number", "room_status",
            "marital_status", "family_size", "resource",
            "allocation_type", "priority_score", "recommendation_score",
            "confidence", "recommendation_reason",
            "status", "occupancy_status",
            "allocated_at", "effective_date", "allocated_by", "allocated_by_name",
            "override_reason", "notes", "previous_allocation",
            "terminated_at", "terminated_by", "terminated_by_name", "termination_reason",
            "opportunity_id",
            "created_at", "updated_at", "is_active",
        ]
        read_only_fields = ["id", "allocation_no", "created_at", "updated_at", "is_active"]

    def get_employee(self, obj):
        if obj.employee_id:
            return {
                "id": obj.employee_id,
                "name": obj.employee_name,
            }
        return None

    def get_opportunity_id(self, obj):
        try:
            return str(obj.application.opportunities.get(house=obj.house).id)
        except HouseOpportunity.DoesNotExist:
            return None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  HOUSE AUDIT TRAIL
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class HouseAuditTrailSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(read_only=True, default="")

    class Meta:
        model = HouseAuditTrail
        fields = [
            "id", "application", "action", "actor", "actor_name",
            "old_status", "new_status", "detail", "note", "ip_address",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  OTHER EXISTING SERIALIZERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class HouseInspectionSerializer(serializers.ModelSerializer):
    house_hid = serializers.CharField(source="house.house_id", read_only=True, default="")
    inspector_name = serializers.SerializerMethodField()
    requested_by_name = serializers.CharField(source="created_by.name", read_only=True, default="")

    class Meta:
        model = HouseInspection
        fields = [
            "id", "house", "house_hid", "house_number", "house_location", "house_type",
            "allocation_category", "capacity", "room_count", "room_labels",
            "r1_status", "r1_occupant_name", "r1_occupant_id", "r1_notes",
            "r2_status", "r2_occupant_name", "r2_occupant_id", "r2_notes",
            "r3_status", "r3_occupant_name", "r3_occupant_id", "r3_notes",
            "damaged_door", "damaged_windows", "damaged_walls",
            "damaged_switch", "damaged_bulb", "damaged_water",
            "inside_items", "description",
            "inspector", "inspector_name", "inspection_type", "status",
            "scheduled_date", "completed_date", "findings", "damage_costs",
            "checklist_results", "overall_condition", "repair_required",
            "estimated_repair_cost", "employee_id", "employee_name",
            "requested_by_name",
            "created_at", "updated_at", "is_active",
        ]
        read_only_fields = ["id", "completed_date", "created_at", "updated_at", "is_active"]

    def get_inspector_name(self, obj):
        return obj.inspector.get_full_name() if obj.inspector else ""


class PostInspectionSerializer(serializers.ModelSerializer):
    """PostInspection shares the complete column structure with House and HouseInspection."""
    house_hid = serializers.CharField(source="house.house_id", read_only=True, default="")
    inspector_name = serializers.SerializerMethodField()
    allocation_no = serializers.CharField(source="allocation.allocation_no", read_only=True, default="")
    requested_by_name = serializers.CharField(source="created_by.name", read_only=True, default="")

    class Meta:
        model = PostInspection
        fields = [
            "id", "house", "house_hid", "house_number", "house_location", "house_type",
            "allocation", "allocation_no",
            "allocation_category", "capacity", "room_count", "room_labels",
            "r1_status", "r1_occupant_name", "r1_occupant_id", "r1_notes",
            "r2_status", "r2_occupant_name", "r2_occupant_id", "r2_notes",
            "r3_status", "r3_occupant_name", "r3_occupant_id", "r3_notes",
            "damaged_door", "damaged_windows", "damaged_walls",
            "damaged_switch", "damaged_bulb", "damaged_water",
            "inside_items", "description",
            "inspector", "inspector_name", "inspection_type", "status",
            "scheduled_date", "completed_date", "findings", "damage_costs",
            "checklist_results", "overall_condition", "repair_required",
            "estimated_repair_cost", "employee_id", "employee_name",
            "allocation_status_snapshot", "house_status_snapshot",
            "requested_by_name",
            "created_at", "updated_at", "is_active",
        ]
        read_only_fields = [
            "id", "completed_date", "created_at", "updated_at", "is_active",
            "allocation_status_snapshot", "house_status_snapshot",
        ]

    def get_inspector_name(self, obj):
        return obj.inspector.get_full_name() if obj.inspector else ""


class MaintenanceRequestLogSerializer(serializers.ModelSerializer):
    actor_name_display = serializers.CharField(source="actor.name", read_only=True, default="")

    class Meta:
        model = MaintenanceRequestLog
        fields = [
            "id", "request", "event_type", "actor", "actor_name",
            "actor_name_display", "old_value", "new_value", "note", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class MaintenanceRequestSerializer(serializers.ModelSerializer):
    house_hid = serializers.CharField(source="house.house_id", read_only=True, default="")
    house_number = serializers.CharField(source="house.house_number", read_only=True, default="")
    house_location = serializers.CharField(source="house.location", read_only=True, default="")
    house_type = serializers.CharField(source="house.house_type", read_only=True, default="")
    requested_by_name = serializers.CharField(source="requested_by.name", read_only=True, default="")
    requested_by_email = serializers.CharField(source="requested_by.email", read_only=True, default="")
    received_by_name = serializers.CharField(source="received_by.name", read_only=True, default="")
    civil_work_assigned_to_name = serializers.CharField(source="civil_work_assigned_to.name", read_only=True, default="")
    request_number = serializers.ReadOnlyField()
    logs = MaintenanceRequestLogSerializer(many=True, read_only=True)

    class Meta:
        model = MaintenanceRequest
        fields = [
            "id", "request_number",
            "house", "house_hid", "house_number", "house_location", "house_type",
            "requested_by", "requested_by_name", "requested_by_email",
            "title", "description", "category", "priority", "status",
            "received_by", "received_by_name", "received_at",
            "civil_work_assigned_to", "civil_work_assigned_to_name",
            "civil_work_notes", "rejection_reason", "resolution_notes",
            "estimated_cost", "actual_cost",
            "resolved_at", "completion_date",
            "logs",
            "created_at", "updated_at", "is_active",
        ]
        read_only_fields = [
            "id", "resolved_at", "completion_date",
            "created_at", "updated_at", "is_active",
        ]


class MaintenanceRequestCreateSerializer(serializers.ModelSerializer):
    """Serializer for applicants submitting maintenance requests."""

    class Meta:
        model = MaintenanceRequest
        fields = [
            "house", "title", "description", "category", "priority",
        ]

    def validate_house(self, value):
        """Verify the applicant has an active allocation for this house."""
        user = self.context["request"].user
        from houses.models import Allocation
        has_allocation = Allocation.objects.filter(
            house=value,
            application__requester=user,
            status=Allocation.Status.ACTIVE,
        ).exists()
        if not has_allocation:
            raise serializers.ValidationError("You do not have an active allocation for this house.")
        return value


class MaintenanceRequestCivilWorkUpdateSerializer(serializers.ModelSerializer):
    """Serializer for Civil Work department updating maintenance requests."""

    class Meta:
        model = MaintenanceRequest
        fields = [
            "status", "priority", "civil_work_assigned_to",
            "civil_work_notes", "rejection_reason", "resolution_notes",
            "estimated_cost", "actual_cost", "category",
        ]

    def validate_status(self, value):
        """Validate status transition."""
        if self.instance:
            current = self.instance.status
            valid_transitions = {
                "Submitted": ["Received", "Cancelled"],
                "Received": ["In Progress", "On Hold", "Rejected", "Cancelled"],
                "In Progress": ["On Hold", "Completed", "Cancelled"],
                "On Hold": ["In Progress", "Cancelled"],
                "Completed": [],
                "Rejected": [],
                "Cancelled": [],
            }
            allowed = valid_transitions.get(current, [])
            if value not in allowed:
                raise serializers.ValidationError(
                    f"Cannot transition from '{current}' to '{value}'. Allowed: {', '.join(allowed) or 'none'}"
                )
        return value


class HouseTransferSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True, default="")
    employee_id = serializers.CharField(source="employee.employee_id", read_only=True, default="")
    current_house_hid = serializers.CharField(source="current_house.house_id", read_only=True, default=None)
    target_house_hid = serializers.CharField(source="target_house.house_id", read_only=True, default="")
    approved_by_name = serializers.CharField(source="approved_by.name", read_only=True, default="")

    class Meta:
        model = HouseTransfer
        fields = [
            "id", "employee", "employee_name", "employee_id",
            "current_house", "current_house_hid",
            "target_house", "target_house_hid",
            "reason", "status", "approved_by", "approved_by_name",
            "created_at", "updated_at", "is_active",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "is_active"]


class RentalContractSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source="tenant.full_name", read_only=True, default="")
    tenant_id = serializers.CharField(source="tenant.employee_id", read_only=True, default="")
    house_hid = serializers.CharField(source="house.house_id", read_only=True, default="")
    house_location = serializers.CharField(source="house.location", read_only=True, default="")
    application_no = serializers.CharField(source="application.application_no", read_only=True, default=None)

    class Meta:
        model = RentalContract
        fields = [
            "id", "contract_no", "tenant", "tenant_name", "tenant_id",
            "house", "house_hid", "house_location",
            "application", "application_no",
            "start_date", "end_date", "monthly_rent", "security_deposit",
            "status", "terms_conditions",
            "created_at", "updated_at", "is_active",
        ]
        read_only_fields = ["id", "contract_no", "created_at", "updated_at", "is_active"]


class RentalInvoiceSerializer(serializers.ModelSerializer):
    contract_no = serializers.CharField(source="contract.contract_no", read_only=True, default="")
    tenant_name = serializers.CharField(source="tenant.full_name", read_only=True, default="")
    tenant_id = serializers.CharField(source="tenant.employee_id", read_only=True, default="")
    house_hid = serializers.CharField(source="contract.house.house_id", read_only=True, default="")

    class Meta:
        model = RentalInvoice
        fields = [
            "id", "invoice_no", "contract", "contract_no", "tenant",
            "tenant_name", "tenant_id", "house_hid",
            "billing_month", "due_date", "rent_amount", "penalty_amount",
            "paid_amount", "balance", "status",
            "created_at", "updated_at", "is_active",
        ]
        read_only_fields = ["id", "invoice_no", "balance", "created_at", "updated_at", "is_active"]


class RentalPaymentSerializer(serializers.ModelSerializer):
    invoice_no = serializers.CharField(source="invoice.invoice_no", read_only=True, default="")
    tenant_name = serializers.CharField(source="invoice.tenant.full_name", read_only=True, default="")
    recorded_by_name = serializers.CharField(source="recorded_by.name", read_only=True, default="")

    class Meta:
        model = RentalPayment
        fields = [
            "id", "receipt_no", "invoice", "invoice_no", "tenant_name",
            "amount_paid", "payment_method", "reference_no", "notes",
            "recorded_by", "recorded_by_name",
            "created_at", "updated_at", "is_active",
        ]
        read_only_fields = ["id", "receipt_no", "created_at", "updated_at", "is_active"]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  HOUSE HANDOVER RECEIPT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class HouseHandoverReceiptSerializer(serializers.ModelSerializer):
    """Full serializer for the official Metahara Sugar Factory handover receipt."""

    generated_by_name   = serializers.CharField(read_only=True, default="")
    printed_by_name     = serializers.CharField(read_only=True, default="")
    is_printed          = serializers.SerializerMethodField()
    house_room_count    = serializers.IntegerField(source="house.room_count", read_only=True, default=1)

    class Meta:
        model  = HouseHandoverReceipt
        fields = [
            "id", "doc_number", "doc_status",
            # relations
            "allocation", "application", "house",
            # employee snapshot
            "employee_id", "employee_name", "job_position", "job_grade",
            "department", "national_id", "marital_status", "family_size",
            # house snapshot
            "house_number", "house_type", "house_location",
            "room_count", "house_room_count",
            "allocation_no", "application_no", "allocation_date",
            # inspection findings (all 4 sections)
            "inspection_electrical", "inspection_structural",
            "inspection_water", "inspection_admin",
            # committee
            "committee_members",
            # generation
            "generated_date", "generated_by", "generated_by_name",
            # print tracking
            "first_printed_at", "last_printed_at",
            "printed_by", "printed_by_name",
            "reprint_count", "is_printed",
            "audit_history",
            # base
            "created_at", "updated_at", "is_active",
        ]
        read_only_fields = [
            "id", "doc_number", "generated_date",
            "generated_by_name", "printed_by_name",
            "first_printed_at", "last_printed_at",
            "reprint_count", "is_printed",
            "audit_history", "house_room_count",
            "created_at", "updated_at", "is_active",
        ]

    def get_is_printed(self, obj) -> bool:
        return obj.first_printed_at is not None


class HouseHandoverReceiptCreateSerializer(serializers.Serializer):
    """Input serializer for creating/generating a handover receipt from an allocation."""
    allocation_id = serializers.UUIDField(required=True)

    def validate_allocation_id(self, value):
        try:
            Allocation.objects.get(id=value, is_active=True)
        except Allocation.DoesNotExist:
            raise serializers.ValidationError("Allocation not found or inactive.")
        return value


class HouseHandoverReceiptUpdateSerializer(serializers.ModelSerializer):
    """Allows editing inspection notes and committee members before printing."""

    class Meta:
        model  = HouseHandoverReceipt
        fields = [
            "inspection_electrical", "inspection_structural",
            "inspection_water", "inspection_admin",
            "committee_members", "doc_status",
        ]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  TERMINATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TerminationCaseSerializer(serializers.ModelSerializer):
    class Meta:
        model  = TerminationCase
        fields = [
            "id", "code", "name", "category", "description",
            "requires_inspection", "requires_approval", "requires_documents",
            "allowed_employment_types", "auto_verify_employment",
            "priority", "is_active",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class TerminationTransactionSerializer(serializers.ModelSerializer):
    case_code         = serializers.CharField(source="case.code", read_only=True)
    case_name         = serializers.CharField(source="case.name", read_only=True)
    case_category     = serializers.CharField(source="case.category", read_only=True)
    case_requires_inspection = serializers.CharField(source="case.requires_inspection", read_only=True)
    allocation_no     = serializers.CharField(source="allocation.allocation_no", read_only=True)
    application_no    = serializers.CharField(source="application.application_no", read_only=True)
    approved_by_name  = serializers.SerializerMethodField()
    created_by_name   = serializers.SerializerMethodField()
    code_generated_by_name = serializers.SerializerMethodField()
    code_verified_by_name  = serializers.SerializerMethodField()
    house_resource    = serializers.SerializerMethodField()
    target_house_number = serializers.SerializerMethodField()
    authorization_code_masked = serializers.SerializerMethodField()

    class Meta:
        model  = TerminationTransaction
        fields = [
            "id", "termination_no",
            "allocation", "allocation_no",
            "application", "application_no",
            "case", "case_code", "case_name", "case_category", "case_requires_inspection",
            "employee_id", "employee_name",
            "house", "house_number", "house_type", "room_label", "house_resource",
            "termination_reason",
            "effective_date", "requested_date", "house_release_date",
            "status", "handover_status", "inspection_status",
            "inspection_baseline", "inspection_discrepancies",
            "issues_resolved", "handover_completed",
            "damage_assessment", "outstanding_issues", "damage_costs",
            "approval_status", "approved_by", "approved_by_name",
            "approval_date", "approval_notes",
            "authorization_code", "authorization_code_masked",
            "code_generated_at", "code_generated_by", "code_generated_by_name",
            "code_verified", "code_verified_at", "code_verified_by", "code_verified_by_name",
            "target_house", "target_house_number", "target_allocation",
            "remarks", "supporting_document",
            "created_by", "created_by_name",
            "created_at", "updated_at", "is_active",
        ]
        read_only_fields = [
            "id", "termination_no",
            "inspection_baseline", "inspection_discrepancies",
            "issues_resolved", "handover_completed",
            "authorization_code", "authorization_code_masked",
            "code_generated_at", "code_generated_by",
            "code_verified", "code_verified_at", "code_verified_by",
            "created_at", "updated_at",
        ]

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return getattr(obj.approved_by, "name", "") or getattr(obj.approved_by, "username", "")
        return ""

    def get_created_by_name(self, obj):
        if obj.created_by:
            return getattr(obj.created_by, "name", "") or getattr(obj.created_by, "username", "")
        return ""

    def get_code_generated_by_name(self, obj):
        if obj.code_generated_by:
            return getattr(obj.code_generated_by, "name", "") or getattr(obj.code_generated_by, "username", "")
        return ""

    def get_code_verified_by_name(self, obj):
        if obj.code_verified_by:
            return getattr(obj.code_verified_by, "name", "") or getattr(obj.code_verified_by, "username", "")
        return ""

    def get_house_resource(self, obj):
        base = obj.house_number or ""
        if obj.room_label:
            return f"{base} — Room {obj.room_label}"
        return base

    def get_target_house_number(self, obj):
        if obj.target_house:
            return obj.target_house.house_number or obj.target_house.house_id
        return ""

    def get_authorization_code_masked(self, obj):
        return obj.authorization_code or ""


class TerminationCreateSerializer(serializers.Serializer):
    """Input serializer for creating a termination transaction."""
    allocation_id  = serializers.UUIDField(required=True)
    case_id        = serializers.UUIDField(required=True)
    effective_date = serializers.DateField(required=True)
    reason         = serializers.CharField(required=True, allow_blank=False)
    target_house_id = serializers.CharField(required=False, allow_blank=True, default="")
    remarks        = serializers.CharField(required=False, allow_blank=True, default="")
    requested_date = serializers.DateField(required=False, allow_null=True, default=None)

    def validate_allocation_id(self, value):
        try:
            Allocation.objects.get(id=value, is_active=True)
        except Allocation.DoesNotExist:
            raise serializers.ValidationError("Allocation not found or inactive.")
        return value

    def validate_case_id(self, value):
        try:
            TerminationCase.objects.get(id=value, is_active=True)
        except TerminationCase.DoesNotExist:
            raise serializers.ValidationError("Termination case not found or inactive.")
        return value


class TerminationApprovalSerializer(serializers.Serializer):
    """Input serializer for approving/rejecting a termination."""
    decision = serializers.ChoiceField(choices=["Approved", "Rejected"], required=True)
    notes    = serializers.CharField(required=False, allow_blank=True, default="")


class TerminationVerifyCodeSerializer(serializers.Serializer):
    """Input serializer for verifying the termination authorization code."""
    authorization_code = serializers.CharField(required=True, min_length=4)


class TerminationResolveIssuesSerializer(serializers.Serializer):
    """Input serializer for resolving inspection discrepancies."""
    resolution_notes = serializers.CharField(required=False, allow_blank=True, default="")
    force            = serializers.BooleanField(required=False, default=False)


class TerminateWithCodeSerializer(serializers.Serializer):
    """Input serializer for terminating an allocation using an authorization code."""
    authorization_code = serializers.CharField(required=True, min_length=4)
    reason             = serializers.CharField(required=False, allow_blank=True, default="")

