from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("employees", "0002_add_marital_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="employee",
            name="job_type",
            field=models.CharField(
                blank=True,
                choices=[
                    ("Permanent", "Permanent"),
                    ("Semi Permanent", "Semi Permanent"),
                    ("Seasonal", "Seasonal"),
                ],
                default="Permanent",
                max_length=20,
                verbose_name="job type",
            ),
        ),
    ]
