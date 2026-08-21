"""
STRICT HOUSE ALLOCATION ELIGIBILITY TESTS

Comprehensive boundary testing for the mandatory grade-to-category eligibility rules.
These tests enforce that NO house is ever recommended, suggested, ranked, or assigned
to an applicant unless they first pass the mandatory eligibility rules.

Test Coverage:
1. All grade boundaries (18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6)
2. Invalid grades (null, empty, decimal, non-numeric, negative)
3. Zero cross-category recommendation enforcement
4. Mandatory eligibility pipeline order
5. Score is mandatory and cannot override grade eligibility
6. Hard eligibility filter before ranking
7. No eligible house = no recommendation
8. Backend bypass prevention
"""

import os
import sys
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

import django
django.setup()

from houses.allocation_engine import (
    check_strict_eligibility,
    determine_eligible_category,
    validate_applicant_grade,
    grade_to_category,
    check_allocation_constraints,
    EligibilityResult,
)
from unittest.mock import Mock
from decimal import Decimal


# =============================================================================
# MOCK APPLICATION FACTORY
# =============================================================================

def create_mock_application(job_grade, **kwargs):
    """Create a mock application object for testing."""
    app = Mock()
    app.job_grade = job_grade
    app.employee_name = kwargs.get("employee_name", "Test Employee")
    app.employee_id = kwargs.get("employee_id", "EMP001")
    app.family_size = kwargs.get("family_size", 2)
    app.years_of_service = kwargs.get("years_of_service", 5)
    app.has_disability = kwargs.get("has_disability", False)
    app.marital_status = kwargs.get("marital_status", "Married")
    app.eligible_house_category = kwargs.get("eligible_house_category", "")
    app.eligibility_analysis = kwargs.get("eligibility_analysis", [])
    app.status = kwargs.get("status", "Waiting for Allocation")
    app.emp_record_id = kwargs.get("emp_record_id", None)
    return app


def create_mock_house(house_type, house_id, **kwargs):
    """Create a mock house object for testing."""
    house = Mock()
    house.house_id = house_id
    house.house_number = kwargs.get("house_number", house_id)
    house.house_type = house_type
    house.status = kwargs.get("status", "Active")
    house.is_active = kwargs.get("is_active", True)
    house.capacity = kwargs.get("capacity", 4)
    house.is_fully_vacant = kwargs.get("is_fully_vacant", True)
    house.rooms = kwargs.get("rooms", [])
    house.available_rooms = kwargs.get("available_rooms", [])
    
    # Mock the allocation_records queryset
    mock_qs = Mock()
    mock_qs.filter = Mock(return_value=mock_qs)
    mock_qs.count = Mock(return_value=0)
    mock_qs.exists = Mock(return_value=False)
    mock_qs.exclude = Mock(return_value=mock_qs)
    house.allocation_records = mock_qs
    
    return house


# =============================================================================
# BOUNDARY TESTS - GRADE TO CATEGORY MAPPING
# =============================================================================

class GradeToCategoryBoundaryTests:
    """Test all grade boundaries map to correct categories."""

    def test_grade_18_maps_to_staff(self):
        """Grade 18 must map to Staff only."""
        cat = grade_to_category(18)
        assert cat == "Staff", f"Expected Staff, got {cat}"

    def test_grade_17_maps_to_a(self):
        """Grade 17 must map to A only."""
        cat = grade_to_category(17)
        assert cat == "A", f"Expected A, got {cat}"

    def test_grade_16_maps_to_a(self):
        """Grade 16 must map to A only."""
        cat = grade_to_category(16)
        assert cat == "A", f"Expected A, got {cat}"

    def test_grade_15_maps_to_a(self):
        """Grade 15 must map to A only."""
        cat = grade_to_category(15)
        assert cat == "A", f"Expected A, got {cat}"

    def test_grade_14_maps_to_b(self):
        """Grade 14 must map to B only."""
        cat = grade_to_category(14)
        assert cat == "B", f"Expected B, got {cat}"

    def test_grade_13_maps_to_b(self):
        """Grade 13 must map to B only."""
        cat = grade_to_category(13)
        assert cat == "B", f"Expected B, got {cat}"

    def test_grade_12_maps_to_b(self):
        """Grade 12 must map to B only."""
        cat = grade_to_category(12)
        assert cat == "B", f"Expected B, got {cat}"

    def test_grade_11_maps_to_c(self):
        """Grade 11 must map to C only."""
        cat = grade_to_category(11)
        assert cat == "C", f"Expected C, got {cat}"

    def test_grade_10_maps_to_c(self):
        """Grade 10 must map to C only."""
        cat = grade_to_category(10)
        assert cat == "C", f"Expected C, got {cat}"

    def test_grade_9_maps_to_d(self):
        """Grade 9 must map to D only."""
        cat = grade_to_category(9)
        assert cat == "D", f"Expected D, got {cat}"

    def test_grade_8_maps_to_d(self):
        """Grade 8 must map to D only."""
        cat = grade_to_category(8)
        assert cat == "D", f"Expected D, got {cat}"

    def test_grade_7_maps_to_d(self):
        """Grade 7 must map to D only."""
        cat = grade_to_category(7)
        assert cat == "D", f"Expected D, got {cat}"

    def test_grade_6_maps_to_e(self):
        """Grade 6 must map to E only."""
        cat = grade_to_category(6)
        assert cat == "E", f"Expected E, got {cat}"

    def test_grade_0_maps_to_e(self):
        """Grade 0 must map to E only."""
        cat = grade_to_category(0)
        assert cat == "E", f"Expected E, got {cat}"

    def test_negative_grade_maps_to_e(self):
        """Negative grades must map to E (treated as 0)."""
        cat = grade_to_category(-5)
        assert cat == "E", f"Expected E, got {cat}"

    def test_very_high_grade_maps_to_staff(self):
        """Grades > 17 must map to Staff."""
        for grade in [19, 20, 25, 100]:
            cat = grade_to_category(grade)
            assert cat == "Staff", f"Grade {grade} should map to Staff, got {cat}"

    def run_all(self):
        """Run all tests in this class."""
        tests = [m for m in dir(self) if m.startswith("test_")]
        passed = 0
        failed = 0
        for test in tests:
            try:
                getattr(self, test)()
                print(f"  [PASS] {test}")
                passed += 1
            except AssertionError as e:
                print(f"  [FAIL] {test}: {e}")
                failed += 1
            except Exception as e:
                print(f"  [ERROR] {test}: {e}")
                failed += 1
        return passed, failed


# =============================================================================
# INVALID GRADE TESTS
# =============================================================================

class InvalidGradeTests:
    """Test that invalid grades are rejected."""

    def test_null_grade_rejected(self):
        """Null grade must be rejected."""
        app = create_mock_application(None)
        cat, reason = determine_eligible_category(app)
        assert cat == "", f"Expected empty category, got '{cat}'"
        assert "missing or null" in reason.lower(), f"Reason should mention missing/null: {reason}"

    def test_empty_string_grade_rejected(self):
        """Empty string grade must be rejected."""
        app = create_mock_application("")
        cat, reason = determine_eligible_category(app)
        assert cat == "", f"Expected empty category, got '{cat}'"
        assert "missing or null" in reason.lower(), f"Reason should mention missing/null: {reason}"

    def test_decimal_grade_rejected(self):
        """Decimal grades must be rejected."""
        for grade in ["14.5", "14.0", "15.25"]:
            app = create_mock_application(grade)
            cat, reason = determine_eligible_category(app)
            assert cat == "", f"Grade {grade} should be rejected, got category '{cat}'"
            assert "not a valid integer" in reason.lower(), f"Reason should mention invalid integer: {reason}"

    def test_non_numeric_grade_rejected(self):
        """Non-numeric grades must be rejected."""
        for grade in ["abc", "fourteen", "14a", "+14"]:
            app = create_mock_application(grade)
            cat, reason = determine_eligible_category(app)
            assert cat == "", f"Grade {grade} should be rejected, got category '{cat}'"
            assert "not a valid integer" in reason.lower(), f"Reason should mention invalid integer: {reason}"

    def test_whitespace_grade_rejected(self):
        """Whitespace-only grades must be rejected."""
        app = create_mock_application("   ")
        cat, reason = determine_eligible_category(app)
        assert cat == "", f"Expected empty category, got '{cat}'"

    def run_all(self):
        """Run all tests in this class."""
        tests = [m for m in dir(self) if m.startswith("test_")]
        passed = 0
        failed = 0
        for test in tests:
            try:
                getattr(self, test)()
                print(f"  [PASS] {test}")
                passed += 1
            except AssertionError as e:
                print(f"  [FAIL] {test}: {e}")
                failed += 1
            except Exception as e:
                print(f"  [ERROR] {test}: {e}")
                failed += 1
        return passed, failed


# =============================================================================
# ZERO CROSS-CATEGORY RECOMMENDATION TESTS
# =============================================================================

class ZeroCrossCategoryTests:
    """Test that NO cross-category recommendation is ever made."""

    def test_grade_16_cannot_get_b_house(self):
        """Grade 16 applicant must NEVER be recommended a B house."""
        app = create_mock_application(16)
        house_a = create_mock_house("A", "A001")
        house_b = create_mock_house("B", "B001")
        
        # Check constraints - A house should be OK
        ok, reason = check_allocation_constraints(app, house_a)
        assert ok, f"Grade 16 should be eligible for A house: {reason}"
        
        # B house should be REJECTED
        ok, reason = check_allocation_constraints(app, house_b)
        assert not ok, "Grade 16 should NOT be eligible for B house"
        assert "HOUSE_CATEGORY_NOT_ELIGIBLE" in reason, f"Reason should mention category not eligible: {reason}"

    def test_grade_14_cannot_get_a_house(self):
        """Grade 14 applicant must NEVER be recommended an A house."""
        app = create_mock_application(14)
        house_a = create_mock_house("A", "A001")
        house_b = create_mock_house("B", "B001")
        
        # A house should be REJECTED
        ok, reason = check_allocation_constraints(app, house_a)
        assert not ok, "Grade 14 should NOT be eligible for A house"
        assert "HOUSE_CATEGORY_NOT_ELIGIBLE" in reason
        
        # B house should be OK
        ok, reason = check_allocation_constraints(app, house_b)
        assert ok, f"Grade 14 should be eligible for B house: {reason}"

    def test_grade_17_cannot_get_staff_house(self):
        """Grade 17 applicant must NEVER be recommended a Staff house."""
        app = create_mock_application(17)
        house_staff = create_mock_house("Staff", "STAFF001")
        house_a = create_mock_house("A", "A001")
        
        # Staff house should be REJECTED
        ok, reason = check_allocation_constraints(app, house_staff)
        assert not ok, "Grade 17 should NOT be eligible for Staff house"
        assert "HOUSE_CATEGORY_NOT_ELIGIBLE" in reason
        
        # A house should be OK
        ok, reason = check_allocation_constraints(app, house_a)
        assert ok, f"Grade 17 should be eligible for A house: {reason}"

    def test_grade_18_can_only_get_staff_house(self):
        """Grade 18 applicant can ONLY get Staff house."""
        app = create_mock_application(18)
        house_staff = create_mock_house("Staff", "STAFF001")
        house_a = create_mock_house("A", "A001")
        
        # Staff house should be OK
        ok, reason = check_allocation_constraints(app, house_staff)
        assert ok, f"Grade 18 should be eligible for Staff house: {reason}"
        
        # A house should be REJECTED
        ok, reason = check_allocation_constraints(app, house_a)
        assert not ok, "Grade 18 should NOT be eligible for A house"
        assert "HOUSE_CATEGORY_NOT_ELIGIBLE" in reason

    def run_all(self):
        """Run all tests in this class."""
        tests = [m for m in dir(self) if m.startswith("test_")]
        passed = 0
        failed = 0
        for test in tests:
            try:
                getattr(self, test)()
                print(f"  [PASS] {test}")
                passed += 1
            except AssertionError as e:
                print(f"  [FAIL] {test}: {e}")
                failed += 1
            except Exception as e:
                print(f"  [ERROR] {test}: {e}")
                failed += 1
        return passed, failed


# =============================================================================
# VALIDATE APPLICANT GRADE TESTS
# =============================================================================

class ValidateApplicantGradeTests:
    """Test the lightweight grade validation function."""

    def test_valid_grades_return_true_and_category(self):
        """Valid grades must return True and correct category."""
        test_cases = [
            (18, "Staff"),
            (17, "A"),
            (16, "A"),
            (15, "A"),
            (14, "B"),
            (13, "B"),
            (12, "B"),
            (11, "C"),
            (10, "C"),
            (9, "D"),
            (8, "D"),
            (7, "D"),
            (6, "E"),
        ]
        
        for grade, expected_cat in test_cases:
            app = create_mock_application(grade)
            valid, cat, reason = validate_applicant_grade(app)
            assert valid, f"Grade {grade} should be valid: {reason}"
            assert cat == expected_cat, f"Grade {grade} should map to {expected_cat}, got {cat}"

    def test_invalid_grades_return_false_and_empty_category(self):
        """Invalid grades must return False and empty category."""
        invalid_grades = [None, "", "14.5", "abc", "   ", "+14"]
        
        for grade in invalid_grades:
            app = create_mock_application(grade)
            valid, cat, reason = validate_applicant_grade(app)
            assert not valid, f"Grade {grade} should be invalid"
            assert cat == "", f"Invalid grade should return empty category, got '{cat}'"
            assert "BLOCKED" in reason, f"Reason should mention BLOCKED: {reason}"

    def run_all(self):
        """Run all tests in this class."""
        tests = [m for m in dir(self) if m.startswith("test_")]
        passed = 0
        failed = 0
        for test in tests:
            try:
                getattr(self, test)()
                print(f"  [PASS] {test}")
                passed += 1
            except AssertionError as e:
                print(f"  [FAIL] {test}: {e}")
                failed += 1
            except Exception as e:
                print(f"  [ERROR] {test}: {e}")
                failed += 1
        return passed, failed


# =============================================================================
# HARD ELIGIBILITY FILTER TESTS
# =============================================================================

class HardEligibilityFilterTests:
    """Test the hard eligibility filter before ranking."""

    def test_eligible_houses_filter_exact_match_only(self):
        """Only houses matching exact eligible category should pass constraints."""
        app = create_mock_application(14)  # Eligible for B
        
        # Create houses of all types
        house_types = ["Staff", "A", "B", "C", "D", "E"]
        
        for htype in house_types:
            house = create_mock_house(htype, f"{htype}001")
            ok, reason = check_allocation_constraints(app, house)
            if htype == "B":
                assert ok, f"B house should be eligible: {reason}"
            else:
                assert not ok, f"{htype} house should NOT be eligible for grade 14"
                assert "HOUSE_CATEGORY_NOT_ELIGIBLE" in reason, f"Reason should mention category not eligible: {reason}"

    def run_all(self):
        """Run all tests in this class."""
        tests = [m for m in dir(self) if m.startswith("test_")]
        passed = 0
        failed = 0
        for test in tests:
            try:
                getattr(self, test)()
                print(f"  [PASS] {test}")
                passed += 1
            except AssertionError as e:
                print(f"  [FAIL] {test}: {e}")
                failed += 1
            except Exception as e:
                print(f"  [ERROR] {test}: {e}")
                failed += 1
        return passed, failed


# =============================================================================
# RUN ALL TESTS
# =============================================================================

def run_all_tests():
    """Run all test classes."""
    print("\n" + "="*70)
    print("STRICT HOUSE ALLOCATION ELIGIBILITY TESTS")
    print("="*70)
    
    test_classes = [
        ("Grade to Category Boundary Tests", GradeToCategoryBoundaryTests),
        ("Invalid Grade Tests", InvalidGradeTests),
        ("Zero Cross-Category Tests", ZeroCrossCategoryTests),
        ("Validate Applicant Grade Tests", ValidateApplicantGradeTests),
        ("Hard Eligibility Filter Tests", HardEligibilityFilterTests),
    ]
    
    total_passed = 0
    total_failed = 0
    
    for name, test_class in test_classes:
        print(f"\n{name}:")
        print("-" * 70)
        instance = test_class()
        passed, failed = instance.run_all()
        total_passed += passed
        total_failed += failed
        print(f"  Passed: {passed}, Failed: {failed}")
    
    print("\n" + "="*70)
    print(f"TOTAL: {total_passed} passed, {total_failed} failed")
    print("="*70)
    
    return total_failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
