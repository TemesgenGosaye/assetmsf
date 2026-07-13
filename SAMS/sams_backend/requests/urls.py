"""
URL configuration for requests app.
"""
from django.urls import path
from .views import (
    ApprovalRequestListView, ApprovalRequestDetailView,
    forward_approval, decide_approval, ApprovalEventListView
)

urlpatterns = [
    path('', ApprovalRequestListView.as_view(), name='approval_list'),
    path('<uuid:id>/', ApprovalRequestDetailView.as_view(), name='approval_detail'),
    path('<uuid:id>/forward/', forward_approval, name='approval_forward'),
    path('<uuid:id>/decide/', decide_approval, name='approval_decide'),
    path('<uuid:approval_id>/events/', ApprovalEventListView.as_view(), name='approval_event_list'),
]
