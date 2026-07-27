from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("houses", "0008_add_position_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="houseapplication",
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
