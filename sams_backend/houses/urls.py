from django.urls import path
from .views import HouseListCreateView, HouseDetailView

urlpatterns = [
    path("",           HouseListCreateView.as_view(), name="house_list_create"),
    path("<uuid:id>/", HouseDetailView.as_view(),     name="house_detail"),
]
