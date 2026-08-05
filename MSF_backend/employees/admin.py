from django.contrib import admin
from .models import Employee


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = [
        "employee_id",
        "full_name",
        "national_id",
        "job_position",
        "job_grade",
        "department",
        "hire_date",
        "status",
        "has_disability",
        "is_active",
    ]
    list_filter = ["status", "department", "has_disability", "is_active"]
    search_fields = ["employee_id", "full_name", "national_id", "job_position"]
    ordering = ["employee_id"]
    readonly_fields = ["employee_id", "created_at", "updated_at", "created_by", "updated_by"]
