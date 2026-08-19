"""
Data migration: populate the official Metahara Sugar Factory department hierarchy.

This migration replaces all existing departments with the official hierarchy
and normalises all CharField-based department references across the system.
"""
from django.db import migrations


OFFICIAL_DEPARTMENTS = [
    # (code, name, parent_code, level, sort_order)
    ("12",    "CIVIL WORK",                                    None,   0,  100),
    ("13",    "L.P.C.D",                                       None,   0,  200),
    ("14",    "CULTIVATION",                                   None,   0,  300),
    ("14.1",  "TILLAGE",                                       "14",   1,  310),
    ("14.2",  "CULTIVATION",                                   "14",   1,  320),
    ("15",    "PLANTATION",                                    None,   0,  400),
    ("15.1",  "ABADIR A",                                      "15",   1,  401),
    ("15.2",  "ABADIR B",                                      "15",   1,  402),
    ("15.3",  "ABADIR C",                                      "15",   1,  403),
    ("15.4",  "ABADIR EXTENSION",                              "15",   1,  404),
    ("15.5",  "ABADIR FRUIT",                                  "15",   1,  405),
    ("15.6",  "MERTI 1ST EAST",                                "15",   1,  406),
    ("15.7",  "MERTI 1ST AWASH",                               "15",   1,  407),
    ("15.8",  "MERTI 2ND CHORE",                               "15",   1,  408),
    ("15.9",  "MERTI 2ND G/GOLLA",                             "15",   1,  409),
    ("15.10", "MERTI 2ND KENIFA",                              "15",   1,  410),
    ("15.11", "MERTI 3RD KIKAN",                               "15",   1,  411),
    ("15.12", "MERTI 3RD SOUTH",                               "15",   1,  412),
    ("15.13", "MERTI 3RD R.LAND",                              "15",   1,  413),
    ("15.14", "NORTH",                                         "15",   1,  414),
    ("15.15", "RATU CULTURE",                                  "15",   1,  415),
    ("16",    "AGRICULTURE RESEARCH",                          None,   0,  500),
    ("17",    "HARVESTING",                                    None,   0,  600),
    ("17.1",  "SEED CANE & IRRIGATION",                        "17",   1,  601),
    ("17.2",  "CANE CUTTING",                                  "17",   1,  602),
    ("17.3",  "HAULAGE",                                       "17",   1,  603),
    ("18",    "F.E.S",                                         None,   0,  700),
    ("18.1",  "ESTATE CAR & MOTORCYCLE",                       "18",   1,  701),
    ("18.2",  "HEAVY EQUIPMENT",                               "18",   1,  702),
    ("18.3",  "WHEEL TRACTOR",                                 "18",   1,  703),
    ("19",    "COMMERCIAL DEPARTMENT",                         None,   0,  800),
    ("21",    "TECHNICAL",                                     None,   0,  900),
    ("21.1",  "PREVENTIVE MAINTENANCE, EXTRACTION AND POWER PLANT", "21", 1, 910),
    ("21.2",  "INSTRUMENT WORKSHOP",                           "21",   1,  920),
    ("21.3",  "ELECTRICAL WORKSHOP",                           "21",   1,  930),
    ("21.4",  "MECHANICAL WORKSHOP",                           "21",   1,  940),
    ("21.5",  "FABRICATION WORKSHOP",                          "21",   1,  950),
    ("22",    "PRODUCTION",                                    None,   0, 1000),
    ("23",    "MANAGER OFFICE",                                None,   0, 1100),
    ("23.1",  "LEGAL SERVICE",                                 "23",   1, 1110),
    ("23.2",  "MANAGEMENT SERVICE",                            "23",   1, 1120),
    ("23.2.1","ORGANIZATION AND METHODS",                      "23.2", 2, 1121),
    ("23.2.2","PLANNING, BUSINESS DEVELOPMENT AND BUDGET PREPARATION", "23.2", 2, 1122),
    ("23.2.3","MANAGEMENT INFORMATION SYSTEM",                 "23.2", 2, 1123),
    ("23.3",  "ESTATE SERVICE",                                "23",   1, 1130),
    ("23.3.1","GENERAL SERVICE",                               "23.3", 2, 1131),
    ("23.3.2","PUBLIC RELATION",                               "23.3", 2, 1132),
    ("23.4",  "BOARD OF DIRECTORS",                            "23",   1, 1140),
    ("24",    "FINANCE DEPARTMENT",                            None,   0, 1200),
    ("24.1",  "GENERAL ACCOUNTING",                            "24",   1, 1210),
    ("24.2",  "COST ACCOUNTING",                               "24",   1, 1220),
    ("24.3",  "BUDGET CONTROL AND FINANCIAL ANALYSIS",         "24",   1, 1230),
    ("25",    "LOGISTICS",                                     None,   0, 1300),
    ("25.1",  "MATERIAL REQUIREMENT PLANNING",                 "25",   1, 1310),
    ("25.2",  "STORE ADMINISTRATION",                          "25",   1, 1320),
    ("26",    "HUMAN RESOURCE DEPARTMENT",                     None,   0, 1400),
    ("26.2",  "MANPOWER PLANNING AND TRAINING",                "26",   1, 1420),
    ("26.3",  "EMPLOYMENT AND ADMINISTRATION",                 "26",   1, 1430),
    ("26.4",  "EMPLOYEE RELATION",                             "26",   1, 1440),
    ("27",    "GUEST HOUSE",                                   None,   0, 1500),
    ("28",    "BUILDING",                                      None,   0, 1600),
    ("29",    "PARK AND LANSE",                                None,   0, 1700),
    ("30",    "MEDICAL SERVICE",                               None,   0, 1800),
    ("30.1",  "MEDICAL SECTION",                               "30",   1, 1810),
    ("30.2",  "PUBLIC HEALTH",                                 "30",   1, 1820),
    ("31",    "W.P.E — WORKERS PARTY OF ETHIOPIA",             None,   0, 1900),
    ("32",    "LABOUR UNION",                                  None,   0, 2000),
    ("33",    "WORKERS CONTROL COMMITTEE",                     None,   0, 2100),
    ("33.1",  "ANTI-CORRUPTION OFFICE",                        "33",   1, 2110),
    ("34",    "SECURITY",                                      None,   0, 2200),
    ("35",    "T.D.C",                                         None,   0, 2300),
    ("36",    "REWA",                                          None,   0, 2400),
    ("37",    "REYA",                                          None,   0, 2500),
    ("38",    "POLICE",                                        None,   0, 2600),
    ("39",    "FRUIT",                                         None,   0, 2700),
    ("40",    "CUSTOMS",                                       None,   0, 2800),
    ("50",    "WORKER CLUB",                                   None,   0, 2900),
    ("51",    "FAMILY CLUB",                                   None,   0, 3000),
    ("52",    "COMMUNITY CENTER",                              None,   0, 3100),
    ("53",    "CO-OPERATIVE SHOP",                             None,   0, 3200),
    ("54",    "WONJI-SHOA TRAINING CENTER",                    None,   0, 3300),
    ("55",    "AUDIT SERVICE",                                 None,   0, 3400),
    ("56",    "PROJECT AND PRODUCTIVITY IMPROVEMENT OFFICE",   None,   0, 3500),
    ("UNASSIGNED_ETHICS",     "ETHICS AND ANTI-CORRUPTION",    None,   0, 9000),
    ("UNASSIGNED_PURCHASING", "PURCHASING TEAM",               None,   0, 9001),
    ("UNASSIGNED_AWASH_FOOD", "AWASH FOOD",                    None,   0, 9002),
]

# Mapping: old department name (any source) -> official name
# Covers constants.py, seed_metehara_factory.py, seed_data.py, Amharic names
LEGACY_NAME_MAP = {
    # Old constants.py names
    "Accounts":                              "FINANCE DEPARTMENT",
    "Procurement & Warehouse":               "LOGISTICS",
    "Quality Control & Lab":                 "AGRICULTURE RESEARCH",
    "Distillery / Ethanol":                  "PRODUCTION",
    "Infrastructure & Irrigation":           "CIVIL WORK",
    "Transport & Logistics":                 "LOGISTICS",
    "Information Technology":                "MANAGEMENT INFORMATION SYSTEM",
    "Safety & Health":                       "MEDICAL SERVICE",
    "Sales & Marketing":                     "COMMERCIAL DEPARTMENT",
    "Livestock & Plantation Development":    "L.P.C.D",
    "Agricultural Research Station":         "AGRICULTURE RESEARCH",
    "Diversity, Equity & Inclusion":         "HUMAN RESOURCE DEPARTMENT",
    "Club Caffe":                            "WORKER CLUB",
    "Community Relations & CSR":             "COMMUNITY CENTER",
    "Executive Management Office":           "MANAGER OFFICE",
    "Factory Process Management":            "PRODUCTION",
    "Legal & Compliance":                    "LEGAL SERVICE",
    "Internal Audit":                        "AUDIT SERVICE",
    "Corporate Communications & PR":        "PUBLIC RELATION",
    # seed_metehara_factory.py names
    "General Management":                    "MANAGER OFFICE",
    "Sugar Production":                      "PRODUCTION",
    "Agriculture & Plantation":              "PLANTATION",
    "Engineering & Maintenance":             "TECHNICAL",
    "Human Resources":                       "HUMAN RESOURCE DEPARTMENT",
    "Finance & Accounts":                    "FINANCE DEPARTMENT",
    "Procurement & Logistics":               "LOGISTICS",
    "Quality Control & Laboratory":          "AGRICULTURE RESEARCH",
    "Medical Services":                      "MEDICAL SERVICE",
    # seed_data.py names
    "Administration":                        "MANAGER OFFICE",
    "Finance":                               "FINANCE DEPARTMENT",
    "IT":                                    "MANAGEMENT INFORMATION SYSTEM",
    "IT Department":                         "MANAGEMENT INFORMATION SYSTEM",
    "Logistics":                             "LOGISTICS",
    "Production":                            "PRODUCTION",
    "Operations":                            "PRODUCTION",
    "Planner":                               "PRODUCTION",
    "HR":                                    "HUMAN RESOURCE DEPARTMENT",
    # Amharic names from migration 0003
    "የውስጥ ኦዲት አገልግሎት":               "AUDIT SERVICE",
    "የሕግ አገልግሎት":                     "LEGAL SERVICE",
    "የምርምርና ልማት ክፍል":               "AGRICULTURE RESEARCH",
    "የሰው ኃይል አስተዳደር":               "HUMAN RESOURCE DEPARTMENT",
    "የፋይናንስ ክፍል":                    "FINANCE DEPARTMENT",
    "የእቅድና በጀት ክፍል":                "BUDGET CONTROL AND FINANCIAL ANALYSIS",
    "የግዥ ክፍል":                        "COMMERCIAL DEPARTMENT",
    "የአቅርቦትና ሎጂስቲክስ ክፍል":        "LOGISTICS",
    "የግብርና ኦፕሬሽን":                  "CULTIVATION",
    "የግብርና ምርት":                    "PLANTATION",
    "የሸንኮራ አገዳ ልማትና እርሻ":         "PLANTATION",
    "የእርሻ ማሽነሪ ኦፕሬሽን":             "F.E.S",
    "የፋብሪካ ኦፕሬሽን":                  "PRODUCTION",
    "የስኳር ምርት":                      "PRODUCTION",
    "የሜካኒካል ጥገና":                   "MECHANICAL WORKSHOP",
    "የኤሌክትሪክ ጥገና":                  "ELECTRICAL WORKSHOP",
    "የኢንስትሩመንትን ክፍል":             "INSTRUMENT WORKSHOP",
    "የዎርክሾፕ ክፍል":                   "FABRICATION WORKSHOP",
    "የኃይል ማመንጫ":                    "TECHNICAL",
    "የኢታኖልና ኮምፓስት ምርት":          "PRODUCTION",
    "የአስተዳደር ክፍል":                  "MANAGER OFFICE",
    "የፋሲሊቲ አስተዳደር":                "BUILDING",
    "የንብረት አስተዳደር":                "LOGISTICS",
    "የኢንቬንተሪ አስተዳደር":             "STORE ADMINISTRATION",
    "የትራንስፖርት ክፍል":                "LOGISTICS",
    "የተሽከርካሪ ጥገና ክፍል":            "F.E.S",
    "LPCD":                                "L.P.C.D",
    "ሆስፒታል":                           "MEDICAL SERVICE",
    "የግብርና ምርምር ክፍል":              "AGRICULTURE RESEARCH",
    # Sub-dept name collisions (14.2 = CULTIVATION same as 14 parent)
    "TILLAGE":                             "TILLAGE",
    "CANE CUTTING":                        "CANE CUTTING",
    "HAULAGE":                             "HAULAGE",
}


def forward(apps, schema_editor):
    Department = apps.get_model('departments', 'Department')
    Employee = apps.get_model('employees', 'Employee')
    User = apps.get_model('authentication', 'User')

    # ── 1. Backup and clear ────────────────────────────────────────────────
    try:
        schema_editor.execute(
            "CREATE TABLE IF NOT EXISTS _dept_backup_0005 AS SELECT * FROM departments;"
        )
    except Exception:
        pass  # table may not exist yet

    Department.objects.all().delete()

    # ── 2. Build official departments in two passes (parents first) ────────
    created = {}  # code -> Department instance

    # Pass 1: create top-level (parent_code is None)
    for code, name, parent_code, level, sort_order in OFFICIAL_DEPARTMENTS:
        if parent_code is None:
            dept = Department(
                code=code,
                name=name,
                level=level,
                sort_order=sort_order,
                description='',
                is_active=True,
            )
            dept.save()
            created[code] = dept

    # Pass 2: create sub-departments
    for code, name, parent_code, level, sort_order in OFFICIAL_DEPARTMENTS:
        if parent_code is not None:
            parent = created.get(parent_code)
            dept = Department(
                code=code,
                name=name,
                parent=parent,
                level=level,
                sort_order=sort_order,
                description='',
                is_active=True,
            )
            dept.save()
            created[code] = dept

    # ── 3. Normalise CharField department references ───────────────────────
    # Build a reverse map: any known old name -> official name
    old_to_official = {}
    for old, official in LEGACY_NAME_MAP.items():
        if old.lower() != official.lower():
            old_to_official[old] = official

    # Also handle the Amharic names from the old migration 0003
    amharic_to_official = {
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
        "ሆስፒታል":                                     "MEDICAL SERVICE",
        "የግብርና ምርምር ክፍል":                         "AGRICULTURE RESEARCH",
    }
    old_to_official.update(amharic_to_official)

    def update_charfield(model_path, field_name="department"):
        Model = apps.get_model(*model_path.split('.'))
        for old_name, official_name in old_to_official.items():
            Model.objects.filter(**{field_name: old_name}).update(**{field_name: official_name})
        # Also set blank/null values to empty string for consistency
        Model.objects.filter(**{field_name: ''}).update(**{field_name: ''})

    update_charfield('assets.Asset')
    update_charfield('authentication.User')
    update_charfield('audit.AuditAssignment')
    update_charfield('audit.AuditScan')
    update_charfield('authentication.UserDepartmentAccess')
    update_charfield('houses.HouseHandoverReceipt')


def reverse(apps, schema_editor):
    """Best-effort restore from backup table."""
    Department = apps.get_model('departments', 'Department')
    Department.objects.all().delete()
    try:
        schema_editor.execute(
            "INSERT INTO departments SELECT * FROM _dept_backup_0005;"
        )
    except Exception:
        pass


class Migration(migrations.Migration):

    dependencies = [
        ('departments', '0004_add_level_sort_order'),
        ('employees', '0003_employee_job_type_employee_names'),
        ('assets', '0001_initial'),
        ('authentication', '0001_initial'),
        ('audit', '0001_initial'),
        ('houses', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(forward, reverse),
    ]
