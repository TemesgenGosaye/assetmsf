from django.contrib import admin
from .models import (
    House, HouseApplication, HouseInspection, MaintenanceRequest,
    HouseTransfer, RentalContract, RentalInvoice, RentalPayment,
    ScoringConfig, EligibilityRule, AllocationLog,
)


@admin.register(House)
class HouseAdmin(admin.ModelAdmin):
    list_display  = ("house_id", "location", "house_type", "status", "capacity", "created_at")
    list_filter   = ("house_type", "status")
    search_fields = ("house_id", "location")
    ordering      = ("house_id",)
    readonly_fields = ("house_id", "created_at", "updated_at")


@admin.register(HouseApplication)
class HouseApplicationAdmin(admin.ModelAdmin):
    list_display  = ("application_no", "employee_name", "employee_id", "requested_house_category", "priority_score", "status", "created_at")
    list_filter   = ("status", "requested_house_category", "gender")
    search_fields = ("application_no", "employee_name", "employee_id", "national_id")
    readonly_fields = ("application_no", "priority_score", "created_at", "updated_at")


@admin.register(ScoringConfig)
class ScoringConfigAdmin(admin.ModelAdmin):
    list_display = ("name", "job_grade_weight", "years_of_service_weight", "family_size_weight", "disability_weight", "fifo_weight", "is_active")
    list_filter  = ("is_active",)


@admin.register(EligibilityRule)
class EligibilityRuleAdmin(admin.ModelAdmin):
    list_display  = ("min_grade", "max_grade", "house_type", "gender_eligibility", "requires_family", "priority", "is_active")
    list_filter   = ("house_type", "gender_eligibility", "is_active")
    ordering      = ("priority", "min_grade")


@admin.register(AllocationLog)
class AllocationLogAdmin(admin.ModelAdmin):
    list_display  = ("application_no", "employee_name", "house_id", "action", "priority_score", "performed_by_name", "created_at")
    list_filter   = ("action",)
    search_fields = ("application_no", "employee_name", "employee_id")
    readonly_fields = [f.name for f in AllocationLog._meta.get_fields()]


@admin.register(HouseInspection)
class HouseInspectionAdmin(admin.ModelAdmin):
    list_display  = ("house", "inspection_type", "status", "scheduled_date", "completed_date", "damage_costs")
    list_filter   = ("inspection_type", "status")
    search_fields = ("house__house_id",)


@admin.register(MaintenanceRequest)
class MaintenanceRequestAdmin(admin.ModelAdmin):
    list_display  = ("title", "house", "priority", "status", "cost", "created_at")
    list_filter   = ("priority", "status")
    search_fields = ("title", "house__house_id")


@admin.register(HouseTransfer)
class HouseTransferAdmin(admin.ModelAdmin):
    list_display  = ("employee", "current_house", "target_house", "status", "created_at")
    list_filter   = ("status",)
    search_fields = ("employee__full_name",)


@admin.register(RentalContract)
class RentalContractAdmin(admin.ModelAdmin):
    list_display  = ("contract_no", "tenant", "house", "monthly_rent", "start_date", "end_date", "status")
    list_filter   = ("status",)
    search_fields = ("contract_no",)


@admin.register(RentalInvoice)
class RentalInvoiceAdmin(admin.ModelAdmin):
    list_display  = ("invoice_no", "tenant", "billing_month", "due_date", "rent_amount", "balance", "status")
    list_filter   = ("status",)


@admin.register(RentalPayment)
class RentalPaymentAdmin(admin.ModelAdmin):
    list_display  = ("receipt_no", "invoice", "amount_paid", "payment_method", "created_at")
    list_filter   = ("payment_method",)
    search_fields = ("receipt_no",)
