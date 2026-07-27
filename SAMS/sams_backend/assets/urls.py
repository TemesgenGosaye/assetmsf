"""
URL configuration for assets app.
"""
from django.urls import path
from .views import (
    AssetListView, AssetDetailView,
    AssetAttachmentListView, AssetAttachmentDetailView,
    AssetTransferListView, AssetTransferDetailView,
    AssetTransferApproveView, AssetTransferRejectView,
    AssetTransferCompleteView, AssetTransferCancelView,
)

urlpatterns = [
    path('', AssetListView.as_view(), name='asset_list'),

    # Transfers – must be before <str:id>/ to avoid being captured as an asset ID
    path('transfers/', AssetTransferListView.as_view(), name='asset_transfer_list'),
    path('transfers/<uuid:id>/', AssetTransferDetailView.as_view(), name='asset_transfer_detail'),
    path('transfers/<uuid:id>/approve/', AssetTransferApproveView.as_view(), name='asset_transfer_approve'),
    path('transfers/<uuid:id>/reject/', AssetTransferRejectView.as_view(), name='asset_transfer_reject'),
    path('transfers/<uuid:id>/complete/', AssetTransferCompleteView.as_view(), name='asset_transfer_complete'),
    path('transfers/<uuid:id>/cancel/', AssetTransferCancelView.as_view(), name='asset_transfer_cancel'),

    # Attachments – also before <str:id>/
    path('<str:asset_id>/attachments/', AssetAttachmentListView.as_view(), name='asset_attachment_list'),
    path('attachments/<uuid:id>/', AssetAttachmentDetailView.as_view(), name='asset_attachment_detail'),

    # Asset detail – last so it doesn't swallow other paths
    path('<str:id>/', AssetDetailView.as_view(), name='asset_detail'),
]
