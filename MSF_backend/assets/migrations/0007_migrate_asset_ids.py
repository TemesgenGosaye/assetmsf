"""
Migrate existing assets:
1. Normalize legacy department names to official department names
2. Generate new Asset IDs in the format 1.06.{ITEM_TYPE_CODE}.{DEPARTMENT_CODE}.{SEQ}
"""
from django.db import migrations


def forwards(apps, schema_editor):
    """Fix existing asset department names and regenerate asset codes."""
    conn = schema_editor.connection
    raw = conn.connection
    cursor = raw.cursor()
    FACTORY_PREFIX = "1.06"

    # Build department name -> code lookup via raw SQL
    cursor.execute("SELECT name, code FROM departments WHERE is_active = 1")
    dept_by_name = {}
    for name, code in cursor.fetchall():
        dept_by_name[name.upper().strip()] = code

    # Legacy name mapping
    LEGACY_MAP = {
        'HUMAN RESOURCE MANAGEMENT': 'HUMAN RESOURCE DEPARTMENT',
        'SUGAR PRODUCTION': 'PRODUCTION',
    }

    # Build item type id -> code lookup via raw SQL
    cursor.execute("SELECT id, code, name FROM item_types WHERE is_active = 1 AND code IS NOT NULL")
    it_code_by_id = {}
    it_code_by_name = {}
    for pk, code, name in cursor.fetchall():
        it_code_by_id[pk] = code
        if ': ' in name:
            it_code_by_name[name.split(': ', 1)[0].strip()] = code

    # Read all assets
    cursor.execute("SELECT id, name, asset_code, department, item_type_id FROM assets ORDER BY created_at")
    assets = cursor.fetchall()

    for pk, name, old_code, dept_name, item_type_id in assets:
        dept_name = (dept_name or '').strip()
        dept_code = None

        if dept_name:
            dept_code = dept_by_name.get(dept_name.upper().strip())
            if not dept_code:
                official = LEGACY_MAP.get(dept_name.upper().strip())
                if official:
                    dept_code = dept_by_name.get(official.upper().strip())

        if not dept_code:
            dept_code = "00"

        # Get item type code
        item_code = None
        if item_type_id:
            item_code = it_code_by_id.get(item_type_id)

        if not item_code:
            item_code = "00"

        # Find next sequence
        base = f"{FACTORY_PREFIX}.{item_code}.{dept_code}"
        cursor.execute(
            "SELECT asset_code FROM assets WHERE asset_code LIKE ? AND id != ?",
            (f"{base}.%", pk),
        )
        rows = cursor.fetchall()

        max_seq = 0
        for (code,) in rows:
            parts = code.rsplit(".", 1)
            if len(parts) == 2:
                try:
                    seq = int(parts[1])
                    if seq > max_seq:
                        max_seq = seq
                except ValueError:
                    continue

        new_code = f"{base}.{max_seq + 1:02d}"

        # Update the asset
        cursor.execute(
            "UPDATE assets SET asset_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (new_code, pk),
        )

        print(f"  {name}: {old_code} -> {new_code}")

    raw.commit()
    print(f"\nMigrated {len(assets)} assets to new Asset ID format")


def backwards(apps, schema_editor):
    pass  # Cannot safely reverse


class Migration(migrations.Migration):

    dependencies = [
        ('assets', '0006_remove_asset_check_quantity_positive_and_more'),
        ('categories', '0003_add_itemtype_code'),
        ('departments', '0007_alter_department_name_and_more'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
