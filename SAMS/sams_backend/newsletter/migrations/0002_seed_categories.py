from django.db import migrations


DEFAULT_CATEGORIES = [
    {"key": "release_notes", "label": "Release Notes", "hue": "blue"},
    {"key": "design_refresh", "label": "Design Refresh", "hue": "sky"},
    {"key": "content_update", "label": "Content Update", "hue": "amber"},
    {"key": "website_launch", "label": "Website Launch", "hue": "emerald"},
    {"key": "performance", "label": "Performance", "hue": "red"},
    {"key": "maintenance", "label": "Maintenance", "hue": "zinc"},
]


def seed_categories(apps, schema_editor):
    NewsletterCategory = apps.get_model("newsletter", "NewsletterCategory")
    for item in DEFAULT_CATEGORIES:
        NewsletterCategory.objects.get_or_create(
            key=item["key"],
            defaults={"label": item["label"], "hue": item["hue"]},
        )


def remove_categories(apps, schema_editor):
    NewsletterCategory = apps.get_model("newsletter", "NewsletterCategory")
    NewsletterCategory.objects.filter(
        key__in=[item["key"] for item in DEFAULT_CATEGORIES]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("newsletter", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_categories, remove_categories),
    ]
