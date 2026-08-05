"""
Constant department list for Metahara Sugar Factory.

This is the single source of truth for the organization's departments.
Ordering reflects the canonical display order across the system.
"""
from __future__ import annotations

# List of (name, code) tuples in canonical display order.
CONSTANT_DEPARTMENTS: list[tuple[str, str]] = [
    ("Accounts", "FIN"),
    ("Procurement & Warehouse", "STORE"),
    ("Quality Control & Lab", "LAB"),
    ("Distillery / Ethanol", "DIST"),
    ("Infrastructure & Irrigation", "CIVIL"),
    ("Transport & Logistics", "LOG"),
    ("Information Technology", "IT"),
    ("Safety & Health", "SHE"),
    ("Security", "SEC"),
    ("Sales & Marketing", "SALES"),
    ("Livestock & Plantation Development", "LPCD"),
    ("Agricultural Research Station", "AGRI-RES"),
    ("Diversity, Equity & Inclusion", "DIVERSITY"),
    ("Club Caffe", "CLUB-CAFFE"),
    ("Community Relations & CSR", "COMMUNITY"),
    ("Executive Management Office", "GM-OFFICE"),
    ("Factory Process Management", "PROC-MGR"),
    ("Legal & Compliance", "LEGAL"),
    ("Internal Audit", "AUDIT"),
    ("Corporate Communications & PR", "PR"),
]

# Canonical display order (alphabetical by name is applied at DB level; this
# list preserves the official order used by the frontend fallback).
CONSTANT_DEPARTMENT_ORDER: dict[str, int] = {
    name: i for i, (name, _code) in enumerate(CONSTANT_DEPARTMENTS)
}

# Maps legacy/duplicate department names -> canonical name.
LEGACY_DEPARTMENT_NAME_MAP: dict[str, str] = {
    "Finance": "Accounts",
    "It": "Information Technology",
    "IT Department": "Information Technology",
    "Logistics": "Transport & Logistics",
    "Operations": "Factory Process Management",
    "Planner": "Factory Process Management",
    "HR": "Executive Management Office",
}
