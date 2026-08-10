"""
Signals that record an immutable lifecycle audit trail for assets.

Every Asset create/update is diffed and written to AssetLifecycleEvent so the
full asset history (creation, status/condition changes, transfers, disposals,
value/depreciation and AMC updates) is always reconstructable.
"""
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from .models import Asset, AssetLifecycleEvent


def log_lifecycle_event(asset, event_type, actor=None, old_value=None,
                        new_value=None, message=None, metadata=None):
    """Create a lifecycle event for an asset (safe to call from views/tasks)."""
    return AssetLifecycleEvent.objects.create(
        asset=asset,
        event_type=event_type,
        actor=actor,
        old_value=old_value,
        new_value=new_value,
        message=message,
        metadata=metadata,
    )


# Snapshot the pre-save state so post_save can diff meaningful changes.
_old_instances = {}


@receiver(pre_save, sender=Asset)
def _snapshot_asset(sender, instance, **kwargs):
    if not instance.pk:
        return
    try:
        old = Asset.objects.get(pk=instance.pk)
        _old_instances[instance.pk] = old
    except Asset.DoesNotExist:
        pass


@receiver(post_save, sender=Asset)
def record_asset_lifecycle(sender, instance, created, **kwargs):
    actor = instance.updated_by or instance.created_by

    if created:
        log_lifecycle_event(
            asset=instance,
            event_type=AssetLifecycleEvent.EventType.CREATED,
            actor=actor,
            new_value={
                'name': instance.name,
                'status': instance.status,
                'condition': instance.condition,
                'property': getattr(instance.property, 'name', None) or str(instance.property_id),
                'department': instance.department,
                'purchase_cost': str(instance.purchase_cost) if instance.purchase_cost else None,
            },
            message=f"Asset {instance.asset_code} was created",
        )
        return

    old = _old_instances.pop(instance.pk, None)
    if old is None:
        return

    def _changed(field):
        return getattr(old, field, None) != getattr(instance, field, None)

    events = []

    if _changed('status'):
        old_status, new_status = old.status, instance.status
        event_type = AssetLifecycleEvent.EventType.STATUS_CHANGED
        if new_status in (Asset.Status.DISPOSED, Asset.Status.RETIRED):
            event_type = (AssetLifecycleEvent.EventType.DISPOSED
                          if new_status == Asset.Status.DISPOSED
                          else AssetLifecycleEvent.EventType.RETIRED)
        events.append((
            event_type,
            old.status,
            new_status,
            f"Status changed from {old.get_status_display()} to {instance.get_status_display()}",
        ))

    if _changed('condition'):
        events.append((
            AssetLifecycleEvent.EventType.CONDITION_CHANGED,
            old.condition,
            instance.condition,
            f"Condition changed from {old.get_condition_display()} to {instance.get_condition_display()}",
        ))

    if _changed('department') or _changed('property_id'):
        events.append((
            AssetLifecycleEvent.EventType.TRANSFERRED,
            {'department': old.department, 'property': old.property_id},
            {'department': instance.department, 'property': instance.property_id},
            "Asset moved to a new department or property",
        ))

    if _changed('owner_id'):
        events.append((
            AssetLifecycleEvent.EventType.OWNER_CHANGED,
            old.owner_id,
            instance.owner_id,
            "Asset ownership changed",
        ))

    if _changed('location'):
        events.append((
            AssetLifecycleEvent.EventType.LOCATION_CHANGED,
            old.location,
            instance.location,
            "Asset location changed",
        ))

    if _changed('purchase_cost') or _changed('current_value') or _changed('accumulated_depreciation'):
        events.append((
            AssetLifecycleEvent.EventType.VALUE_UPDATED,
            {'purchase_cost': str(old.purchase_cost) if old.purchase_cost else None,
             'current_value': str(old.current_value) if old.current_value else None},
            {'purchase_cost': str(instance.purchase_cost) if instance.purchase_cost else None,
             'current_value': str(instance.current_value) if instance.current_value else None},
            "Asset value details updated",
        ))

    if (_changed('amc_enabled') or _changed('amc_provider') or _changed('amc_start_date')
            or _changed('amc_end_date') or _changed('amc_cost')):
        events.append((
            AssetLifecycleEvent.EventType.AMC_UPDATED,
            {'provider': old.amc_provider, 'end_date': old.amc_end_date},
            {'provider': instance.amc_provider, 'end_date': instance.amc_end_date},
            "AMC details updated",
        ))

    if not events:
        events.append((
            AssetLifecycleEvent.EventType.UPDATED,
            None,
            None,
            f"Asset {instance.asset_code} was updated",
        ))

    for event_type, old_value, new_value, message in events:
        log_lifecycle_event(
            asset=instance,
            event_type=event_type,
            actor=actor,
            old_value=old_value,
            new_value=new_value,
            message=message,
        )
