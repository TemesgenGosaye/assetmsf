"""
URL configuration for assets app.
"""
from django.urls import path
from .views import AssetListView, AssetDetailView, AssetAttachmentListView, AssetAttachmentDetailView

urlpatterns = [
    path('', AssetListView.as_view(), name='asset_list'),
    path('<str:id>/', AssetDetailView.as_view(), name='asset_detail'),
    path('<str:asset_id>/attachments/', AssetAttachmentListView.as_view(), name='asset_attachment_list'),
    path('attachments/<uuid:id>/', AssetAttachmentDetailView.as_view(), name='asset_attachment_detail'),
]
