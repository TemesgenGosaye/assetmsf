from django.db.models.signals import post_save
from django.dispatch import receiver
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from assets.models import Asset
from maintenance.models import MaintenanceTicket as Ticket
from authentication.models import User
from .models import Notification

def create_notification(user, title, message, n_type):
    if user:
        note = Notification.objects.create(
            user=user,
            title=title,
            message=message,
            type=n_type
        )
        # Push real-time
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'notifications_{user.id}',
            {
                'type': 'send_notification',
                'message': {
                    'id': str(note.id),
                    'title': note.title,
                    'message': note.message,
                    'type': note.type,
                }
            }
        )

@receiver(post_save, sender=Asset)
def notify_asset_save(sender, instance, created, **kwargs):
    admin = User.objects.filter(role='admin').first()
    create_notification(admin, 'Asset Update', f'Asset {instance.name} was {"created" if created else "updated"}.', Notification.Type.ASSET)

@receiver(post_save, sender=Ticket)
def notify_ticket_save(sender, instance, created, **kwargs):
    admin = User.objects.filter(role='admin').first()
    create_notification(admin, 'Ticket Update', f'Ticket {instance.title} was {"created" if created else "updated"}.', Notification.Type.TICKET)
