from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from .models import House, HouseApplication, ScoringConfig, Allocation
from .serializers import HouseSerializer, HouseCreateUpdateSerializer
from .allocation_engine import topsis_rank, run_batch_allocation

User = get_user_model()


def _app(user, house, i, grade, service, family, days_ago, status="Waiting for Allocation"):
    return HouseApplication.objects.create(
        requester=user,
        employee_id=f"EMP-{i}",
        employee_name=f"Employee {i}",
        national_id=f"NID-{i}-{house.house_id}",
        gender="Male" if i % 2 == 0 else "Female",
        job_position="Operator",
        job_grade=str(grade),
        position_type="Permanent",
        years_of_service=service,
        marital_status="Single",
        has_disability=False,
        family_size=max(family, 1),
        requested_house_category=house.house_type,
        status=status,
        submitted_at=timezone.now() - timedelta(days=days_ago),
    )


class AllocationEngineTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="alloc@example.com", password="testpassword123",
            name="Alloc User", role="ADMIN",
        )
        ScoringConfig.objects.update_or_create(
            name="Test Config",
            defaults={
                "job_grade_weight": 30, "years_of_service_weight": 25,
                "family_size_weight": 20, "disability_weight": 10,
                "fifo_weight": 15, "marital_status_weight": 0,
                "employment_type_weight": 0, "medical_priority_weight": 0,
                "is_active": True,
            },
        )
        self.house = House.objects.create(
            location="Test Compound", house_type="A", status="Active",
            capacity=1, created_by=self.user,
        )

    def test_topsis_closeness_uses_ideal_worst(self):
        """A candidate dominating the pool on every criterion must get cc≈1
        and the weakest candidate cc≈0 (d_worst measured from ideal worst)."""
        strong = _app(self.user, self.house, 1, grade=30, service=30, family=10, days_ago=365)
        weak = _app(self.user, self.house, 2, grade=1, service=0, family=1, days_ago=0)
        mid = _app(self.user, self.house, 3, grade=12, service=10, family=4, days_ago=60)

        ranked = topsis_rank([weak, mid, strong])
        cc = {app.application_no: c for app, _, _, _, c in ranked}

        self.assertEqual(ranked[0][0].id, strong.id, "dominant candidate must rank first")
        self.assertEqual(ranked[-1][0].id, weak.id, "dominated candidate must rank last")
        self.assertAlmostEqual(cc[strong.application_no], 1.0, places=4)
        self.assertLess(cc[weak.application_no], 0.2)

    def test_occupancy_counts_allocated_not_active(self):
        """House occupancy counts live Allocation records (the authoritative
        source), not the legacy 'Allocated' status alone. A live whole-house
        allocation blocks further allocation even though rooms are vacant."""
        allocated = _app(self.user, self.house, 10, grade=15, service=5, family=2, days_ago=10)
        allocated.status = HouseApplication.Status.ALLOCATED
        allocated.allocated_house = self.house
        allocated.save()

        Allocation.objects.create(
            application=allocated,
            house=self.house,
            employee_id=allocated.employee_id,
            employee_name=allocated.employee_name,
            status=Allocation.Status.ACTIVE,
            occupancy_status=Allocation.Occupancy.OCCUPIED,
            created_by=self.user,
        )

        _app(self.user, self.house, 11, grade=15, service=5, family=2, days_ago=5, status="Verified")

        self.house.refresh_from_db()
        self.assertEqual(self.house.current_occupancy, 1)
        self.assertEqual(self.house.vacant, 3, "all 3 rooms are physically vacant")
        self.assertFalse(self.house.is_available, "whole-house allocation blocks further allocation")
        self.assertFalse(self.house.is_fully_vacant)

        serialized = HouseSerializer(self.house).data
        self.assertEqual(serialized["current_occupancy"], 1)
        self.assertEqual(serialized["vacant"], 3)
        self.assertFalse(serialized["is_available"])

    def test_batch_allocation_respects_capacity(self):
        """Batch allocation must never assign two applicants to one unit."""
        app_a = _app(self.user, self.house, 20, grade=15, service=5, family=2, days_ago=10)
        app_b = _app(self.user, self.house, 21, grade=14, service=4, family=3, days_ago=5)

        result = run_batch_allocation(user=self.user)

        self.assertEqual(len(result["allocated"]), 1, f"only 1 of 1 unit should be allocated, got {result['allocated']}")
        allocated_ids = {r["application_no"] for r in result["allocated"]}
        self.assertTrue(allocated_ids.issubset({app_a.application_no, app_b.application_no}))

        self.house.refresh_from_db()
        self.assertEqual(self.house.current_occupancy, 1)

    def test_batch_allocation_dry_run_is_pure(self):
        """dry_run must preview the same matches without persisting anything."""
        app_a = _app(self.user, self.house, 20, grade=15, service=5, family=2, days_ago=10)
        app_b = _app(self.user, self.house, 21, grade=14, service=4, family=3, days_ago=5)

        result = run_batch_allocation(user=self.user, dry_run=True)

        self.assertTrue(result["dry_run"])
        self.assertEqual(len(result["allocated"]), 1)
        self.house.refresh_from_db()
        self.assertEqual(self.house.current_occupancy, 0)
        self.assertEqual(self.house.vacant, 3, "dry-run persists nothing — rooms stay vacant")
        app_a.refresh_from_db()
        app_b.refresh_from_db()
        self.assertEqual(app_a.status, HouseApplication.Status.WAITING_FOR_ALLOCATION)
        self.assertEqual(app_b.status, HouseApplication.Status.WAITING_FOR_ALLOCATION)
        self.assertIsNone(app_a.allocated_house)
        self.assertIsNone(app_b.allocated_house)
        self.assertEqual(Allocation.objects.count(), 0)


class HouseTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="testuser@example.com",
            password="testpassword123",
            name="Test User",
            role="ADMIN"
        )
        self.house_data = {
            "location": "Test Location A",
            "house_type": "A",
            "status": "Active",
            "capacity": 2,
            "inside_items": ["Bed", "Chair"],
            "description": "A nice house"
        }

    def test_create_house_model(self):
        """Test that a house model is saved with inside_items correctly."""
        house = House.objects.create(
            location="Test Location B",
            house_type="B",
            status="Active",
            capacity=3,
            inside_items=["Bed", "Table", "Locker"],
            created_by=self.user
        )
        self.assertEqual(house.location, "Test Location B")
        self.assertEqual(house.inside_items, ["Bed", "Table", "Locker"])
        self.assertEqual(house.house_id, "90-000-00") # First house auto-generated sequence

    def test_house_serializer_read(self):
        """Test that the HouseSerializer serializes inside_items correctly."""
        house = House.objects.create(
            location="Test Location C",
            house_type="C",
            status="Active",
            capacity=1,
            inside_items=["Bed", "Locker"],
            created_by=self.user
        )
        serializer = HouseSerializer(house)
        data = serializer.data
        self.assertIn("inside_items", data)
        self.assertEqual(data["inside_items"], ["Bed", "Locker"])

    def test_house_serializer_write(self):
        """Test that the HouseCreateUpdateSerializer validates and deserializes inside_items correctly."""
        serializer = HouseCreateUpdateSerializer(data=self.house_data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        house = serializer.save(created_by=self.user)
        self.assertEqual(house.inside_items, ["Bed", "Chair"])
