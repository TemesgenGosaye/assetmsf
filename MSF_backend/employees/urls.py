"""
URL configuration for employees app.
"""
from django.urls import path
from .views import EmployeeListCreateView, EmployeeDetailView, employee_bulk_import

urlpatterns = [
    # Fixed paths must come before parameterised ones
    path("", EmployeeListCreateView.as_view(), name="employee_list_create"),
    path("bulk-import/", employee_bulk_import, name="employee_bulk_import"),
    path("<uuid:id>/", EmployeeDetailView.as_view(), name="employee_detail"),
]
