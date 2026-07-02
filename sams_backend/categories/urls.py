"""
URL configuration for categories app.
"""
from django.urls import path
from .views import CategoryListView, CategoryDetailView, ItemTypeListView, ItemTypeDetailView

urlpatterns = [
    path('categories/', CategoryListView.as_view(), name='category_list'),
    path('categories/<uuid:id>/', CategoryDetailView.as_view(), name='category_detail'),
    path('item-types/', ItemTypeListView.as_view(), name='item_type_list'),
    path('item-types/<uuid:id>/', ItemTypeDetailView.as_view(), name='item_type_detail'),
]
