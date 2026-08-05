"""
Seed default eligibility rules and scoring configuration for Metehara Sugar Factory.
Run with: python manage.py shell < seed_eligibility.py
Or import from a management command.
"""
import os, sys, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from houses.models import EligibilityRule, ScoringConfig


def seed():
    # ── Eligibility Rules (Metehara Sugar Factory grade → house mapping) ──
    rules = [
        # Above 17 → Staff
        dict(min_grade=18, max_grade=30, house_type="Staff", priority=1,
             description="Grade above 17 → Staff houses (senior management)"),
        # 15–17 → Type A
        dict(min_grade=15, max_grade=17, house_type="A", priority=2,
             description="Grade 15–17 → Type A houses (supervisors)"),
        # 12–14 → Type B
        dict(min_grade=12, max_grade=14, house_type="B", priority=3,
             description="Grade 12–14 → Type B houses (skilled workers)"),
        # 10–11 → Type C
        dict(min_grade=10, max_grade=11, house_type="C", priority=4,
             description="Grade 10–11 → Type C houses (semi-skilled)"),
        # 7–9 → Type D
        dict(min_grade=7, max_grade=9, house_type="D", priority=5,
             description="Grade 7–9 → Type D houses (general workers)"),
        # Below 7 → Type E (Barracks)
        dict(min_grade=0, max_grade=6, house_type="E", priority=6,
             description="Grade below 7 → Type E barracks (unskilled)"),
    ]

    created_rules = 0
    for r in rules:
        obj, created = EligibilityRule.objects.update_or_create(
            min_grade=r["min_grade"],
            max_grade=r["max_grade"],
            house_type=r["house_type"],
            defaults={
                "priority": r["priority"],
                "description": r["description"],
                "gender_eligibility": "Both",
                "requires_family": False,
                "min_family_size": 0,
                "is_active": True,
            },
        )
        if created:
            created_rules += 1
        print(f"  [{'Created' if created else 'Exists '}] Grade {r['min_grade']:>2}-{r['max_grade']:<2} -> {r['house_type']}")

    # ── Default Scoring Configuration ──────────────────────────────────────
    config, created = ScoringConfig.objects.update_or_create(
        name="Metehara Default",
        defaults={
            "job_grade_weight": 30,
            "years_of_service_weight": 25,
            "family_size_weight": 20,
            "disability_weight": 10,
            "fifo_weight": 15,
            "marital_status_weight": 0,
            "employment_type_weight": 0,
            "medical_priority_weight": 0,
            "is_active": True,
        },
    )
    print(f"\n  [{'Created' if created else 'Exists '}] Scoring config: {config.name} (total={config.total_weight})")

    print(f"\nDone: {created_rules} eligibility rules, 1 scoring config.\n")


if __name__ == "__main__":
    seed()
else:
    seed()
