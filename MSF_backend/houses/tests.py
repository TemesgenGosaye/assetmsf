from django.test import TestCase
from django.contrib.auth import get_user_model
from .models import House
from .serializers import HouseSerializer, HouseCreateUpdateSerializer

User = get_user_model()

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
