"""
Serializers for the houses app — CRU, allocation, scoring, logs.
"""
from rest_framework import serializers
from .models import (
    House, HouseApplication, HouseInspection, MaintenanceRequest,
    HouseTransfer, RentalContract, RentalInvoice, RentalPayment,
    ScoringConfig, EligibilityRule, AllocationLog,
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

    class Meta:
        model = House
        fields = [
            "id", "house_id", "house_number", "location", "house_type", "status",
            "damaged_door", "damaged_windows", "damaged_walls",
            "damaged_switch", "damaged_bulb", "damaged_water",
            "damaged_items", "inside_items", "description", "capacity",
            "allocation_category",
            "allocation_status", "assigned_employee_id",
            "assigned_employee_name", "assigned_application_no",
            "current_occupancy", "vacant", "is_available",
            "created_at", "updated_at", "is_active",
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
            return obj.allocations.filter(status="Allocated", is_active=True).count()
        except Exception:
            return 0

    def get_vacant(self, obj):
        occ = self.get_current_occupancy(obj)
        return max(obj.capacity - occ, 0)

    def get_is_available(self, obj):
        return obj.status == "Active" and self.get_vacant(obj) > 0


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

    class Meta:
        model = HouseApplication
        fields = [
            "id", "application_no", "requester", "requester_name",
            "employee_id", "employee_name", "national_id", "gender",
            "job_position", "job_grade", "job_type", "position_type",
            "years_of_service",
            "marital_status", "has_disability", "family_size", "number_of_children",
            "requested_house_category", "eligible_house_category",
            "reason_for_request", "preferred_location", "supporting_document",
            "priority_score", "queue_position", "score_breakdown",
            "allocated_house_id", "allocated_at", "allocated_by_name",
            "allocation_notes", "status", "submitted_at", "created_at", "updated_at",
        ]


class HouseApplicationDetailSerializer(serializers.ModelSerializer):
    requester_name = serializers.CharField(source="requester.name", read_only=True, default="")
    reviewed_by_name = serializers.CharField(source="reviewed_by.name", read_only=True, default=None)
    eligible_house_category = serializers.CharField(read_only=True, default="")
    allocated_house_id = serializers.CharField(source="allocated_house.house_id", read_only=True, default=None)
    allocated_by_name = serializers.CharField(source="allocated_by.name", read_only=True, default=None)

    class Meta:
        model = HouseApplication
        fields = [
            "id", "application_no", "requester", "requester_name",
            "employee_id", "employee_name", "national_id", "gender",
            "job_position", "job_grade", "job_type", "position_type",
            "years_of_service",
            "marital_status", "has_disability", "family_size", "number_of_children",
            "requested_house_category", "eligible_house_category",
            "reason_for_request", "preferred_location", "supporting_document",
            "priority_score", "queue_position", "score_breakdown",
            "allocated_house", "allocated_house_id", "allocated_at",
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
        if not Employee.objects.filter(employee_id=value, status="Active").exists():
            raise serializers.ValidationError(
                f"Employee '{value}' does not exist or is not active."
            )
        return value

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

    class Meta:
        model = AllocationLog
        fields = [
            "id", "application", "application_no",
            "employee_name", "employee_id",
            "house", "house_hid",
            "action", "old_status", "new_status",
            "priority_score", "eligible_category",
            "score_breakdown", "recommendation_reason",
            "notes", "performed_by", "performed_by_name", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  OTHER EXISTING SERIALIZERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class HouseInspectionSerializer(serializers.ModelSerializer):
    house_hid = serializers.CharField(source="house.house_id", read_only=True, default="")
    house_location = serializers.CharField(source="house.location", read_only=True, default="")
    house_type = serializers.CharField(source="house.house_type", read_only=True, default="")
    inspector_name = serializers.SerializerMethodField()
    requested_by_name = serializers.CharField(source="created_by.name", read_only=True, default="")

    class Meta:
        model = HouseInspection
        fields = [
            "id", "house", "house_hid", "house_location", "house_type",
            "inspector", "inspector_name", "inspection_type", "status",
            "scheduled_date", "completed_date", "findings", "damage_costs",
            "checklist_results", "requested_by_name",
            "created_at", "updated_at", "is_active",
        ]
        read_only_fields = ["id", "completed_date", "created_at", "updated_at", "is_active"]

    def get_inspector_name(self, obj):
        return obj.inspector.get_full_name() if obj.inspector else ""


class MaintenanceRequestSerializer(serializers.ModelSerializer):
    house_hid = serializers.CharField(source="house.house_id", read_only=True, default="")
    house_location = serializers.CharField(source="house.location", read_only=True, default="")
    house_type = serializers.CharField(source="house.house_type", read_only=True, default="")
    requested_by_name = serializers.CharField(source="requested_by.name", read_only=True, default="")

    class Meta:
        model = MaintenanceRequest
        fields = [
            "id", "house", "house_hid", "house_location", "house_type",
            "requested_by", "requested_by_name", "title", "description",
            "priority", "status", "cost", "assigned_to", "resolved_at",
            "created_at", "updated_at", "is_active",
        ]
        read_only_fields = ["id", "resolved_at", "created_at", "updated_at", "is_active"]


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
