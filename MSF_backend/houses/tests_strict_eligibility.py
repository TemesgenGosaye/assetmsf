import json
from django.test import TestCase, Client
from django.contrib.auth.models import User
from houses.models import House, HouseApplication
from houses.allocation_engine import (
    check_strict_eligibility,
    determine_eligible_category,
    check_allocation_constraints,
    auto_allocate_cascade
)

class StrictEligibilityTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testadmin", password="password", is_staff=True)
        self.client = Client()
        self.client.login(username="testadmin", password="password")

    def create_app(self, grade):
        return HouseApplication.objects.create(
            application_no=f"APP-{grade}",
            employee_name="Test Emp",
            employee_id="EMP-123",
            job_grade=grade,
            family_size=3,
            status=HouseApplication.Status.VERIFIED
        )

    def create_house(self, house_type, number="01"):
        return House.objects.create(
            house_id=f"H-{house_type}-{number}",
            house_number=number,
            house_type=house_type,
            status=House.Status.ACTIVE,
            is_active=True,
            allocation_category=House.AllocationCategory.REGULAR
        )

    def test_exact_grade_boundaries(self):
        # (grade, expected_category)
        cases = [
            ("18", "Staff"), ("17", "A"), ("16", "A"), ("15", "A"),
            ("14", "B"), ("13", "B"), ("12", "B"),
            ("11", "C"), ("10", "C"),
            ("9", "D"), ("8", "D"), ("7", "D"),
            ("6", "E"), ("5", "E"), ("0", "E"),
        ]
        
        for grade, expected_cat in cases:
            app = self.create_app(grade)
            cat, reason = determine_eligible_category(app)
            self.assertEqual(cat, expected_cat, f"Grade {grade} should be {expected_cat}, got {cat}")

    def test_invalid_grades_blocked(self):
        invalid_cases = [None, "", "14.5", "abc", "NaN"]
        
        for grade in invalid_cases:
            app = self.create_app(grade)
            cat, reason = determine_eligible_category(app)
            self.assertEqual(cat, "", f"Invalid grade '{grade}' should return empty category")
            
            result = check_strict_eligibility(app)
            self.assertFalse(result.passed, f"Invalid grade '{grade}' should fail strict eligibility")

    def test_cross_category_rejection_in_constraints(self):
        # Grade 14 -> B
        app = self.create_app("14")
        
        for house_type in ["Staff", "A", "C", "D", "E"]:
            house = self.create_house(house_type)
            ok, reasons = check_allocation_constraints(app, house)
            self.assertFalse(ok)
            self.assertTrue(any("HOUSE_CATEGORY_NOT_ELIGIBLE" in r for r in reasons))

        # Test exact match passes category check
        house_b = self.create_house("B")
        ok, reasons = check_allocation_constraints(app, house_b)
        # It might fail for other reasons (capacity) but NOT for category
        self.assertFalse(any("HOUSE_CATEGORY_NOT_ELIGIBLE" in r for r in reasons))

    def test_auto_allocate_cascade_returns_none_not_fallback(self):
        app = self.create_app("14") # Grade 14 -> B
        # Create only an 'E' house
        self.create_house("E")
        
        allocated, result = auto_allocate_cascade(app)
        
        self.assertFalse(allocated)
        self.assertEqual(result.get("recommendation"), "NONE")
        self.assertEqual(result.get("eligible_category"), "B")
        self.assertTrue("skip_reason" in result)

    def test_backend_api_bypass_blocked(self):
        app = self.create_app("14") # Grade 14 -> B
        house_a = self.create_house("A")
        
        # Try to manually allocate via API
        response = self.client.post("/api/houses/allocations/allocate/", {
            "application_id": app.id,
            "house_id": house_a.house_id,
            "allocation_type": "Manual"
        }, content_type="application/json")
        
        self.assertEqual(response.status_code, 400)
        resp_data = response.json()
        self.assertEqual(resp_data["data"]["status"], "REJECTED")
        self.assertEqual(resp_data["data"]["reason"], "HOUSE_CATEGORY_NOT_ELIGIBLE")

        # Try to override via API
        response_override = self.client.post("/api/houses/allocations/allocate/", {
            "application_id": app.id,
            "house_id": house_a.house_id,
            "allocation_type": "Override",
            "override_reason": "Because I am admin"
        }, content_type="application/json")
        
        self.assertEqual(response_override.status_code, 400)
        resp_data_ov = response_override.json()
        self.assertEqual(resp_data_ov["data"]["status"], "REJECTED")
        self.assertEqual(resp_data_ov["data"]["reason"], "HOUSE_CATEGORY_NOT_ELIGIBLE")
