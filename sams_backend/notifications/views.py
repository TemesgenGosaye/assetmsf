"""
Views for notification management.
"""
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from core.responses import StandardResponse
from .serializers import NotificationSerializer, NotificationUpdateSerializer
from .models import Notification


class NotificationListView(generics.ListAPIView):
    """List notifications for current user."""
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter notifications for current user."""
        return Notification.objects.filter(user=self.request.user, is_active=True).order_by('-created_at')
    
    def list(self, request, *args, **kwargs):
        """List notifications with standard response format."""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Notifications retrieved successfully")


class NotificationDetailView(generics.RetrieveUpdateAPIView):
    """Retrieve or update a notification."""
    queryset = Notification.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'
    
    def get_queryset(self):
        """Filter notifications for current user."""
        return Notification.objects.filter(user=self.request.user, is_active=True)
    
    def get_serializer_class(self):
        """Return appropriate serializer based on request method."""
        if self.request.method in ['PUT', 'PATCH']:
            return NotificationUpdateSerializer
        return NotificationSerializer
    
    def retrieve(self, request, *args, **kwargs):
        """Retrieve notification with standard response format."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return StandardResponse.success(serializer.data, "Notification retrieved successfully")


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_read(request):
    """Mark all notifications as read for current user."""
    Notification.objects.filter(
        user=request.user,
        is_active=True,
        read=False
    ).update(read=True)
    return StandardResponse.success(None, "All notifications marked as read")


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def clear_all_notifications(request):
    """Soft delete all notifications for current user."""
    Notification.objects.filter(
        user=request.user,
        is_active=True
    ).update(is_active=False)
    return StandardResponse.success(None, "All notifications cleared")
