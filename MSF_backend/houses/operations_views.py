"""
Views for housing analytics, availability, conflicts, recommendations and
house operations (occupancy, inspections, maintenance, transfers, rentals).

Analytics endpoints are read-only so the command center can poll them freely;
all mutations are gated behind admin/manager permissions.
"""
from rest_framework import generics, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone

from core.responses import StandardResponse
from core.permissions import IsAdminOrManager
from .models import (
    House, HouseInspection, MaintenanceRequest, HouseTransfer,
    RentalContract, RentalInvoice, RentalPayment, HouseApplication,
)
from .serializers import (
    HouseInspectionSerializer, MaintenanceRequestSerializer,
    HouseTransferSerializer, RentalContractSerializer,
    RentalInvoiceSerializer, RentalPaymentSerializer,
    HouseApplicationDetailSerializer,
)
from . import analytics as analytics_service
from . import operations as operations_service


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  ANALYTICS / COMMAND CENTER
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class HousingAnalyticsView(APIView):
    """Unified command-center payload (KPIs, occupancy, queue, allocations, alerts)."""
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        payload = analytics_service.build_housing_analytics(user=request.user)
        return StandardResponse.success(payload, "Housing analytics retrieved")


class AvailableHousesView(APIView):
    """Available units with live occupancy, condition and best-fit candidate."""
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        return StandardResponse.success(
            analytics_service.available_house_insights(),
            "Available houses retrieved",
        )


class ConflictDetectionView(APIView):
    """Relational-integrity / fairness conflict scan."""
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def get(self, request, *args, **kwargs):
        return StandardResponse.success(
            analytics_service.detect_conflicts(user=request.user),
            "Conflict scan complete",
        )


class ResolveConflictView(APIView):
    """
    Explicit, audited conflict remediation.
    Payload: {conflict_type, target_id}
      * orphaned_allocation → target_id = application id (reset to queue)
      * capacity_breach     → target_id = house id (free the overflow)
      * duplicate_application → target_id = application id to KEEP (others returned)
      * already_allocated   → target_id = application id to return
    """
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request, *args, **kwargs):
        conflict_type = request.data.get("conflict_type")
        target_id = request.data.get("target_id")
        if not conflict_type or not target_id:
            return StandardResponse.error(
                "conflict_type and target_id are required",
                status_code=400,
            )
        try:
            result = analytics_service.resolve_conflict(conflict_type, target_id, request.user)
        except ValueError as exc:
            return StandardResponse.error(str(exc), status_code=400)
        return StandardResponse.success(
            {
                "resolved": result,
                "conflicts": analytics_service.detect_conflicts(user=request.user),
            },
            "Conflict resolved",
        )


class RecommendationsView(APIView):
    """Transparent 'what the engine would do' suggestions for vacant houses."""
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def get(self, request, *args, **kwargs):
        limit = None
        raw = request.query_params.get("limit")
        if raw:
            try:
                limit = max(int(raw), 1)
            except (TypeError, ValueError):
                limit = None
        return StandardResponse.success(
            analytics_service.recommend_allocations(limit=limit),
            "Allocation recommendations retrieved",
        )


class OccupancyView(APIView):
    """Live occupancy register — every house with its current occupants."""
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        register = analytics_service.occupant_register()
        house_type = request.query_params.get("house_type")
        status = request.query_params.get("status")
        if house_type:
            register = [r for r in register if r["house_type"] == house_type]
        if status:
            register = [r for r in register if r["status"] == status]
        return StandardResponse.success(register, "Occupancy register retrieved")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  INSPECTIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class InspectionListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    queryset = HouseInspection.objects.filter(is_active=True)
    serializer_class = HouseInspectionSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["house", "status", "inspection_type"]
    search_fields = ["house__house_id", "house__location"]
    ordering_fields = ["scheduled_date", "created_at", "status"]
    ordering = ["-scheduled_date"]

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(HouseInspectionSerializer(page, many=True).data)
        return StandardResponse.success(HouseInspectionSerializer(qs, many=True).data, "Inspections retrieved")

    def create(self, request, *args, **kwargs):
        data = dict(request.data)
        house = self._resolve_house(data.get("house"))
        if house is None:
            return StandardResponse.bad_request("house is required and must exist.")
        try:
            inspection = operations_service.create_inspection(
                user=request.user,
                house=house,
                inspection_type=data.get("inspection_type"),
                scheduled_date=data.get("scheduled_date"),
                findings=data.get("findings", ""),
                checklist_results=data.get("checklist_results"),
            )
            return StandardResponse.created(HouseInspectionSerializer(inspection).data, "Inspection scheduled")
        except (KeyError, ValueError) as e:
            return StandardResponse.bad_request(str(e))

    def _resolve_house(self, value):
        if not value:
            return None
        qs = House.objects.filter(is_active=True)
        try:
            return qs.get(id=value) if not str(value).startswith("90-") else qs.get(house_id=value)
        except House.DoesNotExist:
            return None


class InspectionDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    queryset = HouseInspection.objects.filter(is_active=True)
    serializer_class = HouseInspectionSerializer
    lookup_field = "id"

    def retrieve(self, request, *args, **kwargs):
        return StandardResponse.success(HouseInspectionSerializer(self.get_object()).data, "Inspection retrieved")

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.soft_delete(request.user)
        return StandardResponse.no_content("Inspection deleted")


class InspectionCompleteView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request, *args, **kwargs):
        try:
            inspection = HouseInspection.objects.get(id=kwargs.get("id"), is_active=True)
        except HouseInspection.DoesNotExist:
            return StandardResponse.not_found("Inspection not found")
        try:
            inspection = operations_service.complete_inspection(
                user=request.user,
                inspection=inspection,
                findings=request.data.get("findings", ""),
                damage_costs=request.data.get("damage_costs"),
                checklist_results=request.data.get("checklist_results"),
                status=request.data.get("status", "Completed"),
            )
            return StandardResponse.success(
                HouseInspectionSerializer(inspection).data,
                f"Inspection marked {inspection.status}",
            )
        except ValueError as e:
            return StandardResponse.bad_request(str(e))


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  MAINTENANCE REQUESTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class MaintenanceListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    queryset = MaintenanceRequest.objects.filter(is_active=True)
    serializer_class = MaintenanceRequestSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["house", "status", "priority"]
    search_fields = ["house__house_id", "title", "assigned_to"]
    ordering_fields = ["created_at", "priority", "status", "cost"]
    ordering = ["-created_at"]

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(MaintenanceRequestSerializer(page, many=True).data)
        return StandardResponse.success(MaintenanceRequestSerializer(qs, many=True).data, "Maintenance requests retrieved")

    def create(self, request, *args, **kwargs):
        data = request.data
        house = self._resolve_house(data.get("house"))
        if house is None:
            return StandardResponse.bad_request("house is required and must exist.")
        try:
            req = operations_service.create_maintenance_request(
                user=request.user,
                house=house,
                title=data.get("title", ""),
                description=data.get("description", ""),
                priority=data.get("priority", "Medium"),
            )
            return StandardResponse.created(MaintenanceRequestSerializer(req).data, "Maintenance request created")
        except ValueError as e:
            return StandardResponse.bad_request(str(e))

    def _resolve_house(self, value):
        if not value:
            return None
        qs = House.objects.filter(is_active=True)
        try:
            return qs.get(id=value) if not str(value).startswith("90-") else qs.get(house_id=value)
        except House.DoesNotExist:
            return None


class MaintenanceDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    queryset = MaintenanceRequest.objects.filter(is_active=True)
    serializer_class = MaintenanceRequestSerializer
    lookup_field = "id"

    def retrieve(self, request, *args, **kwargs):
        return StandardResponse.success(MaintenanceRequestSerializer(self.get_object()).data, "Maintenance request retrieved")

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.soft_delete(request.user)
        return StandardResponse.no_content("Maintenance request deleted")


class MaintenanceStatusView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def patch(self, request, *args, **kwargs):
        try:
            req = MaintenanceRequest.objects.get(id=kwargs.get("id"), is_active=True)
        except MaintenanceRequest.DoesNotExist:
            return StandardResponse.not_found("Maintenance request not found")
        new_status = request.data.get("status")
        if new_status not in ("Pending", "In Progress", "Completed", "Cancelled"):
            return StandardResponse.bad_request("Invalid status")
        try:
            req = operations_service.update_maintenance_status(
                user=request.user,
                request_obj=req,
                new_status=new_status,
                cost=request.data.get("cost"),
                assigned_to=request.data.get("assigned_to", ""),
                resolution_note=request.data.get("resolution_note", ""),
            )
            return StandardResponse.success(MaintenanceRequestSerializer(req).data, f"Status → '{new_status}'")
        except ValueError as e:
            return StandardResponse.bad_request(str(e))


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  TRANSFERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TransferListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    queryset = HouseTransfer.objects.filter(is_active=True)
    serializer_class = HouseTransferSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "employee", "target_house"]
    search_fields = ["employee__full_name", "employee__employee_id", "reason"]
    ordering_fields = ["created_at", "status"]
    ordering = ["-created_at"]

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(HouseTransferSerializer(page, many=True).data)
        return StandardResponse.success(HouseTransferSerializer(qs, many=True).data, "Transfers retrieved")

    def create(self, request, *args, **kwargs):
        from employees.models import Employee
        employee_id = request.data.get("employee")
        target_house = request.data.get("target_house")
        reason = request.data.get("reason", "")
        if not employee_id or not target_house:
            return StandardResponse.bad_request("employee and target_house are required")
        try:
            employee = Employee.objects.get(employee_id=employee_id, status="Active")
        except Employee.DoesNotExist:
            return StandardResponse.bad_request(f"Employee '{employee_id}' not found")
        house = self._resolve_house(target_house)
        if house is None:
            return StandardResponse.bad_request("Target house not found")
        current_app = HouseApplication.objects.filter(
            emp_record=employee, status="Allocated", is_active=True,
        ).select_related("allocated_house").first()
        current_house = current_app.allocated_house if current_app else None
        try:
            transfer = operations_service.request_transfer(
                user=request.user,
                employee=employee,
                current_house=current_house,
                target_house=house,
                reason=reason,
            )
            return StandardResponse.created(HouseTransferSerializer(transfer).data, "Transfer requested")
        except ValueError as e:
            return StandardResponse.bad_request(str(e))

    def _resolve_house(self, value):
        if not value:
            return None
        qs = House.objects.filter(is_active=True)
        try:
            return qs.get(id=value) if not str(value).startswith("90-") else qs.get(house_id=value)
        except House.DoesNotExist:
            return None


class TransferDetailView(generics.RetrieveDestroyAPIView):
    permission_classes = [IsAuthenticated]
    queryset = HouseTransfer.objects.filter(is_active=True)
    serializer_class = HouseTransferSerializer
    lookup_field = "id"

    def retrieve(self, request, *args, **kwargs):
        return StandardResponse.success(HouseTransferSerializer(self.get_object()).data, "Transfer retrieved")

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.soft_delete(request.user)
        return StandardResponse.no_content("Transfer deleted")


class TransferDecideView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request, *args, **kwargs):
        try:
            transfer = HouseTransfer.objects.get(id=kwargs.get("id"), is_active=True)
        except HouseTransfer.DoesNotExist:
            return StandardResponse.not_found("Transfer not found")
        decision = request.data.get("decision")
        try:
            transfer = operations_service.decide_transfer(
                user=request.user,
                transfer=transfer,
                decision=decision,
                notes=request.data.get("notes", ""),
            )
            return StandardResponse.success(
                HouseTransferSerializer(transfer).data,
                f"Transfer {transfer.status}",
            )
        except ValueError as e:
            return StandardResponse.bad_request(str(e))


class TransferCompleteView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request, *args, **kwargs):
        try:
            transfer = HouseTransfer.objects.get(id=kwargs.get("id"), is_active=True)
        except HouseTransfer.DoesNotExist:
            return StandardResponse.not_found("Transfer not found")
        try:
            transfer = operations_service.complete_transfer(user=request.user, transfer=transfer)
            return StandardResponse.success(HouseTransferSerializer(transfer).data, "Transfer completed")
        except ValueError as e:
            return StandardResponse.bad_request(str(e))


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  RENTALS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class ContractListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    queryset = RentalContract.objects.filter(is_active=True)
    serializer_class = RentalContractSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "house", "tenant"]
    search_fields = ["contract_no", "tenant__full_name", "house__house_id"]
    ordering_fields = ["created_at", "end_date", "status", "monthly_rent"]
    ordering = ["-created_at"]

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(RentalContractSerializer(page, many=True).data)
        return StandardResponse.success(RentalContractSerializer(qs, many=True).data, "Contracts retrieved")

    def create(self, request, *args, **kwargs):
        from employees.models import Employee
        data = request.data
        try:
            tenant = Employee.objects.get(employee_id=data.get("tenant"), status="Active")
        except Employee.DoesNotExist:
            return StandardResponse.bad_request("tenant employee not found")
        house = self._resolve_house(data.get("house"))
        if house is None:
            return StandardResponse.bad_request("house not found")
        application = None
        if data.get("application"):
            application = HouseApplication.objects.filter(
                id=data.get("application"), is_active=True,
            ).first()
        try:
            contract = operations_service.create_rental_contract(
                user=request.user,
                tenant=tenant,
                house=house,
                start_date=data.get("start_date"),
                end_date=data.get("end_date"),
                monthly_rent=data.get("monthly_rent"),
                security_deposit=data.get("security_deposit", 0),
                terms_conditions=data.get("terms_conditions", ""),
                application=application,
            )
            return StandardResponse.created(RentalContractSerializer(contract).data, "Contract created")
        except ValueError as e:
            return StandardResponse.bad_request(str(e))

    def _resolve_house(self, value):
        if not value:
            return None
        qs = House.objects.filter(is_active=True)
        try:
            return qs.get(id=value) if not str(value).startswith("90-") else qs.get(house_id=value)
        except House.DoesNotExist:
            return None


class ContractDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    queryset = RentalContract.objects.filter(is_active=True)
    serializer_class = RentalContractSerializer
    lookup_field = "id"

    def retrieve(self, request, *args, **kwargs):
        return StandardResponse.success(RentalContractSerializer(self.get_object()).data, "Contract retrieved")

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.soft_delete(request.user)
        return StandardResponse.no_content("Contract deleted")


class ContractTerminateView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request, *args, **kwargs):
        try:
            contract = RentalContract.objects.get(id=kwargs.get("id"), is_active=True)
        except RentalContract.DoesNotExist:
            return StandardResponse.not_found("Contract not found")
        try:
            contract = operations_service.cancel_contract(
                user=request.user, contract=contract,
                reason=request.data.get("reason", ""),
            )
            return StandardResponse.success(RentalContractSerializer(contract).data, "Contract terminated")
        except ValueError as e:
            return StandardResponse.bad_request(str(e))


class InvoiceListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    queryset = RentalInvoice.objects.filter(is_active=True)
    serializer_class = RentalInvoiceSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "contract", "tenant", "billing_month"]
    search_fields = ["invoice_no", "tenant__full_name"]
    ordering_fields = ["due_date", "balance", "status", "billing_month"]
    ordering = ["-due_date"]

    def list(self, request, *args, **kwargs):
        operations_service.update_overdue_invoices()
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(RentalInvoiceSerializer(page, many=True).data)
        return StandardResponse.success(RentalInvoiceSerializer(qs, many=True).data, "Invoices retrieved")

    def create(self, request, *args, **kwargs):
        data = request.data
        if not data.get("billing_month") or not data.get("due_date"):
            return StandardResponse.bad_request("billing_month and due_date are required")
        try:
            invoices = operations_service.generate_monthly_invoices(
                user=request.user,
                billing_month=data.get("billing_month"),
                due_date=data.get("due_date"),
            )
            return StandardResponse.created(
                RentalInvoiceSerializer(invoices, many=True).data,
                f"{len(invoices)} invoice(s) generated",
            )
        except ValueError as e:
            return StandardResponse.bad_request(str(e))


class InvoiceDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    queryset = RentalInvoice.objects.filter(is_active=True)
    serializer_class = RentalInvoiceSerializer
    lookup_field = "id"

    def retrieve(self, request, *args, **kwargs):
        return StandardResponse.success(RentalInvoiceSerializer(self.get_object()).data, "Invoice retrieved")

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.soft_delete(request.user)
        return StandardResponse.no_content("Invoice deleted")


class PaymentListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    queryset = RentalPayment.objects.filter(is_active=True)
    serializer_class = RentalPaymentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["invoice", "payment_method"]
    search_fields = ["receipt_no", "reference_no", "invoice__invoice_no"]
    ordering_fields = ["created_at", "amount_paid"]
    ordering = ["-created_at"]

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(RentalPaymentSerializer(page, many=True).data)
        return StandardResponse.success(RentalPaymentSerializer(qs, many=True).data, "Payments retrieved")

    def create(self, request, *args, **kwargs):
        data = request.data
        try:
            invoice = RentalInvoice.objects.get(id=data.get("invoice"), is_active=True)
        except RentalInvoice.DoesNotExist:
            return StandardResponse.bad_request("invoice not found")
        try:
            payment = operations_service.record_payment(
                user=request.user,
                invoice=invoice,
                amount_paid=data.get("amount_paid"),
                method=data.get("payment_method", "Bank Transfer"),
                reference_no=data.get("reference_no", ""),
                notes=data.get("notes", ""),
            )
            return StandardResponse.created(RentalPaymentSerializer(payment).data, "Payment recorded")
        except ValueError as e:
            return StandardResponse.bad_request(str(e))


class InvoicePaymentsView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = RentalPaymentSerializer

    def get_queryset(self):
        return RentalPayment.objects.filter(invoice_id=self.kwargs.get("id"), is_active=True)

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        return StandardResponse.success(RentalPaymentSerializer(qs, many=True).data, "Invoice payments retrieved")


class RentalSummaryView(APIView):
    """Rent roll summary — active contracts, monthly revenue, outstanding balances."""
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        from decimal import Decimal
        from django.db.models import Sum
        contracts = RentalContract.objects.filter(status=RentalContract.Status.ACTIVE)
        invoices = RentalInvoice.objects.filter(is_active=True)
        total_paid = invoices.aggregate(total=Sum("paid_amount"))["total"] or Decimal("0.00")
        outstanding = invoices.aggregate(total=Sum("balance"))["total"] or Decimal("0.00")
        return StandardResponse.success({
            "active_contracts": contracts.count(),
            "monthly_rent_revenue": float(contracts.aggregate(total=Sum("monthly_rent"))["total"] or Decimal("0.00")),
            "total_invoiced": float(invoices.aggregate(total=Sum("rent_amount"))["total"] or Decimal("0.00")),
            "total_collected": float(total_paid),
            "outstanding_balance": float(outstanding),
            "overdue_invoices": invoices.filter(
                status__in=[RentalInvoice.Status.UNPAID, RentalInvoice.Status.PARTIAL, RentalInvoice.Status.OVERDUE],
                due_date__lt=timezone.now().date(),
            ).count(),
        }, "Rental summary retrieved")


class RentRollMatrixView(APIView):
    """
    GET /api/houses/invoices/rent-roll/?year=2026
    Returns annual rent matrix grouped by active contracts and 12 calendar months.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        year_param = request.query_params.get("year")
        try:
            year = int(year_param) if year_param else timezone.now().year
        except (TypeError, ValueError):
            year = timezone.now().year

        data = operations_service.get_annual_rent_roll(year)
        return StandardResponse.success(data, f"Annual rent roll retrieved for {year}")

