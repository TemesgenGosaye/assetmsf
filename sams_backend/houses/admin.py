from django.contrib import admin
from .models import House


@admin.register(House)
class HouseAdmin(admin.ModelAdmin):
    list_display  = ("house_id", "location", "house_type", "status", "capacity",
                     "damaged_door", "damaged_windows", "damaged_walls",
                     "damaged_switch", "damaged_bulb", "damaged_water", "created_at")
    list_filter   = ("house_type", "status")
    search_fields = ("house_id", "location")
    ordering      = ("house_id",)
    readonly_fields = ("house_id", "created_at", "updated_at")
