"""
Views for notification management.
"""
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from core.responses import StandardResponse
from .serializers import NotificationSerializer, NotificationUpdateSerializer
from .models import Notification
from authentication.models import User


class NotificationListView(generics.ListCreateAPIView):
    """List and create notifications."""
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter notifications by user_id query param or current user."""
        user_id = self.request.query_params.get('user_id')
        qs = Notification.objects.filter(is_active=True).order_by('-created_at')
        if user_id:
            qs = qs.filter(user_id=user_id)
        else:
            qs = qs.filter(user=self.request.user)
        limit = self.request.query_params.get('limit')
        if limit:
            try:
                qs = qs[:int(limit)]
            except (ValueError, TypeError):
                pass
        return qs
    
    def list(self, request, *args, **kwargs):
        """List notifications with standard response format."""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Notifications retrieved successfully")
    
    def create(self, request, *args, **kwargs):
        """Create a notification."""
        data = request.data.copy()
        user_id = data.pop('user_id', None) or str(getattr(self.request.user, 'id', ''))
        try:
            user = User.objects.get(id=user_id)
        except (User.DoesNotExist, ValueError):
            user = self.request.user
        data['user'] = str(user.id)
        serializer = self.get_serializer(data=data)
        if serializer.is_valid():
            serializer.save(user=user)
            return StandardResponse.created(serializer.data, "Notification created")
        return StandardResponse.validation_error("Validation failed", serializer.errors)


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
