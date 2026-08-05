from django.urls import path
from .views import (
    HouseListCreateView, HouseDetailView,
    HouseApplicationListCreateView, HouseApplicationDetailView,
    HouseApplicationSubmitView, HouseApplicationStatusUpdateView,
    HouseApplicationDashboardView,
    HouseQueueView,
    AutoAllocateView, BatchAllocateView, ManualAllocateView, DeallocateView,
    ScoringConfigListCreateView, ScoringConfigDetailView,
    EligibilityRuleListCreateView, EligibilityRuleDetailView,
    AllocationLogListView,
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

    # ── Queue & Allocation engine ──────────────────────────────────────
    path("queue/",                     HouseQueueView.as_view(),                     name="house_queue"),
    path("auto-allocate/",             AutoAllocateView.as_view(),                   name="auto_allocate"),
    path("batch-allocate/",            BatchAllocateView.as_view(),                  name="batch_allocate"),
    path("manual-allocate/",           ManualAllocateView.as_view(),                 name="manual_allocate"),
    path("deallocate/",                DeallocateView.as_view(),                     name="deallocate"),

    # ── Scoring configuration ──────────────────────────────────────────
    path("scoring-config/",            ScoringConfigListCreateView.as_view(),        name="scoring_config_list"),
    path("scoring-config/<uuid:pk>/",  ScoringConfigDetailView.as_view(),            name="scoring_config_detail"),

    # ── Eligibility rules ─────────────────────────────────────────────
    path("eligibility-rules/",         EligibilityRuleListCreateView.as_view(),      name="eligibility_rule_list"),
    path("eligibility-rules/<uuid:pk>/", EligibilityRuleDetailView.as_view(),         name="eligibility_rule_detail"),

    # ── Allocation logs ────────────────────────────────────────────────
    path("allocation-logs/",           AllocationLogListView.as_view(),              name="allocation_log_list"),
]
