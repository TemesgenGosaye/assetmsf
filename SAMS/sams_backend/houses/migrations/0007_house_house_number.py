from django.db import migrations, models


def backfill_house_number(apps, schema_editor):
    """
    Backfill house_number for existing houses.
    Groups them by house_type, ordered by house_id ascending, then assigns
    <type>1, <type>2, <type>3 …
    """
    House = apps.get_model("houses", "House")
    from collections import defaultdict

    by_type = defaultdict(list)
    for house in House.objects.all().order_by("house_id"):
        by_type[house.house_type].append(house)

    for house_type, houses in by_type.items():
        for idx, house in enumerate(houses, start=1):
            house.house_number = f"{house_type}{idx}"
            house.save(update_fields=["house_number"])


class Migration(migrations.Migration):

    dependencies = [
        ("houses", "0006_allocationlog_scoringconfig_and_more"),
    ]

    operations = [
        # 0. Clean up any leftover partial indexes from a previous failed attempt
        migrations.RunSQL(
            sql="""
                DROP INDEX IF EXISTS houses_house_number_b2322778_like;
                ALTER TABLE houses DROP CONSTRAINT IF EXISTS houses_house_number_unique;
                ALTER TABLE houses DROP COLUMN IF EXISTS house_number;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),

        # 1. Add the column (non-unique so backfill can run first)
        migrations.AddField(
            model_name="house",
            name="house_number",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Auto-generated sequential number per house type, e.g. A1, B3, Staff2.",
                max_length=20,
                verbose_name="house number",
            ),
            preserve_default=False,
        ),

        # 2. Populate existing rows
        migrations.RunPython(backfill_house_number, migrations.RunPython.noop),

        # 3. Apply unique + index constraints via raw SQL (avoids Django's
        #    deferred LIKE index creation that fails on PostgreSQL)
        migrations.RunSQL(
            sql="""
                CREATE UNIQUE INDEX IF NOT EXISTS houses_house_number_uniq
                    ON houses (house_number);
                CREATE INDEX IF NOT EXISTS houses_house_number_idx
                    ON houses (house_number);
            """,
            reverse_sql="""
                DROP INDEX IF EXISTS houses_house_number_uniq;
                DROP INDEX IF EXISTS houses_house_number_idx;
            """,
        ),

        # 4. Update Django's migration state to know the field is unique+indexed
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterField(
                    model_name="house",
                    name="house_number",
                    field=models.CharField(
                        blank=True,
                        db_index=True,
                        help_text="Auto-generated sequential number per house type, e.g. A1, B3, Staff2.",
                        max_length=20,
                        unique=True,
                        verbose_name="house number",
                    ),
                ),
            ],
            database_operations=[],  # already handled by RunSQL above
        ),
    ]
