"""
URL configuration for common app.
"""
from django.urls import path
from .views import (
    QRCodeListView, QRCodeDetailView, delete_all_qr_codes,
    VendorListView, VendorDetailView
)

urlpatterns = [
    path('qr-codes/', QRCodeListView.as_view(), name='qr_code_list'),
    path('qr-codes/<uuid:id>/', QRCodeDetailView.as_view(), name='qr_code_detail'),
    path('qr-codes/delete-all/', delete_all_qr_codes, name='qr_code_delete_all'),
    path('vendors/', VendorListView.as_view(), name='vendor_list'),
    path('vendors/<uuid:id>/', VendorDetailView.as_view(), name='vendor_detail'),
]
