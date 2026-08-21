import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def copy_asset_id_data_forward(apps, schema_editor):
    """Step 1: Copy old asset_id values into asset_identifier, asset_code, department."""
    QRCode = apps.get_model('common', 'QRCode')
    Asset = apps.get_model('assets', 'Asset')

    asset_by_code = {a.asset_code: a for a in Asset.objects.all()}

    for qr in QRCode.objects.all():
        old_id = qr.asset_id or ''
        qr.asset_identifier = old_id

        asset = asset_by_code.get(old_id)
        if not asset:
            try:
                import uuid
                uuid.UUID(old_id)
                asset = Asset.objects.filter(id=old_id).first()
            except (ValueError, TypeError):
                pass

        if asset:
            qr.asset_code = asset.asset_code
            qr.asset_name = qr.asset_name or asset.name
            qr.department = qr.department or asset.department
        else:
            qr.asset_code = old_id

        qr.save(update_fields=['asset_identifier', 'asset_code', 'asset_name', 'department'])


def link_fk_forward(apps, schema_editor):
    """Step 2: Link the FK after the old asset_id column is removed and FK is added."""
    QRCode = apps.get_model('common', 'QRCode')
    Asset = apps.get_model('assets', 'Asset')

    asset_by_code = {a.asset_code: a for a in Asset.objects.all()}

    for qr in QRCode.objects.all():
        asset = asset_by_code.get(qr.asset_code)
        if not asset:
            try:
                import uuid
                uuid.UUID(qr.asset_identifier)
                asset = Asset.objects.filter(id=qr.asset_identifier).first()
            except (ValueError, TypeError):
                pass
        if asset:
            qr.asset = asset
            qr.save(update_fields=['asset'])


class Migration(migrations.Migration):

    dependencies = [
        ("assets", "0007_migrate_asset_ids"),
        ("common", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1. Add new columns (no conflict with existing asset_id)
        migrations.AddField(
            model_name="qrcode",
            name="asset_identifier",
            field=models.CharField(
                blank=True, db_index=True, default="",
                max_length=50, verbose_name="asset identifier (legacy)",
            ),
        ),
        migrations.AddField(
            model_name="qrcode",
            name="asset_code",
            field=models.CharField(
                blank=True, db_index=True, default="",
                help_text="Production Asset ID, e.g. 1.06.6.24.12.01",
                max_length=50, verbose_name="asset code",
            ),
        ),
        migrations.AddField(
            model_name="qrcode",
            name="department",
            field=models.CharField(
                blank=True, max_length=255, null=True, verbose_name="department",
            ),
        ),
        # 2. Alter image_url to TextField for base64 data URLs
        migrations.AlterField(
            model_name="qrcode",
            name="image_url",
            field=models.TextField(
                blank=True, null=True, verbose_name="image data URL",
            ),
        ),
        # 3. Copy data from old asset_id → new fields
        migrations.RunPython(copy_asset_id_data_forward, migrations.RunPython.noop),
        # 4. Remove old asset_id CharField (frees the DB column name)
        migrations.RemoveField(
            model_name="qrcode",
            name="asset_id",
        ),
        # 5. Add FK asset (now safe — asset_id column name is free)
        migrations.AddField(
            model_name="qrcode",
            name="asset",
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="qr_codes",
                to="assets.asset",
                verbose_name="asset",
            ),
        ),
        # 6. Link FK using asset_code
        migrations.RunPython(link_fk_forward, migrations.RunPython.noop),
        # 7. Add index on asset_code
        migrations.AddIndex(
            model_name="qrcode",
            index=models.Index(
                fields=["asset_code"], name="qr_codes_asset_c_6cb18b_idx",
            ),
        ),
    ]
