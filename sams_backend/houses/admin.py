from django.contrib import admin
from .models import House, HouseApplication, HouseInspection, MaintenanceRequest, HouseTransfer, RentalContract, RentalInvoice, RentalPayment


@admin.register(House)
class HouseAdmin(admin.ModelAdmin):
    list_display  = ("house_id", "location", "house_type", "status", "capacity",
                     "damaged_door", "damaged_windows", "damaged_walls",
                     "damaged_switch", "damaged_bulb", "damaged_water", "created_at")
    list_filter   = ("house_type", "status")
    search_fields = ("house_id", "location")
    ordering      = ("house_id",)
    readonly_fields = ("house_id", "created_at", "updated_at")


@admin.register(HouseApplication)
class HouseApplicationAdmin(admin.ModelAdmin):
    list_display = ("application_no", "employee_name", "employee_id", "national_id", "requested_house_category", "status", "created_at")
    list_filter = ("status", "requested_house_category", "gender")
    search_fields = ("application_no", "employee_name", "employee_id", "national_id")
    readonly_fields = ("application_no", "created_at", "updated_at")


@admin.register(HouseInspection)
class HouseInspectionAdmin(admin.ModelAdmin):
    list_display = ("house", "inspection_type", "status", "scheduled_date", "completed_date", "damage_costs")
    list_filter = ("inspection_type", "status")
    search_fields = ("house__house_id", "house__location")


@admin.register(MaintenanceRequest)
class MaintenanceRequestAdmin(admin.ModelAdmin):
    list_display = ("title", "house", "priority", "status", "cost", "created_at")
    list_filter = ("priority", "status")
    search_fields = ("title", "house__house_id")


@admin.register(HouseTransfer)
class HouseTransferAdmin(admin.ModelAdmin):
    list_display = ("employee", "current_house", "target_house", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("employee__employee_name", "target_house__house_id")


@admin.register(RentalContract)
class RentalContractAdmin(admin.ModelAdmin):
    list_display = ("contract_no", "tenant", "house", "monthly_rent", "start_date", "end_date", "status")
    list_filter = ("status",)
    search_fields = ("contract_no", "tenant__employee_name", "house__house_id")


@admin.register(RentalInvoice)
class RentalInvoiceAdmin(admin.ModelAdmin):
    list_display = ("invoice_no", "tenant", "billing_month", "due_date", "rent_amount", "balance", "status")
    list_filter = ("status", "billing_month")
    search_fields = ("invoice_no", "tenant__employee_name")


@admin.register(RentalPayment)
class RentalPaymentAdmin(admin.ModelAdmin):
    list_display = ("receipt_no", "invoice", "amount_paid", "payment_method", "created_at")
    list_filter = ("payment_method",)
    search_fields = ("receipt_no", "invoice__invoice_no")



