"""
URL configuration for assets app.
"""
from django.urls import path
from .views import (
    AssetListView, AssetDetailView, AssetAttachmentListView, AssetAttachmentDetailView,
    AssetTransferListView, AssetTransferDetailView, AssetTransferActionView,
    AssetLifecycleEventListView, AssetAnalyticsView, AssetComplianceView,
    AssetDepreciationView,
)

urlpatterns = [
    path('', AssetListView.as_view(), name='asset_list'),
    path('transfers/', AssetTransferListView.as_view(), name='asset_transfer_list'),
    path('transfers/<str:id>/', AssetTransferDetailView.as_view(), name='asset_transfer_detail'),
    path('transfers/<str:id>/<str:action>/', AssetTransferActionView.as_view(), name='asset_transfer_action'),
    path('lifecycle-events/', AssetLifecycleEventListView.as_view(), name='asset_lifecycle_events'),
    path('analytics/', AssetAnalyticsView.as_view(), name='asset_analytics'),
    path('compliance/', AssetComplianceView.as_view(), name='asset_compliance'),
    path('depreciation/', AssetDepreciationView.as_view(), name='asset_depreciation'),
    path('<str:id>/', AssetDetailView.as_view(), name='asset_detail'),
    path('<str:asset_id>/attachments/', AssetAttachmentListView.as_view(), name='asset_attachment_list'),
    path('attachments/<uuid:id>/', AssetAttachmentDetailView.as_view(), name='asset_attachment_detail'),
]
