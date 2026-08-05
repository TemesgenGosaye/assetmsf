"""
Views for the employees app.
"""
import json

from rest_framework import generics, filters
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from core.responses import StandardResponse
from core.permissions import IsAdminOrManager
from .models import Employee
from .serializers import EmployeeSerializer, EmployeeCreateUpdateSerializer


class EmployeeListCreateView(generics.ListCreateAPIView):
    """GET /api/employees/  –  POST /api/employees/"""

    queryset = Employee.objects.filter(is_active=True).select_related("department")
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "department"]
    search_fields = [
        "full_name",
        "names",
        "employee_id",
        "national_id",
        "job_position",
        "job_grade",
        "job_type",
    ]
    ordering_fields = ["employee_id", "full_name", "hire_date", "created_at"]
    ordering = ["employee_id"]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return EmployeeCreateUpdateSerializer
        return EmployeeSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = EmployeeSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = EmployeeSerializer(queryset, many=True)
        return StandardResponse.success(serializer.data, "Employees retrieved successfully")

    def create(self, request, *args, **kwargs):
        serializer = EmployeeCreateUpdateSerializer(data=request.data)
        if serializer.is_valid():
            instance = serializer.save(created_by=request.user)
            return StandardResponse.created(
                EmployeeSerializer(instance).data,
                "Employee created successfully",
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)


class EmployeeDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/PATCH/DELETE /api/employees/<uuid:id>/"""

    queryset = Employee.objects.filter(is_active=True).select_related("department")
    permission_classes = [IsAuthenticated]
    lookup_field = "id"
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return EmployeeCreateUpdateSerializer
        return EmployeeSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        return StandardResponse.success(
            EmployeeSerializer(instance).data, "Employee retrieved successfully"
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = EmployeeCreateUpdateSerializer(
            instance, data=request.data, partial=partial
        )
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return StandardResponse.success(
                EmployeeSerializer(instance).data, "Employee updated successfully"
            )
        return StandardResponse.validation_error("Validation failed", serializer.errors)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.soft_delete(request.user)
        return StandardResponse.no_content("Employee deleted successfully")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser])
def employee_bulk_import(request):
    """
    POST /api/employees/bulk-import/

    Accepts a JSON body with an array of employee objects.
    Validates each row (required fields, no duplicate national_id) and
    inserts only valid rows.

    Returns: { created: int, skipped: int, errors: [{row, message}] }
    """
    rows = request.data if isinstance(request.data, list) else request.data.get("employees", [])

    if not isinstance(rows, list):
        return StandardResponse.bad_request(
            "Request body must be a JSON array of employee objects, "
            "or an object with an 'employees' key containing that array."
        )

    # Collect national_ids already in the DB so we can detect duplicates within the batch too
    existing_ids = set(
        Employee.objects.filter(is_active=True).values_list("national_id", flat=True)
    )

    REQUIRED_FIELDS = ["full_name", "national_id", "job_position", "status"]

    created_count = 0
    skipped_count = 0
    errors = []
    seen_in_batch = set()

    for idx, row in enumerate(rows):
        row_num = idx + 1

        if not isinstance(row, dict):
            skipped_count += 1
            errors.append({"row": row_num, "message": "Row is not a JSON object."})
            continue

        # Check required fields
        missing = [f for f in REQUIRED_FIELDS if not str(row.get(f, "")).strip()]
        if missing:
            skipped_count += 1
            errors.append(
                {
                    "row": row_num,
                    "message": f"Missing required fields: {', '.join(missing)}.",
                }
            )
            continue

        national_id = str(row["national_id"]).strip()

        # Duplicate in DB
        if national_id in existing_ids:
            skipped_count += 1
            errors.append(
                {
                    "row": row_num,
                    "message": f"Duplicate national_id '{national_id}' already exists.",
                }
            )
            continue

        # Duplicate within the batch itself
        if national_id in seen_in_batch:
            skipped_count += 1
            errors.append(
                {
                    "row": row_num,
                    "message": f"Duplicate national_id '{national_id}' appears more than once in the import.",
                }
            )
            continue

        # Resolve department FK (accept id, code, or name string)
        department = None
        dept_raw = str(row.get("department", "")).strip()
        if dept_raw:
            from departments.models import Department as Dept
            try:
                import uuid as _uuid
                dept_uuid = _uuid.UUID(dept_raw)
                department = Dept.objects.filter(id=dept_uuid, is_active=True).first()
            except (ValueError, AttributeError):
                department = (
                    Dept.objects.filter(name__iexact=dept_raw, is_active=True).first()
                    or Dept.objects.filter(code__iexact=dept_raw, is_active=True).first()
                )

        # Validate status choice
        valid_statuses = [s.value for s in Employee.Status]
        status_val = str(row.get("status", "Active")).strip()
        if status_val not in valid_statuses:
            skipped_count += 1
            errors.append(
                {
                    "row": row_num,
                    "message": f"Invalid status '{status_val}'. Must be one of: {', '.join(valid_statuses)}.",
                }
            )
            continue

        # Parse hire_date
        hire_date = None
        hire_raw = str(row.get("hire_date", "")).strip()
        if hire_raw:
            import datetime as _dt
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
                try:
                    hire_date = _dt.datetime.strptime(hire_raw, fmt).date()
                    break
                except ValueError:
                    continue
            if hire_date is None:
                skipped_count += 1
                errors.append(
                    {
                        "row": row_num,
                        "message": f"Invalid hire_date '{hire_raw}'. Use YYYY-MM-DD.",
                    }
                )
                continue

        try:
            Employee.objects.create(
                full_name=str(row["full_name"]).strip(),
                names=str(row.get("names", "")).strip(),
                national_id=national_id,
                job_position=str(row["job_position"]).strip(),
                job_grade=str(row.get("job_grade", "")).strip(),
                job_type=str(row.get("job_type", "Permanent")).strip(),
                department=department,
                hire_date=hire_date,
                family_size=int(row.get("family_size", 0) or 0),
                has_disability=bool(row.get("has_disability", False)),
                status=status_val,
                created_by=request.user,
            )
            seen_in_batch.add(national_id)
            existing_ids.add(national_id)  # prevent later duplicates in same batch
            created_count += 1
        except Exception as exc:
            skipped_count += 1
            errors.append({"row": row_num, "message": str(exc)})

    return StandardResponse.success(
        {"created": created_count, "skipped": skipped_count, "errors": errors},
        f"Bulk import completed: {created_count} created, {skipped_count} skipped.",
    )
