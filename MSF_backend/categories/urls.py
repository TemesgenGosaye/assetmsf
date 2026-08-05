"""
URL configuration for categories app.
"""
from django.urls import path
from .views import CategoryListView, CategoryDetailView, ItemTypeListView, ItemTypeDetailView

urlpatterns = [
    # For when included at /api/categories/
    path('', CategoryListView.as_view(), name='category_list'),
    path('<uuid:id>/', CategoryDetailView.as_view(), name='category_detail'),
    # For when included at /api/
    path('categories/', CategoryListView.as_view(), name='category_list_alt'),
    path('categories/<uuid:id>/', CategoryDetailView.as_view(), name='category_detail_alt'),
    # Item types (work at both /api/item-types/ and /api/categories/item-types/
    path('item-types/', ItemTypeListView.as_view(), name='item_type_list'),
    path('item-types/<uuid:id>/', ItemTypeDetailView.as_view(), name='item_type_detail'),
]
