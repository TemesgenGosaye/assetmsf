import os
import django
import random
import argparse

parser = argparse.ArgumentParser(description="Seed house data")
parser.add_argument("--count", type=int, default=30, help="Number of houses to generate")
args = parser.parse_args()
HOUSE_COUNT = args.count
random.seed(42)

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from houses.models import House

def seed_houses():
    print("=" * 60)
    print("Starting SAMS House Database Seeding...")
    print("=" * 60)

    # Let's count existing houses
    existing_count = House.objects.count()
    print(f"Current house count in DB: {existing_count}")

    # If houses exist, let's see if we should delete them or keep them.
    # To ensure we have exactly 30 sample houses, let's delete existing houses first
    # to avoid sequence overlaps and have clean 90-000-00 to 90-029-00 IDs.
    if existing_count > 0:
        print("Clearing existing houses to build a clean set...")
        House.objects.all().delete()
        print("Existing houses cleared.")

    locations = [
        "Metahara Compound A",
        "Metahara Compound B",
        "Sugar Factory Staff Quarters",
        "North Barracks Compound",
        "South Barracks Compound",
        "Senior Staff Residential Area",
        "Field Staff Compound C",
        "Factory Road Residences"
    ]

    house_types = [
        ("Staff", "Standard Staff Unit", 2),
        ("A", "Executive Type A Bungalow", 1),
        ("B", "Type B Family House", 2),
        ("C", "Type C Flat", 3),
        ("D", "Type D Studio", 1),
        ("E", "Type E Shared Barrack Space", 8)
    ]

    print("Generating 30 sample houses...")
    for i in range(HOUSE_COUNT):
        # Pick location and type randomly or deterministically
        loc = locations[i % len(locations)]
        # We want to distribute types
        ht_choice = house_types[i % len(house_types)]
        
        h_type = ht_choice[0]
        desc_prefix = ht_choice[1]
        capacity = ht_choice[2]
        
        # Randomize status (most are active, a few are inactive for demo purposes)
        status = "Active"
        damaged_fields = {}
        if i in [5, 12, 23]:  # Select 3 houses to be inactive / under maintenance / damaged
            status = "Inactive"
            damaged_fields = {
                'damaged_door': random.choice([True, False]),
                'damaged_windows': random.choice([True, False]),
                'damaged_walls': random.choice([True, False]),
                'damaged_switch': random.choice([True, False]),
                'damaged_bulb': random.choice([True, False]),
                'damaged_water': random.choice([True, False])
            }
            # Ensure at least one damage is True if status is Inactive
            if not any(damaged_fields.values()):
                damaged_fields['damaged_windows'] = True
        
        # Assign randomized inside items
        possible_items = ["Bed", "Chair", "Table", "Locker"]
        if h_type == "E":
            # Barracks usually have beds and lockers
            inside_items = ["Bed", "Locker"]
        else:
            # Random subset of items
            inside_items = random.sample(possible_items, k=random.randint(1, 4))

        house = House(
            location=f"{loc}, Unit {100 + i}",
            house_type=h_type,
            status=status,
            capacity=capacity,
            description=f"{desc_prefix} - Unit #{i+1} in {loc}.",
            inside_items=inside_items,
            **damaged_fields
        )
        house.save()
        print(f"  - Created House #{i+1}: {house.house_id} | Type: {house.house_type} | Location: {house.location} | Status: {house.status}")

    print("=" * 60)
    print(f"House Seeding Complete! Total Houses: {House.objects.count()}")
    print("=" * 60)

if __name__ == "__main__":
    seed_houses()
