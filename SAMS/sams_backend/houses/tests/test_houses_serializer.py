import pytest
from houses.serializers import HouseCreateUpdateSerializer, HouseSerializer
from houses.models import House

@pytest.mark.django_db
class TestHouseCreateUpdateSerializer:
    def test_validate_location_blank(self):
        data = {
            "location": "   ",
            "house_type": "A",
            "status": "Active",
            "capacity": 1,
        }
        serializer = HouseCreateUpdateSerializer(data=data)
        assert not serializer.is_valid()
        assert "location" in serializer.errors
        assert serializer.errors["location"][0] == "Location cannot be blank."

    def test_validate_capacity_negative(self):
        data = {
            "location": "Block 1",
            "house_type": "A",
            "status": "Active",
            "capacity": 0,
        }
        serializer = HouseCreateUpdateSerializer(data=data)
        assert not serializer.is_valid()
        assert "capacity" in serializer.errors
        assert serializer.errors["capacity"][0] == "Capacity must be at least 1."

    def test_invalid_house_type(self):
        data = {
            "location": "Block 1",
            "house_type": "Z",
            "status": "Active",
            "capacity": 2,
        }
        serializer = HouseCreateUpdateSerializer(data=data)
        assert not serializer.is_valid()
        assert "house_type" in serializer.errors
        assert "House type must be one of" in serializer.errors["house_type"][0]

    def test_invalid_status(self):
        data = {
            "location": "Block 1",
            "house_type": "A",
            "status": "Deprecated",
            "capacity": 2,
        }
        serializer = HouseCreateUpdateSerializer(data=data)
        assert not serializer.is_valid()
        assert "status" in serializer.errors
        assert "Status must be one of" in serializer.errors["status"][0]

    def test_successful_creation(self):
        data = {
            "location": "  Block 2  ",
            "house_type": "B",
            "status": "Inactive",
            "capacity": 5,
        }
        serializer = HouseCreateUpdateSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        house = serializer.save()
        # location is stripped by validate_location
        assert house.location == "Block 2"
        assert house.capacity == 5
        assert house.house_type == "B"
        assert house.status == "Inactive"

@pytest.mark.django_db
class TestHouseSerializer:
    def test_damaged_items_inactive(self):
        house = House.objects.create(
            location="Block 3",
            house_type="C",
            status="Inactive",
            damaged_door=True,
            damaged_windows=False,
            damaged_walls=True,
            damaged_switch=False,
            damaged_bulb=False,
            damaged_water=False,
        )
        ser = HouseSerializer(house)
        assert set(ser.data["damaged_items"]) == {"door", "walls"}

    def test_damaged_items_active(self):
        house = House.objects.create(
            location="Block 4",
            house_type="D",
            status="Active",
            damaged_door=True,
            damaged_windows=True,
        )
        ser = HouseSerializer(house)
        assert ser.data["damaged_items"] == []
