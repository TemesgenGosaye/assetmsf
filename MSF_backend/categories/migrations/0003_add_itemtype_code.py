"""
Add item_type code field, populate from name prefix, create unique index.
Item names are stored as "X.XX: ItemName" — extract the code prefix.
"""
from django.db import migrations


def forwards(apps, schema_editor):
    """Add column, populate from name prefix, create unique index."""
    conn = schema_editor.connection
    raw = conn.connection
    cursor = raw.cursor()

    # Step 1: Add nullable code column (idempotent)
    try:
        cursor.execute("ALTER TABLE item_types ADD COLUMN code varchar(50) NULL")
        raw.commit()
    except Exception:
        pass

    # Step 2: Read all item types
    cursor.execute("SELECT id, name FROM item_types")
    rows = cursor.fetchall()

    # Step 3: Populate codes from name prefix "X.XX: ItemName" -> "X.XX"
    updated = 0
    skipped = []
    for pk, name in rows:
        if ': ' in name:
            code = name.split(': ', 1)[0].strip()
            cursor.execute("UPDATE item_types SET code = ? WHERE id = ?", (code, pk))
            updated += 1
        else:
            skipped.append(name)

    raw.commit()

    # Step 4: Create unique index
    cursor.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_item_types_code_uniq ON item_types(code)"
    )
    raw.commit()

    print(f"  Populated codes for {updated}/{len(rows)} item types")
    if skipped:
        print(f"  Skipped {len(skipped)} items (no ': ' in name): {skipped[:5]}")


def backwards(apps, schema_editor):
    raw = schema_editor.connection.connection
    cursor = raw.cursor()
    cursor.execute("DROP INDEX IF EXISTS idx_item_types_code_uniq")
    raw.commit()


class Migration(migrations.Migration):

    dependencies = [
        ('categories', '0002_populate_asset_master'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
