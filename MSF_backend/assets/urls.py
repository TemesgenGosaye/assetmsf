"""
URL configuration for assets app.
"""
from django.urls import path
from .views import (
    AssetListView, AssetDetailView, AssetAttachmentListView, AssetAttachmentDetailView,
    AssetTransferListView, AssetTransferDetailView, AssetTransferActionView,
)

urlpatterns = [
    path('', AssetListView.as_view(), name='asset_list'),
    path('transfers/', AssetTransferListView.as_view(), name='asset_transfer_list'),
    path('transfers/<str:id>/', AssetTransferDetailView.as_view(), name='asset_transfer_detail'),
    path('transfers/<str:id>/<str:action>/', AssetTransferActionView.as_view(), name='asset_transfer_action'),
    path('<str:id>/', AssetDetailView.as_view(), name='asset_detail'),
    path('<str:asset_id>/attachments/', AssetAttachmentListView.as_view(), name='asset_attachment_list'),
    path('attachments/<uuid:id>/', AssetAttachmentDetailView.as_view(), name='asset_attachment_detail'),
]
