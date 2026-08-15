"""Endpoint tests for housing analytics + house operations (inspection,
maintenance, transfer, rental) â€” the enterprise command-center layer."""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.test import Client
from django.utils import timezone

from employees.models import Employee
from .models import (
    House, HouseApplication, HouseInspection, MaintenanceRequest,
    HouseTransfer, RentalContract, RentalInvoice, RentalPayment, AllocationLog,
)

User = get_user_model()


def jwt_auth(user, password="testpassword123"):
    """Mint a real JWT access token for the user (the API is JWT-authenticated)."""
    from rest_framework_simplejwt.tokens import RefreshToken
    refresh = RefreshToken.for_user(user)
    return {"HTTP_AUTHORIZATION": f"Bearer {refresh.access_token}"}


class OperationsApiTestCase(TestCase):
    """Shared fixtures: admin user, employee, houses, allocated application."""

    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin@example.com", password="testpassword123",
            name="Admin User", role="ADMIN",
        )
        self.requester = User.objects.create_user(
            email="requester@example.com", password="testpassword123",
            name="Requester User", role="REQUESTER",
        )
        self.client = Client()
        self.admin_auth = jwt_auth(self.admin)
        self.requester_auth = jwt_auth(self.requester)

        self.house = House.objects.create(
            location="Compound A", house_type="A", status="Active",
            capacity=1, created_by=self.admin,
        )
        self.target_house = House.objects.create(
            location="Compound B", house_type="B", status="Active",
            capacity=1, created_by=self.admin,
        )
        self.employee = Employee.objects.create(
            employee_id="EMP-OP-001", full_name="Test Employee", national_id="NID-OP-001",
            job_position="Operator", status="Active",
        )

    def get(self, url, **kwargs):
        kwargs.setdefault("HTTP_AUTHORIZATION", self.admin_auth["HTTP_AUTHORIZATION"])
        kwargs.setdefault("secure", True)
        return self.client.get(url, **kwargs)

    def post(self, url, data=None, **kwargs):
        kwargs.setdefault("HTTP_AUTHORIZATION", self.admin_auth["HTTP_AUTHORIZATION"])
        kwargs.setdefault("secure", True)
        if kwargs.pop("format", None) == "json":
            import json as _json
            kwargs["content_type"] = "application/json"
            data = _json.dumps(data or {})
        return self.client.post(url, data=data or {}, **kwargs)

    def patch(self, url, data=None, **kwargs):
        kwargs.setdefault("HTTP_AUTHORIZATION", self.admin_auth["HTTP_AUTHORIZATION"])
        kwargs.setdefault("secure", True)
        if kwargs.pop("format", None) == "json":
            import json as _json
            kwargs["content_type"] = "application/json"
            data = _json.dumps(data or {})
        return self.client.patch(url, data=data or {}, **kwargs)

        self.house = House.objects.create(
            location="Compound A", house_type="A", status="Active",
            capacity=1, created_by=self.admin,
        )
        self.target_house = House.objects.create(
            location="Compound B", house_type="B", status="Active",
            capacity=1, created_by=self.admin,
        )
        self.employee = Employee.objects.create(
            employee_id="EMP-OP-001", full_name="Test Employee", national_id="NID-OP-001",
            job_position="Operator", status="Active",
        )

    def _allocated_app(self, house=None):
        house = house or self.house
        app = HouseApplication.objects.create(
            requester=self.admin,
            emp_record=self.employee,
            employee_id=self.employee.employee_id,
            employee_name=self.employee.full_name,
            national_id="NID-ALLOC-001",
            gender="Male",
            job_position="Operator",
            job_grade="12",
            position_type="Permanent",
            marital_status="Single",
            requested_house_category=house.house_type,
            status=HouseApplication.Status.ALLOCATED,
            submitted_at=timezone.now() - timedelta(days=30),
            allocated_house=house,
            allocated_at=timezone.now(),
            allocated_by=self.admin,
        )
        from .models import Allocation
        Allocation.objects.create(
            application=app,
            house=house,
            emp_record=self.employee,
            employee_id=self.employee.employee_id,
            employee_name=self.employee.full_name,
            status=Allocation.Status.ACTIVE,
            occupancy_status=Allocation.Occupancy.OCCUPIED,
            allocated_at=app.allocated_at,
            allocated_by=self.admin,
            created_by=self.admin,
        )
        return app

    def _waiting_app(self, grade="12"):
        return HouseApplication.objects.create(
            requester=self.admin,
            emp_record=self.employee,
            employee_id=self.employee.employee_id,
            employee_name=self.employee.full_name,
            national_id=f"NID-WAIT-{grade}",
            gender="Female",
            job_position="Operator",
            job_grade=grade,
            position_type="Permanent",
            marital_status="Married",
            family_size=3,
            requested_house_category="A",
            status=HouseApplication.Status.WAITING_FOR_ALLOCATION,
            submitted_at=timezone.now() - timedelta(days=10),
        )


class AnalyticsEndpointTests(OperationsApiTestCase):
    def test_analytics_payload_shape(self):
        self._allocated_app(self.house)
        self._waiting_app()
        response = self.get("/api/houses/analytics/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        data = body["data"]
        self.assertIn("kpis", data)
        self.assertIn("occupancy_by_type", data)
        self.assertIn("applications_by_status", data)
        self.assertIn("eligible_by_category", data)
        self.assertIn("queue_stats", data)
        self.assertIn("allocation_trend_30d", data)
        self.assertIn("allocation_actions", data)
        self.assertIn("alerts", data)
        self.assertGreaterEqual(data["kpis"]["total_houses"], 2)
        self.assertEqual(data["applications_by_status"].get("Allocated"), 1)
        self.assertEqual(data["applications_by_status"].get("Waiting for Allocation"), 1)

    def test_analytics_survives_damaged_inactive_house(self):
        """The alert builder reads house.damaged_items â€” must not raise."""
        House.objects.create(
            location="Compound X", house_type="E", status="Inactive",
            capacity=1, damaged_door=True, damaged_bulb=True, created_by=self.admin,
        )
        response = self.get("/api/houses/analytics/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])

    def test_available_houses(self):
        self._allocated_app(self.house)
        response = self.get("/api/houses/analytics/available/")
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        hids = [row["hid"] for row in data]
        self.assertIn(self.target_house.house_id, hids)
        self.assertNotIn(self.house.house_id, hids)

    def test_conflicts_requires_admin(self):
        response = self.client.get(
            "/api/houses/analytics/conflicts/",
            HTTP_AUTHORIZATION=self.requester_auth["HTTP_AUTHORIZATION"],
            secure=True,
        )
        self.assertEqual(response.status_code, 403)

        response = self.get("/api/houses/analytics/conflicts/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])

    def test_recommendations_admin_only(self):
        self._waiting_app()
        response = self.client.get(
            "/api/houses/analytics/recommendations/",
            HTTP_AUTHORIZATION=self.requester_auth["HTTP_AUTHORIZATION"],
            secure=True,
        )
        self.assertEqual(response.status_code, 403)

        response = self.get("/api/houses/analytics/recommendations/?limit=1")
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertLessEqual(len(data), 1)

    def test_occupancy_register(self):
        self._allocated_app(self.house)
        response = self.get("/api/houses/occupancy/")
        self.assertEqual(response.status_code, 200)
        rows = {r["hid"]: r for r in response.json()["data"]}
        self.assertEqual(rows[self.house.house_id]["current_occupancy"], 1)
        self.assertEqual(rows[self.house.house_id]["occupants"][0]["employee_id"], self.employee.employee_id)

        filtered = self.get("/api/houses/occupancy/?house_type=B")
        hids = [r["hid"] for r in filtered.json()["data"]]
        self.assertEqual(hids, [self.target_house.house_id])


class InspectionOperationTests(OperationsApiTestCase):
    def test_schedule_then_complete_syncs_damage(self):
        payload = {
            "house": str(self.house.id),
            "inspection_type": "Routine",
            "scheduled_date": (timezone.now() + timedelta(days=1)).isoformat(),
            "findings": "OK",
        }
        response = self.post("/api/houses/inspections/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        inspection_id = response.json()["data"]["id"]
        self.assertEqual(response.json()["data"]["status"], "Scheduled")

        complete = self.post(
            f"/api/houses/inspections/{inspection_id}/complete/",
            {
                "checklist_results": {"door": True, "windows": False, "bulb": True},
                "damage_costs": "250.00",
            },
            format="json",
        )
        self.assertEqual(complete.status_code, 200, complete.content)
        self.assertEqual(complete.json()["data"]["status"], "Completed")

        self.house.refresh_from_db()
        self.assertTrue(self.house.damaged_door)
        self.assertTrue(self.house.damaged_bulb)
        self.assertFalse(self.house.damaged_windows)
        self.assertEqual(Decimal("250.00"), Decimal(str(self.house.inspections.first().damage_costs)))

    def test_house_is_required(self):
        response = self.post(
            "/api/houses/inspections/",
            {"inspection_type": "Routine", "scheduled_date": "2026-09-01T10:00:00"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()["success"])


class MaintenanceOperationTests(OperationsApiTestCase):
    def test_create_and_complete(self):
        response = self.post(
            "/api/houses/maintenance-requests/",
            {
                "house": str(self.house.id),
                "title": "Fix water leak",
                "description": "Kitchen pipe leaking",
                "priority": "High",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        request_id = response.json()["data"]["id"]

        update = self.patch(
            f"/api/houses/maintenance-requests/{request_id}/status/",
            {"status": "In Progress", "assigned_to": "Crew A"},
            format="json",
        )
        self.assertEqual(update.status_code, 200, update.content)
        self.assertEqual(update.json()["data"]["status"], "In Progress")

        done = self.patch(
            f"/api/houses/maintenance-requests/{request_id}/status/",
            {"status": "Completed", "cost": "125.50", "resolution_note": "Replaced pipe"},
            format="json",
        )
        self.assertEqual(done.status_code, 200, done.content)
        self.assertTrue(done.json()["data"]["resolved_at"])

    def test_completed_request_is_immutable(self):
        req = MaintenanceRequest.objects.create(
            house=self.house, requested_by=self.admin,
            title="Fix lock", description="Broken lock",
            status=MaintenanceRequest.Status.COMPLETED, created_by=self.admin,
        )
        response = self.patch(
            f"/api/houses/maintenance-requests/{req.id}/status/",
            {"status": "In Progress"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("cannot be modified", response.json()["message"].lower())


class TransferOperationTests(OperationsApiTestCase):
    def setUp(self):
        super().setUp()
        self._allocated_app(self.house)

    def test_approve_transfer_moves_allocation(self):
        response = self.post(
            "/api/houses/transfers/",
            {
                "employee": self.employee.employee_id,
                "target_house": str(self.target_house.id),
                "reason": "Promotion to higher grade",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        transfer_id = response.json()["data"]["id"]
        self.assertEqual(response.json()["data"]["status"], "Pending")

        approve = self.post(
            f"/api/houses/transfers/{transfer_id}/decide/",
            {"decision": "Approved", "notes": "Approved by housing board"},
            format="json",
        )
        self.assertEqual(approve.status_code, 200, approve.content)
        self.assertEqual(approve.json()["data"]["status"], "Approved")

        self.house.refresh_from_db()
        self.target_house.refresh_from_db()
        self.assertEqual(self.house.current_occupancy, 0)
        self.assertEqual(self.target_house.current_occupancy, 1)

        self.assertTrue(
            AllocationLog.objects.filter(
                action=AllocationLog.Action.TRANSFERRED,
                employee_id=self.employee.employee_id,
            ).exists()
        )

        complete = self.post(f"/api/houses/transfers/{transfer_id}/complete/")
        self.assertEqual(complete.status_code, 200)
        self.assertEqual(complete.json()["data"]["status"], "Completed")

    def test_reject_transfer(self):
        response = self.post(
            "/api/houses/transfers/",
            {
                "employee": self.employee.employee_id,
                "target_house": str(self.target_house.id),
                "reason": "Personal request",
            },
            format="json",
        )
        transfer_id = response.json()["data"]["id"]
        reject = self.post(
            f"/api/houses/transfers/{transfer_id}/decide/",
            {"decision": "Rejected"},
            format="json",
        )
        self.assertEqual(reject.status_code, 200, reject.content)
        self.assertEqual(reject.json()["data"]["status"], "Rejected")

        self.house.refresh_from_db()
        self.assertEqual(self.house.current_occupancy, 1)


class RentalOperationTests(OperationsApiTestCase):
    def setUp(self):
        super().setUp()
        self._allocated_app(self.house)

    def _create_contract(self):
        return self.post(
            "/api/houses/contracts/",
            {
                "tenant": self.employee.employee_id,
                "house": str(self.house.id),
                "start_date": "2026-01-01",
                "end_date": "2027-01-01",
                "monthly_rent": "1500.00",
                "security_deposit": "3000.00",
            },
            format="json",
        )

    def test_contract_duplicate_rejected(self):
        first = self._create_contract()
        self.assertEqual(first.status_code, 201, first.content)
        self.assertEqual(first.json()["data"]["status"], "Active")

        dup = self._create_contract()
        self.assertEqual(dup.status_code, 400)
        self.assertIn("already has an active contract", dup.json()["message"].lower())

    def test_invoice_generation_and_payment(self):
        contract = self._create_contract().json()["data"]
        self.assertEqual(contract["monthly_rent"], "1500.00")

        invoice_resp = self.post(
            "/api/houses/invoices/",
            {"billing_month": "2026-02", "due_date": "2026-03-05"},
            format="json",
        )
        self.assertEqual(invoice_resp.status_code, 201, invoice_resp.content)
        self.assertEqual(len(invoice_resp.json()["data"]), 1)
        invoice = invoice_resp.json()["data"][0]
        self.assertEqual(invoice["balance"], "1500.00")

        payment_resp = self.post(
            "/api/houses/payments/",
            {
                "invoice": invoice["id"],
                "amount_paid": "1500.00",
                "payment_method": "Bank Transfer",
                "reference_no": "TXN-0001",
            },
            format="json",
        )
        self.assertEqual(payment_resp.status_code, 201, payment_resp.content)

        refreshed = RentalInvoice.objects.get(id=invoice["id"])
        self.assertEqual(refreshed.paid_amount, Decimal("1500.00"))
        self.assertEqual(refreshed.balance, Decimal("0.00"))
        self.assertEqual(refreshed.status, RentalInvoice.Status.PAID)
        self.assertEqual(RentalPayment.objects.filter(invoice=refreshed).count(), 1)

    def test_rental_summary(self):
        self._create_contract()
        response = self.get("/api/houses/rentals/summary/")
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["active_contracts"], 1)
        self.assertEqual(data["monthly_rent_revenue"], 1500.00)
        self.assertEqual(data["total_invoiced"], 0.0)

    def test_terminate_contract(self):
        contract = self._create_contract().json()["data"]
        response = self.post(
            f"/api/houses/contracts/{contract['id']}/terminate/",
            {"reason": "Tenant relocation"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["data"]["status"], "Terminated")

        again = self.post(f"/api/houses/contracts/{contract['id']}/terminate/")
        self.assertEqual(again.status_code, 400)


class HouseModelDamageTests(TestCase):
    def test_damaged_items_property(self):
        user = User.objects.create_user(
            email="damage@example.com", password="testpassword123",
            name="Damage", role="ADMIN",
        )
        house = House.objects.create(
            location="X", house_type="C", status="Inactive", capacity=1,
            damaged_door=True, damaged_water=True, created_by=user,
        )
        self.assertEqual(house.damaged_items, ["door", "water"])


class ConflictResolutionTests(OperationsApiTestCase):
    """Explicit, audited conflict remediation via the resolve endpoint."""

    def _make_app(self, status, employee_id=None, house=None, allocated=None,
                  national_id=None):
        from .models import Allocation
        employee_id = employee_id or self.employee.employee_id
        app = HouseApplication.objects.create(
            requester=self.admin,
            emp_record=self.employee,
            employee_id=employee_id,
            employee_name=self.employee.full_name,
            national_id=national_id or f"NID-CR-{allocated or status}",
            gender="Male",
            job_position="Operator",
            job_grade="12",
            position_type="Permanent",
            marital_status="Single",
            requested_house_category=house.house_type if house else "A",
            status=status,
            submitted_at=timezone.now() - timedelta(days=10),
            allocated_house=house if status == HouseApplication.Status.ALLOCATED else None,
            allocated_at=allocated,
            allocated_by=self.admin if allocated else None,
        )
        if allocated:
            Allocation.objects.create(
                application=app,
                house=house,
                emp_record=self.employee,
                employee_id=app.employee_id,
                employee_name=app.employee_name,
                status=Allocation.Status.ACTIVE,
                occupancy_status=Allocation.Occupancy.OCCUPIED,
                allocated_at=allocated,
                allocated_by=self.admin,
                created_by=self.admin,
            )
        return app

    def test_orphaned_allocation_resolved_to_queue(self):
        app = self._make_app(HouseApplication.Status.ALLOCATED, allocated=None)
        response = self.post(
            "/api/houses/analytics/conflicts/resolve/",
            {"conflict_type": "orphaned_allocation", "target_id": str(app.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        app.refresh_from_db()
        self.assertEqual(app.status, HouseApplication.Status.WAITING_FOR_ALLOCATION)
        self.assertIsNone(app.allocated_house)
        self.assertIn(
            "Orphaned allocation fixed",
            AllocationLog.objects.filter(application=app).latest("created_at").notes,
        )
        remaining = [c for c in response.json()["data"]["conflicts"]
                     if c["type"] == "orphaned_allocation"]
        self.assertTrue(all(
            str(a["id"]) != str(app.id)
            for c in remaining for a in c.get("applications", [])
        ))

    def test_capacity_breach_frees_overflow(self):
        from .models import Allocation
        house = House.objects.create(
            location="Overflow", house_type="C", status="Active",
            capacity=1, created_by=self.admin,
        )
        now = timezone.now()
        keep = self._make_app(HouseApplication.Status.ALLOCATED, house=house, allocated=now - timedelta(days=20))
        overflow = self._make_app(
            HouseApplication.Status.ALLOCATED, house=house, allocated=now - timedelta(days=5),
            national_id="NID-CR-OVERFLOW",
        )
        response = self.post(
            "/api/houses/analytics/conflicts/resolve/",
            {"conflict_type": "capacity_breach", "target_id": str(house.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertIn(overflow.application_no, response.json()["data"]["resolved"]["freed"])
        overflow.refresh_from_db()
        self.assertEqual(overflow.status, HouseApplication.Status.WAITING_FOR_ALLOCATION)
        self.assertIsNone(overflow.allocated_house)
        self.assertEqual(Allocation.objects.get(application=overflow).status, Allocation.Status.TERMINATED)
        keep.refresh_from_db()
        self.assertEqual(keep.status, HouseApplication.Status.ALLOCATED)

    def test_duplicate_applications_returned_keeping_winner(self):
        winner = self._make_app(HouseApplication.Status.WAITING_FOR_ALLOCATION, national_id="NID-CR-KEEP")
        loser = self._make_app(
            HouseApplication.Status.SUBMITTED, national_id="NID-CR-LOSE",
        )
        response = self.post(
            "/api/houses/analytics/conflicts/resolve/",
            {"conflict_type": "duplicate_application", "target_id": str(winner.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["data"]["resolved"]["kept"], winner.application_no)
        self.assertIn(loser.application_no, response.json()["data"]["resolved"]["returned"])
        winner.refresh_from_db()
        loser.refresh_from_db()
        self.assertEqual(winner.status, HouseApplication.Status.WAITING_FOR_ALLOCATION)
        self.assertEqual(loser.status, HouseApplication.Status.RETURNED)

    def test_already_allocated_returns_extra_app(self):
        self._make_app(
            HouseApplication.Status.ALLOCATED, house=self.house, allocated=timezone.now(),
        )
        extra = self._make_app(
            HouseApplication.Status.VERIFIED, national_id="NID-CR-EXTRA",
        )
        response = self.post(
            "/api/houses/analytics/conflicts/resolve/",
            {"conflict_type": "already_allocated", "target_id": str(extra.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        extra.refresh_from_db()
        self.assertEqual(extra.status, HouseApplication.Status.RETURNED)

    def test_unsupported_conflict_type_rejected(self):
        response = self.post(
            "/api/houses/analytics/conflicts/resolve/",
            {"conflict_type": "overlapping_contract", "target_id": str(self.house.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("not auto-resolvable", response.json()["message"])

    def test_requires_admin(self):
        response = self.client.post(
            "/api/houses/analytics/conflicts/resolve/",
            data={"conflict_type": "orphaned_allocation", "target_id": str(self.house.id)},
            content_type="application/json",
            HTTP_AUTHORIZATION=self.requester_auth["HTTP_AUTHORIZATION"],
            secure=True,
        )
        self.assertEqual(response.status_code, 403)
