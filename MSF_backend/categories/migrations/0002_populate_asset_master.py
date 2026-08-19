"""
Populate Category and ItemType tables from the official Asset Master Book.
"""
from django.db import migrations


def populate_asset_master(apps, schema_editor):
    Category = apps.get_model('categories', 'Category')
    ItemType = apps.get_model('categories', 'ItemType')
    Asset = apps.get_model('assets', 'Asset')

    # Null out FK references first
    Asset.objects.all().update(item_type=None, category=None)
    ItemType.objects.all().delete()
    Category.objects.all().delete()

    from categories.constants import ASSET_MASTER

    cat_map = {}
    for group_code, group_name, items in ASSET_MASTER:
        cat = Category.objects.create(
            name=f"{group_code} - {group_name}",
            code=group_code,
            description=f"Asset Group {group_code}: {group_name}",
            is_active=True,
        )
        cat_map[group_code] = cat

        for item_code, item_name in items:
            ItemType.objects.create(
                name=f"{item_code}: {item_name}",
                category=cat,
                description=f"Asset Item {item_code} under {group_name}",
                is_active=True,
            )

    print(f"  Created {Category.objects.count()} categories, {ItemType.objects.count()} item types")


def reverse_populate(apps, schema_editor):
    Category = apps.get_model('categories', 'Category')
    ItemType = apps.get_model('categories', 'ItemType')
    Asset = apps.get_model('assets', 'Asset')
    Asset.objects.all().update(item_type=None, category=None)
    ItemType.objects.all().delete()
    Category.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('categories', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(populate_asset_master, reverse_populate),
    ]
