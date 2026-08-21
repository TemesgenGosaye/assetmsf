"""
Register the ItemType.code field in Django's migration state.
The column already exists in the DB (added via raw SQL in 0003),
so we use SeparateDatabaseAndState to skip the actual DB operation.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('categories', '0003_add_itemtype_code'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name='itemtype',
                    name='code',
                    field=models.CharField(
                        blank=True,
                        default='',
                        help_text='Official item type code from the Fixed Asset Registration Master Book, e.g. "3.39", "6.24"',
                        max_length=50,
                        unique=True,
                        db_index=True,
                        verbose_name='code',
                    ),
                ),
            ],
            database_operations=[],
        ),
    ]
