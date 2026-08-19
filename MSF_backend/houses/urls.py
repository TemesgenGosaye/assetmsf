from django.urls import path
from .views import (
    HouseListCreateView, HouseDetailView,
    HouseApplicationListCreateView, HouseApplicationDetailView,
    HouseApplicationSubmitView, HouseApplicationStatusUpdateView,
    HouseApplicationDashboardView,
    HouseQueueView, HouseApplicationRecalcScoreView,
    AutoAllocateView, BatchAllocateView, ManualAllocateView, DeallocateView,
    ScoringConfigListCreateView, ScoringConfigDetailView,
    EligibilityRuleListCreateView, EligibilityRuleDetailView,
    AllocationLogListView,
    ReviewOverviewView,
    HouseOpportunityListView, ApplicationOpportunitiesView,
    GenerateOpportunitiesView, RankOpportunitiesView,
    AllocationListView, AllocationDetailView,
    AllocateView, TerminateAllocationView,
    ApplicationAuditView,
    HandoverReceiptListCreateView, HandoverReceiptDetailView, HandoverReceiptPrintView,
    TerminationCaseListCreateView, TerminationCaseDetailView,
    TerminationTransactionListCreateView, TerminationTransactionDetailView,
    TerminationApproveView, TerminationProcessView,
    TerminationVerifyCodeView, TerminationResolveIssuesView,
    TerminateWithCodeView,
    TerminationStatsView, AllocatedEmployeesListView,
)
from .operations_views import (
    HousingAnalyticsView, AvailableHousesView, ConflictDetectionView,
    ResolveConflictView, RecommendationsView, OccupancyView,
    InspectionListCreateView, InspectionDetailView, InspectionCompleteView,
    PostInspectionListCreateView, PostInspectionDetailView, PostInspectionCompleteView,
    PreInspectionValidationView,
    MaintenanceListCreateView, MaintenanceDetailView, MaintenanceStatusView,
    ApplicantMaintenanceSubmitView, ApplicantMaintenanceListView,
    CivilWorkPanelView, CivilWorkReceiveView, CivilWorkAssignView,
    CivilWorkUpdateView, CivilWorkStatsView,
    TransferListCreateView, TransferDetailView, TransferDecideView, TransferCompleteView,
    ContractListCreateView, ContractDetailView, ContractTerminateView,
    InvoiceListCreateView, InvoiceDetailView,
    PaymentListCreateView, InvoicePaymentsView, RentalSummaryView, RentRollMatrixView,
)

urlpatterns = [
    # ── Houses CRUD ────────────────────────────────────────────────────
    path("",                           HouseListCreateView.as_view(),                name="house_list_create"),
    path("<uuid:id>/",                 HouseDetailView.as_view(),                    name="house_detail"),

    # ── Applications CRUD + workflow ───────────────────────────────────
    path("applications/",              HouseApplicationListCreateView.as_view(),     name="application_list_create"),
    path("applications/dashboard/",    HouseApplicationDashboardView.as_view(),      name="application_dashboard"),
    path("applications/<uuid:id>/",    HouseApplicationDetailView.as_view(),         name="application_detail"),
    path("applications/<uuid:id>/submit/",  HouseApplicationSubmitView.as_view(),     name="application_submit"),
    path("applications/<uuid:id>/status/",  HouseApplicationStatusUpdateView.as_view(), name="application_status"),
    path("applications/<uuid:id>/recalculate-score/", HouseApplicationRecalcScoreView.as_view(), name="application_recalc_score"),

    # ── Queue & Allocation engine ──────────────────────────────────────
    path("queue/",                     HouseQueueView.as_view(),                     name="house_queue"),
    path("auto-allocate/",             AutoAllocateView.as_view(),                   name="auto_allocate"),
    path("batch-allocate/",            BatchAllocateView.as_view(),                  name="batch_allocate"),
    path("manual-allocate/",           ManualAllocateView.as_view(),                 name="manual_allocate"),
    path("deallocate/",                DeallocateView.as_view(),                     name="deallocate"),

    # ── Review queue overview ──────────────────────────────────────────
    path("review/overview/",           ReviewOverviewView.as_view(),                 name="review_overview"),

    # ── House opportunities (house_opp) ────────────────────────────────
    path("opportunities/",             HouseOpportunityListView.as_view(),           name="opportunity_list"),
    path("applications/<uuid:id>/opportunities/", ApplicationOpportunitiesView.as_view(), name="application_opportunities"),
    path("applications/<uuid:id>/opportunities/generate/", GenerateOpportunitiesView.as_view(), name="application_opportunities_generate"),
    path("applications/<uuid:id>/opportunities/rank/", RankOpportunitiesView.as_view(), name="application_opportunities_rank"),

    # ── Allocations (Allocated House module) ───────────────────────────
    path("allocations/",               AllocationListView.as_view(),                 name="allocation_list"),
    path("allocations/<uuid:id>/",     AllocationDetailView.as_view(),               name="allocation_detail"),
    path("allocate/",                  AllocateView.as_view(),                       name="allocate"),
    path("allocations/<uuid:id>/terminate/", TerminateAllocationView.as_view(),      name="allocation_terminate"),

    # ── Handover receipts ──────────────────────────────────────────────
    path("handover-receipts/",                HandoverReceiptListCreateView.as_view(), name="handover_receipt_list_create"),
    path("handover-receipts/<uuid:id>/",      HandoverReceiptDetailView.as_view(),     name="handover_receipt_detail"),
    path("handover-receipts/<uuid:id>/print/", HandoverReceiptPrintView.as_view(),     name="handover_receipt_print"),

    # ── Audit timeline ─────────────────────────────────────────────────
    path("applications/<uuid:id>/audit/", ApplicationAuditView.as_view(),            name="application_audit"),

    # ── Scoring configuration ──────────────────────────────────────────
    path("scoring-config/",            ScoringConfigListCreateView.as_view(),        name="scoring_config_list"),
    path("scoring-config/<uuid:pk>/",  ScoringConfigDetailView.as_view(),            name="scoring_config_detail"),

    # ── Eligibility rules ─────────────────────────────────────────────
    path("eligibility-rules/",         EligibilityRuleListCreateView.as_view(),      name="eligibility_rule_list"),
    path("eligibility-rules/<uuid:pk>/", EligibilityRuleDetailView.as_view(),         name="eligibility_rule_detail"),

    # ── Allocation logs ────────────────────────────────────────────────
    path("allocation-logs/",           AllocationLogListView.as_view(),              name="allocation_log_list"),

    # ── Analytics / Command center ─────────────────────────────────────
    path("analytics/",                 HousingAnalyticsView.as_view(),               name="housing_analytics"),
    path("analytics/available/",       AvailableHousesView.as_view(),                name="housing_available"),
    path("analytics/conflicts/",       ConflictDetectionView.as_view(),              name="housing_conflicts"),
    path("analytics/conflicts/resolve/", ResolveConflictView.as_view(),             name="housing_conflicts_resolve"),
    path("analytics/recommendations/", RecommendationsView.as_view(),                name="housing_recommendations"),
    path("occupancy/",                 OccupancyView.as_view(),                      name="housing_occupancy"),

    # ── House operations: inspections ──────────────────────────────────
    path("inspections/",               InspectionListCreateView.as_view(),           name="inspection_list_create"),
    path("inspections/<uuid:id>/",     InspectionDetailView.as_view(),               name="inspection_detail"),
    path("inspections/<uuid:id>/complete/", InspectionCompleteView.as_view(),        name="inspection_complete"),

    # ── House operations: post-inspections (pre-termination) ───────────
    path("post-inspections/",          PostInspectionListCreateView.as_view(),       name="post_inspection_list_create"),
    path("post-inspections/<uuid:id>/", PostInspectionDetailView.as_view(),          name="post_inspection_detail"),
    path("post-inspections/<uuid:id>/complete/", PostInspectionCompleteView.as_view(), name="post_inspection_complete"),
    path("pre-inspection/validate/",   PreInspectionValidationView.as_view(),        name="pre_inspection_validate"),

    # ── House operations: maintenance ──────────────────────────────────
    path("maintenance-requests/",      MaintenanceListCreateView.as_view(),          name="maintenance_list_create"),
    path("maintenance-requests/<uuid:id>/", MaintenanceDetailView.as_view(),         name="maintenance_detail"),
    path("maintenance-requests/<uuid:id>/status/", MaintenanceStatusView.as_view(),  name="maintenance_status"),
    # ── Maintenance Request Form (Applicant) ──────────────────────────
    path("maintenance-requests/submit/", ApplicantMaintenanceSubmitView.as_view(),   name="maintenance_submit"),
    path("maintenance-requests/my/",     ApplicantMaintenanceListView.as_view(),     name="maintenance_my"),
    # ── Civil Work Department Panel ───────────────────────────────────
    path("civil-work/panel/",            CivilWorkPanelView.as_view(),              name="civil_work_panel"),
    path("civil-work/stats/",            CivilWorkStatsView.as_view(),              name="civil_work_stats"),
    path("civil-work/<uuid:id>/receive/", CivilWorkReceiveView.as_view(),           name="civil_work_receive"),
    path("civil-work/<uuid:id>/assign/", CivilWorkAssignView.as_view(),             name="civil_work_assign"),
    path("civil-work/<uuid:id>/update/", CivilWorkUpdateView.as_view(),             name="civil_work_update"),

    # ── House operations: transfers ────────────────────────────────────
    path("transfers/",                 TransferListCreateView.as_view(),             name="transfer_list_create"),
    path("transfers/<uuid:id>/",       TransferDetailView.as_view(),                 name="transfer_detail"),
    path("transfers/<uuid:id>/decide/", TransferDecideView.as_view(),                name="transfer_decide"),
    path("transfers/<uuid:id>/complete/", TransferCompleteView.as_view(),            name="transfer_complete"),

    # ── House operations: rentals ──────────────────────────────────────
    path("contracts/",                 ContractListCreateView.as_view(),             name="contract_list_create"),
    path("contracts/<uuid:id>/",       ContractDetailView.as_view(),                 name="contract_detail"),
    path("contracts/<uuid:id>/terminate/", ContractTerminateView.as_view(),          name="contract_terminate"),
    path("invoices/",                  InvoiceListCreateView.as_view(),              name="invoice_list_create"),
    path("invoices/rent-roll/",        RentRollMatrixView.as_view(),                 name="rent_roll_matrix"),
    path("invoices/<uuid:id>/",        InvoiceDetailView.as_view(),                  name="invoice_detail"),
    path("invoices/<uuid:id>/payments/", InvoicePaymentsView.as_view(),              name="invoice_payments"),
    path("payments/",                  PaymentListCreateView.as_view(),              name="payment_list_create"),
    path("rentals/summary/",           RentalSummaryView.as_view(),                  name="rental_summary"),

    # ── Termination management ─────────────────────────────────────────
    path("termination-cases/",                TerminationCaseListCreateView.as_view(),          name="termination_case_list_create"),
    path("termination-cases/<uuid:id>/",      TerminationCaseDetailView.as_view(),              name="termination_case_detail"),
    path("terminations/",                     TerminationTransactionListCreateView.as_view(),   name="termination_list_create"),
    path("terminations/<uuid:id>/",           TerminationTransactionDetailView.as_view(),       name="termination_detail"),
    path("terminations/<uuid:id>/approve/",   TerminationApproveView.as_view(),                 name="termination_approve"),
    path("terminations/<uuid:id>/verify-code/", TerminationVerifyCodeView.as_view(),            name="termination_verify_code"),
    path("terminations/<uuid:id>/resolve-issues/", TerminationResolveIssuesView.as_view(),      name="termination_resolve_issues"),
    path("terminations/<uuid:id>/process/",   TerminationProcessView.as_view(),                 name="termination_process"),
    path("terminations/<uuid:id>/terminate-with-code/", TerminateWithCodeView.as_view(),          name="terminate_with_code"),
    path("terminations/stats/",               TerminationStatsView.as_view(),                   name="termination_stats"),
    path("allocated-employees/",              AllocatedEmployeesListView.as_view(),             name="allocated_employees_list"),
]
