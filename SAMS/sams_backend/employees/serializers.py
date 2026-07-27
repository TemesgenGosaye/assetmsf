"""
Serializers for the employees app.
"""
from rest_framework import serializers
from .models import Employee
from departments.models import Department


class EmployeeSerializer(serializers.ModelSerializer):
    """Full read serializer – includes computed and FK-display fields."""

    department_name = serializers.CharField(
        source="department.name", read_only=True, allow_null=True
    )
    service_years = serializers.IntegerField(read_only=True)

    class Meta:
        model = Employee
        fields = [
            "id",
            "employee_id",
            "full_name",
            "national_id",
            "job_position",
            "job_grade",
            "job_type",
            "department",
            "department_name",
            "hire_date",
            "service_years",
            "family_size",
            "has_disability",
            "status",
            "cv_file",
            "created_at",
            "updated_at",
            "is_active",
        ]
        read_only_fields = ["id", "employee_id", "created_at", "updated_at", "is_active"]


class EmployeeCreateUpdateSerializer(serializers.ModelSerializer):
    """Write serializer for creating and updating employees."""

    class Meta:
        model = Employee
        fields = [
            "full_name",
            "national_id",
            "job_position",
            "job_grade",
            "job_type",
            "department",
            "hire_date",
            "family_size",
            "has_disability",
            "status",
            "cv_file",
        ]

    def validate_national_id(self, value):
        """Ensure national_id is unique, ignoring the current instance on update."""
        qs = Employee.objects.filter(national_id=value, is_active=True)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "An employee with this national ID already exists."
            )
        return value

    def validate_department(self, value):
        """Ensure the department FK is active."""
        if value and not Department.objects.filter(id=value.id, is_active=True).exists():
            raise serializers.ValidationError("Department not found or inactive.")
        return value
