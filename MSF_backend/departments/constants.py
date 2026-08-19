"""
Metahara Sugar Factory — Official Permanent Department Master Data.

This is the SINGLE source of truth for all departments across the system.
The hierarchy is expressed by (parent_code, code) tuples.

Department codes are stable identifiers; names are the official department names.
Legacy name mapping handles migration from old names to official names.

Hierarchy levels:
  L0 = top-level department  (e.g. "12 CIVIL WORK")
  L1 = sub-department        (e.g. "15.1 ABADIR A")
  L2 = sub-sub-department    (e.g. "23.2.1 ORGANIZATION AND METHODS")
"""
from __future__ import annotations

# ── Official department master ──────────────────────────────────────────────
# Each entry: (code, name, parent_code_or_None, sort_order)
# sort_order preserves the official display order within a parent.

OFFICIAL_DEPARTMENTS: list[tuple[str, str, str | None, int]] = [
    # ── 12 CIVIL WORK ──────────────────────────────────────────────────────
    ("12",    "CIVIL WORK",                                    None,   100),

    # ── 13 L.P.C.D ─────────────────────────────────────────────────────────
    ("13",    "L.P.C.D",                                       None,   200),

    # ── 14 CULTIVATION ─────────────────────────────────────────────────────
    ("14",    "CULTIVATION",                                   None,   300),
    ("14.1",  "TILLAGE",                                       "14",   310),
    ("14.2",  "CULTIVATION",                                   "14",   320),

    # ── 15 PLANTATION ──────────────────────────────────────────────────────
    ("15",    "PLANTATION",                                    None,   400),
    ("15.1",  "ABADIR A",                                      "15",   401),
    ("15.2",  "ABADIR B",                                      "15",   402),
    ("15.3",  "ABADIR C",                                      "15",   403),
    ("15.4",  "ABADIR EXTENSION",                              "15",   404),
    ("15.5",  "ABADIR FRUIT",                                  "15",   405),
    ("15.6",  "MERTI 1ST EAST",                                "15",   406),
    ("15.7",  "MERTI 1ST AWASH",                               "15",   407),
    ("15.8",  "MERTI 2ND CHORE",                               "15",   408),
    ("15.9",  "MERTI 2ND G/GOLLA",                             "15",   409),
    ("15.10", "MERTI 2ND KENIFA",                              "15",   410),
    ("15.11", "MERTI 3RD KIKAN",                               "15",   411),
    ("15.12", "MERTI 3RD SOUTH",                               "15",   412),
    ("15.13", "MERTI 3RD R.LAND",                              "15",   413),
    ("15.14", "NORTH",                                         "15",   414),
    ("15.15", "RATU CULTURE",                                  "15",   415),

    # ── 16 AGRICULTURE RESEARCH ────────────────────────────────────────────
    ("16",    "AGRICULTURE RESEARCH",                          None,   500),

    # ── 17 HARVESTING ──────────────────────────────────────────────────────
    ("17",    "HARVESTING",                                    None,   600),
    ("17.1",  "SEED CANE & IRRIGATION",                        "17",   601),
    ("17.2",  "CANE CUTTING",                                  "17",   602),
    ("17.3",  "HAULAGE",                                       "17",   603),

    # ── 18 F.E.S ───────────────────────────────────────────────────────────
    ("18",    "F.E.S",                                         None,   700),
    ("18.1",  "ESTATE CAR & MOTORCYCLE",                       "18",   701),
    ("18.2",  "HEAVY EQUIPMENT",                               "18",   702),
    ("18.3",  "WHEEL TRACTOR",                                 "18",   703),

    # ── 19 COMMERCIAL DEPARTMENT ───────────────────────────────────────────
    ("19",    "COMMERCIAL DEPARTMENT",                         None,   800),

    # ── 21 TECHNICAL ───────────────────────────────────────────────────────
    ("21",    "TECHNICAL",                                     None,   900),
    ("21.1",  "PREVENTIVE MAINTENANCE, EXTRACTION AND POWER PLANT", "21", 910),
    ("21.2",  "INSTRUMENT WORKSHOP",                           "21",   920),
    ("21.3",  "ELECTRICAL WORKSHOP",                           "21",   930),
    ("21.4",  "MECHANICAL WORKSHOP",                           "21",   940),
    ("21.5",  "FABRICATION WORKSHOP",                          "21",   950),

    # ── 22 PRODUCTION ──────────────────────────────────────────────────────
    ("22",    "PRODUCTION",                                    None,  1000),

    # ── 23 MANAGER OFFICE ──────────────────────────────────────────────────
    ("23",    "MANAGER OFFICE",                                None,  1100),
    ("23.1",  "LEGAL SERVICE",                                 "23",  1110),
    ("23.2",  "MANAGEMENT SERVICE",                            "23",  1120),
    ("23.2.1","ORGANIZATION AND METHODS",                      "23.2",1121),
    ("23.2.2","PLANNING, BUSINESS DEVELOPMENT AND BUDGET PREPARATION", "23.2", 1122),
    ("23.2.3","MANAGEMENT INFORMATION SYSTEM",                 "23.2",1123),
    ("23.3",  "ESTATE SERVICE",                                "23",  1130),
    ("23.3.1","GENERAL SERVICE",                               "23.3",1131),
    ("23.3.2","PUBLIC RELATION",                               "23.3",1132),
    ("23.4",  "BOARD OF DIRECTORS",                            "23",  1140),

    # ── 24 FINANCE DEPARTMENT ──────────────────────────────────────────────
    ("24",    "FINANCE DEPARTMENT",                            None,  1200),
    ("24.1",  "GENERAL ACCOUNTING",                            "24",  1210),
    ("24.2",  "COST ACCOUNTING",                               "24",  1220),
    ("24.3",  "BUDGET CONTROL AND FINANCIAL ANALYSIS",         "24",  1230),

    # ── 25 LOGISTICS ───────────────────────────────────────────────────────
    ("25",    "LOGISTICS",                                     None,  1300),
    ("25.1",  "MATERIAL REQUIREMENT PLANNING",                 "25",  1310),
    ("25.2",  "STORE ADMINISTRATION",                          "25",  1320),

    # ── 26 HUMAN RESOURCE DEPARTMENT ───────────────────────────────────────
    ("26",    "HUMAN RESOURCE DEPARTMENT",                     None,  1400),
    ("26.2",  "MANPOWER PLANNING AND TRAINING",                "26",  1420),
    ("26.3",  "EMPLOYMENT AND ADMINISTRATION",                 "26",  1430),
    ("26.4",  "EMPLOYEE RELATION",                             "26",  1440),

    # ── 27 GUEST HOUSE ─────────────────────────────────────────────────────
    ("27",    "GUEST HOUSE",                                   None,  1500),

    # ── 28 BUILDING ────────────────────────────────────────────────────────
    ("28",    "BUILDING",                                      None,  1600),

    # ── 29 PARK AND LANSE ──────────────────────────────────────────────────
    ("29",    "PARK AND LANSE",                                None,  1700),

    # ── 30 MEDICAL SERVICE ─────────────────────────────────────────────────
    ("30",    "MEDICAL SERVICE",                               None,  1800),
    ("30.1",  "MEDICAL SECTION",                               "30",  1810),
    ("30.2",  "PUBLIC HEALTH",                                 "30",  1820),

    # ── 31 W.P.E ───────────────────────────────────────────────────────────
    ("31",    "W.P.E — WORKERS PARTY OF ETHIOPIA",             None,  1900),

    # ── 32 LABOUR UNION ────────────────────────────────────────────────────
    ("32",    "LABOUR UNION",                                  None,  2000),

    # ── 33 WORKERS CONTROL COMMITTEE ───────────────────────────────────────
    ("33",    "WORKERS CONTROL COMMITTEE",                     None,  2100),
    ("33.1",  "ANTI-CORRUPTION OFFICE",                        "33",  2110),

    # ── 34 SECURITY ────────────────────────────────────────────────────────
    ("34",    "SECURITY",                                      None,  2200),

    # ── 35 T.D.C ───────────────────────────────────────────────────────────
    ("35",    "T.D.C",                                         None,  2300),

    # ── 36 REWA ────────────────────────────────────────────────────────────
    ("36",    "REWA",                                          None,  2400),

    # ── 37 REYA ────────────────────────────────────────────────────────────
    ("37",    "REYA",                                          None,  2500),

    # ── 38 POLICE ──────────────────────────────────────────────────────────
    ("38",    "POLICE",                                        None,  2600),

    # ── 39 FRUIT ───────────────────────────────────────────────────────────
    ("39",    "FRUIT",                                         None,  2700),

    # ── 40 CUSTOMS ─────────────────────────────────────────────────────────
    ("40",    "CUSTOMS",                                       None,  2800),

    # ── 50 WORKER CLUB ─────────────────────────────────────────────────────
    ("50",    "WORKER CLUB",                                   None,  2900),

    # ── 51 FAMILY CLUB ─────────────────────────────────────────────────────
    ("51",    "FAMILY CLUB",                                   None,  3000),

    # ── 52 COMMUNITY CENTER ────────────────────────────────────────────────
    ("52",    "COMMUNITY CENTER",                              None,  3100),

    # ── 53 CO-OPERATIVE SHOP ───────────────────────────────────────────────
    ("53",    "CO-OPERATIVE SHOP",                             None,  3200),

    # ── 54 WONJI-SHOA TRAINING CENTER ─────────────────────────────────────
    ("54",    "WONJI-SHOA TRAINING CENTER",                    None,  3300),

    # ── 55 AUDIT SERVICE ───────────────────────────────────────────────────
    ("55",    "AUDIT SERVICE",                                 None,  3400),

    # ── 56 PROJECT AND PRODUCTIVITY IMPROVEMENT OFFICE ─────────────────────
    ("56",    "PROJECT AND PRODUCTIVITY IMPROVEMENT OFFICE",   None,  3500),

    # ── Departments without confirmed official codes (preserved for migration review) ──
    # These exist in the database but have no assigned code; they will NOT
    # be given invented codes. They are flagged for controlled migration.
    ("UNASSIGNED_ETHICS", "ETHICS AND ANTI-CORRUPTION",        None,  9000),
    ("UNASSIGNED_PURCHASING", "PURCHASING TEAM",               None,  9001),
    ("UNASSIGNED_AWASH_FOOD", "AWASH FOOD",                    None,  9002),
]


# ── Helper lookups ──────────────────────────────────────────────────────────

# code -> (name, parent_code, sort_order)
DEPT_BY_CODE: dict[str, tuple[str, str | None, int]] = {
    code: (name, parent, order) for code, name, parent, order in OFFICIAL_DEPARTMENTS
}

# name -> code  (case-insensitive lookup via lower())
DEPT_NAME_TO_CODE: dict[str, str] = {
    name.lower(): code for code, name, _parent, _order in OFFICIAL_DEPARTMENTS
}

# Canonical list for backwards-compatible off-line fallback
# Each entry: (name, code) — used by frontend and seed scripts
CONSTANT_DEPARTMENTS: list[tuple[str, str]] = [
    (name, code) for code, name, _parent, _order in OFFICIAL_DEPARTMENTS
    if not code.startswith("UNASSIGNED_")
]

CONSTANT_DEPARTMENT_ORDER: dict[str, int] = {
    name: order for _code, name, _parent, order in OFFICIAL_DEPARTMENTS
}

# ── Legacy name mapping ────────────────────────────────────────────────────
# Maps old/variant department names -> official department name.
# Used during migration to normalise existing data.

LEGACY_DEPARTMENT_NAME_MAP: dict[str, str] = {
    # Old constants.py names -> official names
    "Accounts":                                     "FINANCE DEPARTMENT",
    "Procurement & Warehouse":                      "LOGISTICS",
    "Quality Control & Lab":                        "AGRICULTURE RESEARCH",
    "Distillery / Ethanol":                         "PRODUCTION",
    "Infrastructure & Irrigation":                  "CIVIL WORK",
    "Transport & Logistics":                        "LOGISTICS",
    "Information Technology":                       "MANAGEMENT INFORMATION SYSTEM",
    "Safety & Health":                              "MEDICAL SERVICE",
    "Sales & Marketing":                            "COMMERCIAL DEPARTMENT",
    "Livestock & Plantation Development":           "L.P.C.D",
    "Agricultural Research Station":                "AGRICULTURE RESEARCH",
    "Diversity, Equity & Inclusion":                "HUMAN RESOURCE DEPARTMENT",
    "Club Caffe":                                   "WORKER CLUB",
    "Community Relations & CSR":                    "COMMUNITY CENTER",
    "Executive Management Office":                  "MANAGER OFFICE",
    "Factory Process Management":                   "PRODUCTION",
    "Legal & Compliance":                           "LEGAL SERVICE",
    "Internal Audit":                               "AUDIT SERVICE",
    "Corporate Communications & PR":               "PUBLIC RELATION",

    # seed_metehara_factory.py names -> official names
    "General Management":                           "MANAGER OFFICE",
    "Sugar Production":                             "PRODUCTION",
    "Agriculture & Plantation":                     "PLANTATION",
    "Engineering & Maintenance":                    "TECHNICAL",
    "Human Resources":                              "HUMAN RESOURCE DEPARTMENT",
    "Finance & Accounts":                           "FINANCE DEPARTMENT",
    "Procurement & Logistics":                      "LOGISTICS",
    "Information Technology":                       "MANAGEMENT INFORMATION SYSTEM",
    "Quality Control & Laboratory":                 "AGRICULTURE RESEARCH",
    "Medical Services":                             "MEDICAL SERVICE",

    # seed_data.py names
    "Administration":                               "MANAGER OFFICE",
    "Finance":                                      "FINANCE DEPARTMENT",
    "IT":                                           "MANAGEMENT INFORMATION SYSTEM",
    "IT Department":                                "MANAGEMENT INFORMATION SYSTEM",
    "Logistics":                                    "LOGISTICS",
    "Production":                                   "PRODUCTION",
    "Operations":                                   "PRODUCTION",
    "Planner":                                      "PRODUCTION",
    "HR":                                           "HUMAN RESOURCE DEPARTMENT",

    # Amharic names from migration 0003 (if still in DB)
    "የውስጥ ኦዲት አገልግሎት":                          "AUDIT SERVICE",
    "የሕግ አገልግሎት":                                "LEGAL SERVICE",
    "የምርምርና ልማት ክፍል":                          "AGRICULTURE RESEARCH",
    "የሰው ኃይል አስተዳደር":                          "HUMAN RESOURCE DEPARTMENT",
    "የፋይናንስ ክፍል":                               "FINANCE DEPARTMENT",
    "የእቅድና በጀት ክፍል":                           "BUDGET CONTROL AND FINANCIAL ANALYSIS",
    "የኢንፎርሜሽንና ኮሙኒኬሽን ቴክኖሎጂ (ICT) ክፍል": "MANAGEMENT INFORMATION SYSTEM",
    "የግዥ ክፍል":                                   "COMMERCIAL DEPARTMENT",
    "የአቅርቦትና ሎጂስቲክስ ክፍል":                   "LOGISTICS",
    "የግብርና ኦፕሬሽን":                             "CULTIVATION",
    "የግብርና ምርት":                               "PLANTATION",
    "የሸንኮራ አገዳ ልማትና እርሻ":                    "PLANTATION",
    "የእርሻ ማሽነሪ ኦፕሬሽን":                        "F.E.S",
    "የፋብሪካ ኦፕሬሽን":                             "PRODUCTION",
    "የስኳር ምርት":                                 "PRODUCTION",
    "የሜካኒካል ጥገና":                              "MECHANICAL WORKSHOP",
    "የኤሌክትሪክ ጥገና":                             "ELECTRICAL WORKSHOP",
    "የኢንስትሩመንትን ክፍል":                        "INSTRUMENT WORKSHOP",
    "የዎርክሾፕ ክፍል":                              "FABRICATION WORKSHOP",
    "የኃይል ማመንጫ":                               "TECHNICAL",
    "የኢታኖልና ኮምፓስት ምርት":                     "PRODUCTION",
    "የአስተዳደር ክፍል":                             "MANAGER OFFICE",
    "የፋሲሊቲ አስተዳደር":                           "BUILDING",
    "የንብረት አስተዳደር":                           "LOGISTICS",
    "የኢንቬንተሪ አስተዳደር":                        "STORE ADMINISTRATION",
    "የትራንስፖርት ክፍል":                           "LOGISTICS",
    "የተሽከርካሪ ጥገና ክፍል":                       "F.E.S",
    "LPCD":                                         "L.P.C.D",
    "ሆስፒታል":                                     "MEDICAL SERVICE",
    "የግብርና ምርምር ክፍል":                         "AGRICULTURE RESEARCH",
}
