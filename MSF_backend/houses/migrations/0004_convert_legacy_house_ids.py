from django.db import migrations


def convert_legacy_house_ids(apps, schema_editor):
    House = apps.get_model("houses", "House")

    legacy_houses = list(
        House.objects.filter(house_id__startswith="HID-").order_by(
            "house_id", "created_at"
        )
    )

    if not legacy_houses:
        return

    existing_new_ids = set(
        House.objects.filter(house_id__regex=r"^90-\d{3}-00$").values_list(
            "house_id", flat=True
        )
    )

    seq = 0
    for house in legacy_houses:
        while f"90-{seq:03d}-00" in existing_new_ids:
            seq += 1

        new_house_id = f"90-{seq:03d}-00"
        house.house_id = new_house_id
        house.save(update_fields=["house_id", "updated_at"])
        existing_new_ids.add(new_house_id)
        seq += 1


def noop_reverse(apps, schema_editor):
    # Legacy HID values are not recoverable after conversion.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("houses", "0003_houseapplication"),
    ]

    operations = [
        migrations.RunPython(convert_legacy_house_ids, noop_reverse),
    ]
