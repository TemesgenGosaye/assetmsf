from django.db import migrations


ROOM_MAP = {
    "Staff": (3, ["R1", "R2", "R3"]),
    "A":     (3, ["R1", "R2", "R3"]),
    "B":     (3, ["R1", "R2", "R3"]),
    "C":     (2, ["R1", "R2"]),
    "D":     (1, ["R1"]),
    "E":     (1, ["R1"]),
}


def backfill_room_fields(apps, schema_editor):
    House = apps.get_model("houses", "House")
    for h in House.objects.all().iterator():
        count, labels = ROOM_MAP.get(h.house_type, (1, ["R1"]))
        h.room_count = count
        h.room_labels = labels
        if count < 2:
            h.r2_status = ""
            h.r2_occupant_name = ""
            h.r2_occupant_id = ""
            h.r2_notes = ""
        if count < 3:
            h.r3_status = ""
            h.r3_occupant_name = ""
            h.r3_occupant_id = ""
            h.r3_notes = ""
        h.save(update_fields=[
            "room_count", "room_labels",
            "r2_status", "r2_occupant_name", "r2_occupant_id", "r2_notes",
            "r3_status", "r3_occupant_name", "r3_occupant_id", "r3_notes",
        ])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("houses", "0016_house_r1_notes_house_r1_occupant_id_and_more"),
    ]

    operations = [
        migrations.RunPython(backfill_room_fields, noop),
    ]
