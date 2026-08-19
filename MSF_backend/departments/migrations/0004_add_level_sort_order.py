"""
Add level and sort_order fields to Department model.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('departments', '0003_replace_departments'),
    ]

    operations = [
        migrations.AddField(
            model_name='department',
            name='level',
            field=models.PositiveSmallIntegerField(
                default=0,
                help_text='0 = top-level, 1 = sub-department, 2 = sub-sub-department',
                verbose_name='hierarchy level',
            ),
        ),
        migrations.AddField(
            model_name='department',
            name='sort_order',
            field=models.IntegerField(
                default=0,
                help_text='Controls display order within the parent.',
                verbose_name='sort order',
            ),
        ),
        migrations.AlterModelOptions(
            name='department',
            options={
                'verbose_name': 'department',
                'verbose_name_plural': 'departments',
                'ordering': ['sort_order', 'name'],
            },
        ),
        migrations.AlterField(
            model_name='department',
            name='code',
            field=models.CharField(
                db_index=True,
                max_length=50,
                unique=True,
                verbose_name='code',
            ),
        ),
    ]
