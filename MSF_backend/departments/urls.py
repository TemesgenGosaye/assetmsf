"""
URL configuration for departments app.
"""
from django.urls import path
from .views import DepartmentListView, DepartmentDetailView, DepartmentTreeView

urlpatterns = [
    path('', DepartmentListView.as_view(), name='department_list'),
    path('tree/', DepartmentTreeView.as_view(), name='department_tree'),
    path('<uuid:id>/', DepartmentDetailView.as_view(), name='department_detail'),
]
