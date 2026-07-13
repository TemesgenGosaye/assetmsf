from django.urls import path
from .views import (
    HouseListCreateView, HouseDetailView,
    HouseApplicationListCreateView, HouseApplicationDetailView,
    HouseApplicationSubmitView, HouseApplicationStatusUpdateView,
    HouseApplicationDashboardView,
)

urlpatterns = [
    path("",                          HouseListCreateView.as_view(),           name="house_list_create"),
    path("<uuid:id>/",                HouseDetailView.as_view(),               name="house_detail"),
    path("applications/",             HouseApplicationListCreateView.as_view(), name="application_list_create"),
    path("applications/dashboard/",   HouseApplicationDashboardView.as_view(),  name="application_dashboard"),
    path("applications/<uuid:id>/",   HouseApplicationDetailView.as_view(),     name="application_detail"),
    path("applications/<uuid:id>/submit/", HouseApplicationSubmitView.as_view(), name="application_submit"),
    path("applications/<uuid:id>/status/", HouseApplicationStatusUpdateView.as_view(), name="application_status_update"),
]
