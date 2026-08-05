"""
Seed Metehara Sugar Factory S.C. (Ethiopia) reference data:
departments, properties, categories, item types, vendors, assets,
employees and houses.

Run standalone from the sams_backend directory:
    python seed_metehara_factory.py

The same seed_metehara_factory() function is also called by the
/api/setup-database/ endpoint so it can be re-run against the
deployed (Vercel) database. Seeding is idempotent (get_or_create).
"""
from datetime import date
from decimal import Decimal

DEPARTMENTS = [
    # (code, name, description)
    ("GM",    "General Management",           "Factory general administration and strategic oversight"),
    ("PROD",  "Sugar Production",             "Cane crushing, boiling, crystallization and sugar processing"),
    ("AGRI",  "Agriculture & Plantation",     "Cane cultivation, irrigation and harvesting operations"),
    ("ENGG",  "Engineering & Maintenance",    "Mechanical, electrical and civil maintenance"),
    ("HR",    "Human Resources",              "Staffing, welfare and industrial relations"),
    ("FIN",   "Finance & Accounts",           "Accounting, payroll and financial control"),
    ("PROC",  "Procurement & Logistics",      "Supplies, stores and transport"),
    ("IT",    "Information Technology",       "Computing, networks and automation systems"),
    ("QC",    "Quality Control & Laboratory", "Product testing and quality assurance"),
    ("MED",   "Medical Services",             "Factory clinic and occupational health"),
]

PROPERTIES = [
    # (code, name, type, address, city, state, country)
    ("MSF-PLANT", "Metehara Sugar Factory Plant",              "manufacturing", "Metehara Town, Awash Valley",         "Metahara", "Oromia", "Ethiopia"),
    ("MSF-FIELD", "Metehara Cane Plantation Fields",           "other",         "Kessem Estate, Awash Valley",         "Metahara", "Oromia", "Ethiopia"),
    ("MSF-HQ",    "Metehara Sugar Factory Administration HQ",  "office",        "Metehara Town, Factory Zone",         "Metahara", "Oromia", "Ethiopia"),
    ("MSF-STORE", "Metehara Sugar Factory Central Store",      "storage",       "Metehara Town, Factory Zone",         "Metahara", "Oromia", "Ethiopia"),
    ("MSF-HOUSE", "Metehara Sugar Factory Staff Housing",      "other",         "Staff Quarters, Metehara Town",       "Metahara", "Oromia", "Ethiopia"),
]

CATEGORIES = [
    # (code, name, description)
    ("VEH",   "Vehicles & Transport",         "Cars, trucks and transport machinery"),
    ("AGR",   "Agricultural Machinery",       "Farm, irrigation and cane-field equipment"),
    ("IND",   "Industrial & Factory Equipment", "Sugar processing plant machinery"),
    ("IT-HW", "IT & Communication Hardware",  "Computers, servers and network devices"),
    ("OFF-EQ", "Office Equipment",            "Office utility machines and equipment"),
    ("FUR",   "Furniture",                    "Desks, chairs, cabinets and office furniture"),
    ("LAB",   "Laboratory Equipment",         "Laboratory instruments for sugar testing"),
    ("MED",   "Medical Equipment",            "Clinic and medical equipment"),
]

ITEM_TYPES = [
    # (name, category_code, description, depreciation_rate, warranty_months)
    ("light vehicle",          "VEH",   "Sedans, SUVs, pickups and utility vehicles",      Decimal("20.00"), 36),
    ("truck",                  "VEH",   "Cargo and cane transport trucks",                 Decimal("20.00"), 36),
    ("tractor",                "AGR",   "Farm tractors for cane cultivation",              Decimal("15.00"), 48),
    ("cane loader",            "AGR",   "Machines for loading harvested cane",             Decimal("15.00"), 48),
    ("irrigation equipment",   "AGR",   "Pivot, drip and sprinkler irrigation systems",    Decimal("15.00"), 36),
    ("factory equipment",      "IND",   "Sugar processing plant machinery",                Decimal("10.00"), 24),
    ("boiler",                 "IND",   "High pressure steam boilers",                     Decimal("10.00"), 24),
    ("generator",              "OFF-EQ", "Electricity backup generators",                  Decimal("15.00"), 24),
    ("laptop",                 "IT-HW", "Personal laptop computers",                       Decimal("25.00"), 24),
    ("printer",                "IT-HW", "Printers and scanners",                           Decimal("15.00"), 12),
    ("server",                 "IT-HW", "Servers and network infrastructure",              Decimal("25.00"), 36),
    ("office furniture",       "FUR",   "Furniture for office workspaces",                 Decimal("10.00"), 12),
    ("laboratory instrument",  "LAB",   "Instruments for laboratory testing",              Decimal("15.00"), 24),
    ("medical equipment",      "MED",   "Clinic and medical equipment",                    Decimal("10.00"), 24),
]

VENDORS = [
    # (name, code, contact_person, email, phone, address, city, country)
    ("Metal & Engineering Corporation", "METEC", "Bekele Tesfaye",  "info@metec.gov.et",     "+251911123456", "Piassa",                        "Addis Ababa", "Ethiopia"),
    ("National Motors Corporation",     "NMC",   "Girma Alemu",     "sales@nationalmotors.et","+251911654321", "Bole Road",                     "Addis Ababa", "Ethiopia"),
    ("Global IT Solutions",             "GITS",  "Hanna Fikru",     "support@globalits.et",  "+251911223344", "Kazanchis",                     "Addis Ababa", "Ethiopia"),
    ("Awash Trading House",             "ATH",   "Solomon Tadesse", "info@awashtrading.et",  "+251911998877", "Central Zone",                   "Adama",       "Ethiopia"),
    ("Oromia Machinery Engineering",    "OME",   "Diriba Hunde",    "sales@ome.et",          "+251911445566", "Industrial Zone",                "Adama",       "Ethiopia"),
    ("Bole Furniture Factory",          "BFF",   "Meseret Abebe",   "sales@bolefurniture.et","+251911332211", "Bole Sub City, Road 7",          "Addis Ababa", "Ethiopia"),
]

ASSETS = [
    # (asset_code, name, serial_number, property_name, department, quantity, purchase_cost,
    #  purchase_date, status, condition, vendor_name, category_code, item_type_name)
    ("MSF-001", "Sugarcane Cane Truck (Isuzu FTR 33)",       "MSF-CNT-001", "Metehara Sugar Factory Plant",             "Procurement & Logistics",   1, Decimal("145000.00"), date(2023, 3, 12),  "active", "excellent", "National Motors Corporation",    "VEH",   "truck"),
    ("MSF-002", "Cane Truck DAF CF 290",                     "MSF-CNT-002", "Metehara Sugar Factory Plant",             "Procurement & Logistics",   1, Decimal("175000.00"), date(2022, 8, 20),  "active", "fair",      "National Motors Corporation",    "VEH",   "truck"),
    ("MSF-003", "Toyota Land Cruiser Utility",               "MSF-LC-001",  "Metehara Sugar Factory Administration HQ", "General Management",        1, Decimal("68000.00"),  date(2023, 6, 15),  "active", "excellent", "National Motors Corporation",    "VEH",   "light vehicle"),
    ("MSF-004", "Mitsubishi Pajero Field Vehicle",           "MSF-PJ-001",  "Metehara Cane Plantation Fields",          "Agriculture & Plantation",  1, Decimal("54000.00"),  date(2022, 11, 3),  "active", "good",      "National Motors Corporation",    "VEH",   "light vehicle"),
    ("MSF-005", "John Deere Tractor 6110M",                  "MSF-TR-001",  "Metehara Cane Plantation Fields",          "Agriculture & Plantation",  1, Decimal("88000.00"),  date(2023, 1, 25),  "active", "excellent", "Oromia Machinery Engineering", "AGR",   "tractor"),
    ("MSF-006", "Massey Ferguson Tractor 5455",              "MSF-TR-002",  "Metehara Cane Plantation Fields",          "Agriculture & Plantation",  1, Decimal("52000.00"),  date(2021, 9, 18),  "active", "fair",      "Oromia Machinery Engineering", "AGR",   "tractor"),
    ("MSF-007", "Cane Loader (Case IH)",                     "MSF-CL-001",  "Metehara Cane Plantation Fields",          "Agriculture & Plantation",  1, Decimal("125000.00"), date(2022, 4, 11),  "active", "good",      "Oromia Machinery Engineering", "AGR",   "cane loader"),
    ("MSF-008", "Cane Loader (Bell 225E)",                   "MSF-CL-002",  "Metehara Cane Plantation Fields",          "Agriculture & Plantation",  1, Decimal("98000.00"),  date(2020, 10, 30), "active", "poor",      "Oromia Machinery Engineering", "AGR",   "cane loader"),
    ("MSF-009", "Center Pivot Irrigation System",            "MSF-IR-001",  "Metehara Cane Plantation Fields",          "Agriculture & Plantation",  1, Decimal("64000.00"),  date(2023, 2, 14),  "active", "excellent", "Awash Trading House",          "AGR",   "irrigation equipment"),
    ("MSF-010", "Drip Irrigation Line Set",                  "MSF-IR-002",  "Metehara Cane Plantation Fields",          "Agriculture & Plantation",  1, Decimal("18000.00"),  date(2023, 4, 5),   "active", "good",      "Awash Trading House",          "AGR",   "irrigation equipment"),
    ("MSF-011", "Sugarcane Crusher Mill 3-Roller",           "MSF-CR-001",  "Metehara Sugar Factory Plant",             "Sugar Production",          1, Decimal("420000.00"), date(2019, 12, 20), "active", "fair",      "Metal & Engineering Corporation", "IND", "factory equipment"),
    ("MSF-012", "High Pressure Boiler 45 T/hr",              "MSF-BL-001",  "Metehara Sugar Factory Plant",             "Sugar Production",          1, Decimal("560000.00"), date(2018, 6, 14),  "active", "fair",      "Metal & Engineering Corporation", "IND", "boiler"),
    ("MSF-013", "Evaporator Set (5-Unit)",                   "MSF-EV-001",  "Metehara Sugar Factory Plant",             "Sugar Production",          1, Decimal("240000.00"), date(2019, 3, 8),   "active", "good",      "Metal & Engineering Corporation", "IND", "factory equipment"),
    ("MSF-014", "Centrifugal Machine B-Series",              "MSF-CF-001",  "Metehara Sugar Factory Plant",             "Sugar Production",          1, Decimal("96000.00"),  date(2020, 1, 17),  "active", "good",      "Metal & Engineering Corporation", "IND", "factory equipment"),
    ("MSF-015", "Continuous Centrifugal C-Series",           "MSF-CF-002",  "Metehara Sugar Factory Plant",             "Sugar Production",          1, Decimal("110000.00"), date(2021, 5, 22),  "active", "fair",      "Metal & Engineering Corporation", "IND", "factory equipment"),
    ("MSF-016", "Sugar Dryer & Cooler Unit",                 "MSF-DR-001",  "Metehara Sugar Factory Plant",             "Sugar Production",          1, Decimal("78000.00"),  date(2020, 9, 9),   "active", "good",      "Metal & Engineering Corporation", "IND", "factory equipment"),
    ("MSF-017", "Rotary Vacuum Filter",                      "MSF-RV-001",  "Metehara Sugar Factory Plant",             "Sugar Production",          1, Decimal("67000.00"),  date(2019, 11, 30), "active", "fair",      "Metal & Engineering Corporation", "IND", "factory equipment"),
    ("MSF-018", "Cane Mill Drive Turbine",                   "MSF-TB-001",  "Metehara Sugar Factory Plant",             "Sugar Production",          1, Decimal("210000.00"), date(2018, 2, 25),  "active", "fair",      "Metal & Engineering Corporation", "IND", "factory equipment"),
    ("MSF-019", "Diesel Generator Cummins 500kVA",           "MSF-GN-001",  "Metehara Sugar Factory Plant",             "Engineering & Maintenance", 1, Decimal("89000.00"),  date(2022, 7, 19),  "active", "excellent", "Awash Trading House",          "OFF-EQ", "generator"),
    ("MSF-020", "Backup Generator Caterpillar 200kVA",       "MSF-GN-002",  "Metehara Sugar Factory Administration HQ", "General Management",        1, Decimal("42000.00"),  date(2021, 12, 1),  "active", "good",      "Awash Trading House",          "OFF-EQ", "generator"),
    ("MSF-021", "Submersible Water Pump 20HP",               "MSF-PP-001",  "Metehara Sugar Factory Plant",             "Engineering & Maintenance", 1, Decimal("6500.00"),   date(2023, 5, 10),  "active", "excellent", "Awash Trading House",          "IND",   "factory equipment"),
    ("MSF-022", "Fire Fighting Truck",                       "MSF-FF-001",  "Metehara Sugar Factory Plant",             "Engineering & Maintenance", 1, Decimal("118000.00"), date(2020, 8, 27),  "active", "good",      "National Motors Corporation",    "VEH",   "truck"),
    ("MSF-023", "Ambulance (Land Cruiser)",                  "MSF-AMB-001", "Metehara Sugar Factory Staff Housing",     "Medical Services",          1, Decimal("72000.00"),  date(2022, 3, 16),  "active", "excellent", "National Motors Corporation",    "VEH",   "light vehicle"),
    ("MSF-024", "Polarimeter (Digital)",                     "MSF-LB-001",  "Metehara Sugar Factory Plant",             "Quality Control & Laboratory", 1, Decimal("14500.00"), date(2023, 1, 12), "active", "excellent", "Global IT Solutions",          "LAB",   "laboratory instrument"),
    ("MSF-025", "Refractometer",                             "MSF-LB-002",  "Metehara Sugar Factory Plant",             "Quality Control & Laboratory", 1, Decimal("3200.00"),  date(2022, 6, 21),  "active", "good",      "Global IT Solutions",          "LAB",   "laboratory instrument"),
    ("MSF-026", "PH Meter & Conductivity Tester",            "MSF-LB-003",  "Metehara Sugar Factory Plant",             "Quality Control & Laboratory", 1, Decimal("1800.00"),  date(2023, 3, 2),   "active", "good",      "Global IT Solutions",          "LAB",   "laboratory instrument"),
    ("MSF-027", "Analytical Balance 0.1mg",                  "MSF-LB-004",  "Metehara Sugar Factory Plant",             "Quality Control & Laboratory", 1, Decimal("5800.00"),  date(2021, 10, 13), "active", "fair",      "Global IT Solutions",          "LAB",   "laboratory instrument"),
    ("MSF-028", "Dell PowerEdge Server",                     "MSF-SV-001",  "Metehara Sugar Factory Administration HQ", "Information Technology",    1, Decimal("9200.00"),   date(2023, 4, 18),  "active", "excellent", "Global IT Solutions",          "IT-HW", "server"),
    ("MSF-029", "Dell Latitude 5440 Laptop",                 "MSF-LT-001",  "Metehara Sugar Factory Administration HQ", "Information Technology",    1, Decimal("1150.00"),   date(2023, 7, 1),   "active", "excellent", "Global IT Solutions",          "IT-HW", "laptop"),
    ("MSF-030", "HP LaserJet Pro Printer",                   "MSF-PR-001",  "Metehara Sugar Factory Administration HQ", "General Management",        1, Decimal("480.00"),    date(2022, 11, 9),  "active", "good",      "Global IT Solutions",          "IT-HW", "printer"),
    ("MSF-031", "Executive Desk Set",                        "MSF-FR-001",  "Metehara Sugar Factory Administration HQ", "General Management",        1, Decimal("950.00"),    date(2022, 5, 30),  "active", "good",      "Bole Furniture Factory",        "FUR",   "office furniture"),
    ("MSF-032", "Steel Filing Cabinet Set",                  "MSF-FR-002",  "Metehara Sugar Factory Administration HQ", "Finance & Accounts",        1, Decimal("520.00"),    date(2021, 8, 24),  "active", "fair",      "Bole Furniture Factory",        "FUR",   "office furniture"),
]

EMPLOYEES = [
    # (national_id, full_name, job_position, job_grade, dept_name, hire_date, family_size, marital_status, has_disability, status)
    ("NID-MSF-0001", "Ayele Tadesse",         "General Manager",          "Grade-6", "General Management",           date(2008, 6, 15),  6, "Married", False, "Active"),
    ("NID-MSF-0002", "Bekele Alemayehu",      "Deputy General Manager",   "Grade-6", "General Management",           date(2010, 2, 1),   5, "Married", False, "Active"),
    ("NID-MSF-0003", "Tigist Worku",          "Sugar Process Engineer",   "Grade-5", "Sugar Production",             date(2015, 8, 20),  4, "Married", False, "Active"),
    ("NID-MSF-0004", "Getachew Lemma",        "Chief Mechanic",           "Grade-4", "Engineering & Maintenance",    date(2012, 4, 11),  5, "Married", False, "Active"),
    ("NID-MSF-0005", "Selamawit Hailu",       "Laboratory Chemist",       "Grade-4", "Quality Control & Laboratory", date(2017, 1, 9),   3, "Single",  False, "Active"),
    ("NID-MSF-0006", "Tesfaye Mekonnen",      "Boiler Operator",          "Grade-3", "Sugar Production",             date(2014, 7, 25),  6, "Married", False, "Active"),
    ("NID-MSF-0007", "Muluken Girma",         "Electrician",              "Grade-3", "Engineering & Maintenance",    date(2016, 3, 14),  4, "Married", False, "Active"),
    ("NID-MSF-0008", "Azeb Assefa",           "Senior Accountant",        "Grade-4", "Finance & Accounts",           date(2013, 9, 30),  3, "Married", False, "Active"),
    ("NID-MSF-0009", "Worku Dibaba",          "Tractor Operator",         "Grade-2", "Agriculture & Plantation",     date(2018, 5, 22),  5, "Married", False, "Active"),
    ("NID-MSF-0010", "Etsegenet Bekele",      "HR Officer",               "Grade-3", "Human Resources",              date(2019, 2, 18),  2, "Single",  False, "Active"),
    ("NID-MSF-0011", "Dawit Kebede",          "Procurement Officer",      "Grade-4", "Procurement & Logistics",      date(2015, 11, 5),  4, "Married", False, "Active"),
    ("NID-MSF-0012", "Meseret Alemu",         "Factory Nurse",            "Grade-3", "Medical Services",             date(2018, 6, 11),  2, "Single",  False, "Active"),
    ("NID-MSF-0013", "Solomon Demissie",      "Security Supervisor",      "Grade-2", "General Management",           date(2016, 12, 1),  5, "Married", False, "Active"),
    ("NID-MSF-0014", "Hiwot Getahun",         "IT Specialist",            "Grade-4", "Information Technology",       date(2019, 4, 8),   3, "Single",  False, "Active"),
    ("NID-MSF-0015", "Alemu Shiferaw",        "Cane Development Officer", "Grade-4", "Agriculture & Plantation",     date(2013, 10, 16), 6, "Married", False, "Active"),
    ("NID-MSF-0016", "Rahel Teshome",         "Receptionist",             "Grade-1", "General Management",           date(2021, 8, 2),   1, "Single",  False, "Active"),
    ("NID-MSF-0017", "Girma Belachew",        "Store Keeper",             "Grade-2", "Procurement & Logistics",      date(2017, 2, 27),  4, "Married", False, "Active"),
    ("NID-MSF-0018", "Frehiwot Girma",        "Data Entry Clerk",         "Grade-1", "Information Technology",       date(2022, 1, 17),  1, "Single",  False, "Active"),
    ("NID-MSF-0019", "Kebede Woldemichael",   "Field Supervisor",         "Grade-3", "Agriculture & Plantation",     date(2014, 5, 28),  5, "Married", True,  "Active"),
    ("NID-MSF-0020", "Aster Fikre",           "Quality Control Officer",  "Grade-3", "Quality Control & Laboratory", date(2020, 7, 13),  2, "Married", False, "Active"),
]

HOUSES = [
    # (location, house_type, status, capacity, description, inside_items, damaged_fields)
    ("Metehara Sugar Factory Staff Quarters Block A, Unit 1",  "Staff", "Active",   2, "Standard staff unit in Block A.",       ["Bed", "Chair", "Table", "Locker"], {}),
    ("Metehara Sugar Factory Staff Quarters Block A, Unit 2",  "Staff", "Active",   2, "Standard staff unit in Block A.",       ["Bed", "Chair", "Table"],            {}),
    ("Metehara Sugar Factory Staff Quarters Block A, Unit 3",  "C",     "Active",   3, "Type C flat in Block A.",               ["Bed", "Chair", "Table", "Locker"], {}),
    ("Metehara Sugar Factory Staff Quarters Block A, Unit 4",  "C",     "Inactive", 3, "Type C flat in Block A - under repair.",["Bed", "Chair"],                     {"damaged_windows": True, "damaged_switch": True}),
    ("Metehara Sugar Factory Staff Quarters Block A, Unit 5",  "Staff", "Active",   2, "Standard staff unit in Block A.",       ["Bed", "Table"],                     {}),
    ("Metehara Sugar Factory Staff Quarters Block A, Unit 6",  "Staff", "Active",   2, "Standard staff unit in Block A.",       ["Bed", "Chair", "Locker"],           {}),
    ("Metehara Sugar Factory Staff Quarters Block B, Unit 1",  "Staff", "Active",   2, "Standard staff unit in Block B.",       ["Bed", "Chair", "Table", "Locker"], {}),
    ("Metehara Sugar Factory Staff Quarters Block B, Unit 2",  "C",     "Active",   3, "Type C flat in Block B.",               ["Bed", "Chair", "Table"],            {}),
    ("Metehara Sugar Factory Staff Quarters Block B, Unit 3",  "C",     "Active",   3, "Type C flat in Block B.",               ["Bed", "Chair", "Locker"],           {}),
    ("Metehara Sugar Factory Staff Quarters Block B, Unit 4",  "Staff", "Active",   2, "Standard staff unit in Block B.",       ["Bed", "Table"],                     {}),
    ("Metehara Sugar Factory Staff Quarters Block B, Unit 5",  "D",     "Active",   1, "Type D studio in Block B.",             ["Bed", "Chair"],                     {}),
    ("Metehara Sugar Factory Staff Quarters Block B, Unit 6",  "D",     "Inactive", 1, "Type D studio in Block B - damaged.",   ["Bed"],                              {"damaged_door": True, "damaged_water": True}),
    ("Metehara Sugar Factory Senior Staff Residential Area, House 1", "A", "Active", 1, "Executive Type A bungalow.",           ["Bed", "Chair", "Table", "Locker"], {}),
    ("Metehara Sugar Factory Senior Staff Residential Area, House 2", "A", "Active", 1, "Executive Type A bungalow.",           ["Bed", "Chair", "Table", "Locker"], {}),
    ("Metehara Sugar Factory Senior Staff Residential Area, House 3", "B", "Active", 2, "Type B family house.",                 ["Bed", "Chair", "Table"],            {}),
    ("Metehara Sugar Factory Senior Staff Residential Area, House 4", "B", "Active", 2, "Type B family house.",                 ["Bed", "Chair", "Table", "Locker"], {}),
    ("Metehara Sugar Factory Workers Village, Unit 1",         "D",     "Active",   1, "Type D studio in workers village.",    ["Bed", "Chair"],                     {}),
    ("Metehara Sugar Factory Workers Village, Unit 2",         "D",     "Active",   1, "Type D studio in workers village.",    ["Bed", "Table"],                     {}),
    ("Metehara Sugar Factory Workers Village, Unit 3",         "E",     "Active",   8, "Type E shared barrack space.",         ["Bed", "Locker"],                    {}),
    ("Metehara Sugar Factory Workers Village, Unit 4",         "E",     "Active",   8, "Type E shared barrack space.",         ["Bed", "Locker"],                    {}),
    ("Metehara Sugar Factory Cane Field Camp (Kessem), Unit 1", "Staff", "Active",  2, "Camp unit for field staff.",            ["Bed", "Chair", "Locker"],           {}),
    ("Metehara Sugar Factory Cane Field Camp (Kessem), Unit 2", "Staff", "Active",  2, "Camp unit for field staff.",            ["Bed", "Chair"],                     {}),
    ("Metehara Sugar Factory Cane Field Camp (Kessem), Unit 3", "E",     "Active",  8, "Camp barrack for field workers.",       ["Bed", "Locker"],                    {}),
    ("Metehara Sugar Factory Cane Field Camp (Kessem), Unit 4", "E",     "Inactive", 8, "Camp barrack - under maintenance.",     ["Bed"],                              {"damaged_walls": True, "damaged_bulb": True}),
]


def seed_metehara_factory():
    """Idempotently seed Metehara Sugar Factory reference data. Returns a summary dict."""
    from django.contrib.auth import get_user_model
    from django.db import transaction
    from assets.models import Asset
    from audit.models import AuditSession
    from categories.models import Category, ItemType
    from common.models import Vendor
    from departments.models import Department
    from employees.models import Employee
    from houses.models import House
    from properties.models import Property

    User = get_user_model()

    summary = {
        "departments": 0,
        "properties": 0,
        "categories": 0,
        "item_types": 0,
        "vendors": 0,
        "assets": 0,
        "employees": 0,
        "houses": 0,
    }

    def _log(label, obj, created):
        summary[label] += 1 if created else 0
        print(f"  [{'Created' if created else 'Exists '}] {obj}")

    # --- Users (owners / managers) ---
    superadmin, sa_created = User.objects.get_or_create(
        email="superadmin@msf.org",
        defaults={
            "name": "Super Admin",
            "role": "SUPER_ADMIN",
            "is_staff": True,
            "is_superuser": True,
            "status": "active",
        },
    )
    if sa_created or not superadmin.password or not superadmin.check_password("SuperAdmin@2025"):
        superadmin.set_password("SuperAdmin@2025")
        superadmin.save()
    admin_user, admin_created = User.objects.get_or_create(
        email="admin@demo.com",
        defaults={
            "name": "Admin User",
            "role": "ADMIN",
            "is_staff": True,
            "is_superuser": False,
            "status": "active",
        },
    )
    if admin_created or not admin_user.password or not admin_user.check_password("admin123"):
        admin_user.set_password("admin123")
        admin_user.save()
    print(f"  [{'Created' if sa_created or admin_created else 'Exists '}] Users ensured (superadmin, admin).")

    # --- Departments ---
    departments = {}
    for code, name, desc in DEPARTMENTS:
        dept, created = Department.objects.get_or_create(
            code=code,
            defaults={"name": name, "description": desc, "head": admin_user},
        )
        departments[name] = dept
        _log("departments", dept, created)

    # --- Properties ---
    properties = {}
    for code, name, p_type, address, city, state, country in PROPERTIES:
        prop = Property.objects.filter(name=name).first()
        if prop is None:
            prop = Property(
                id=code,
                name=name,
                type=p_type,
                address=address,
                city=city,
                state=state,
                country=country,
                status="active",
                manager=superadmin,
            )
            prop.save()
            properties[name] = prop
            _log("properties", prop, True)
        else:
            if prop.id != code:
                with transaction.atomic():
                    replacement = Property(
                        id=code,
                        name=prop.name,
                        type=prop.type,
                        address=prop.address,
                        city=prop.city,
                        state=prop.state,
                        country=prop.country,
                        postal_code=prop.postal_code,
                        latitude=prop.latitude,
                        longitude=prop.longitude,
                        status=prop.status,
                        manager=prop.manager,
                        contact_email=prop.contact_email,
                        contact_phone=prop.contact_phone,
                        total_area=prop.total_area,
                        description=prop.description,
                        is_active=prop.is_active,
                        created_by=prop.created_by,
                        updated_by=prop.updated_by,
                        created_at=prop.created_at,
                        updated_at=prop.updated_at,
                    )
                    replacement.save()
                    Asset.objects.filter(property_id=prop.id).update(property_id=code)
                    AuditSession.objects.filter(property_id=prop.id).update(property_id=code)
                    prop.delete()
                    prop = replacement
            properties[name] = prop
            _log("properties", prop, False)

    # --- Categories ---
    categories = {}
    for code, name, desc in CATEGORIES:
        cat, created = Category.objects.get_or_create(
            code=code,
            defaults={"name": name, "description": desc},
        )
        categories[code] = cat
        _log("categories", cat, created)

    # --- Item types ---
    item_types = {}
    for name, cat_code, desc, dep_rate, warranty in ITEM_TYPES:
        it, created = ItemType.objects.get_or_create(
            name=name,
            defaults={
                "category": categories[cat_code],
                "description": desc,
                "default_depreciation_rate": dep_rate,
                "default_warranty_period": warranty,
            },
        )
        item_types[name] = it
        _log("item_types", it, created)

    # --- Vendors ---
    vendors = {}
    for name, code, contact, email, phone, address, city, country in VENDORS:
        vendor, created = Vendor.objects.get_or_create(
            code=code,
            defaults={
                "name": name,
                "contact_person": contact,
                "email": email,
                "phone": phone,
                "address": address,
                "city": city,
                "country": country,
                "status": "active",
            },
        )
        vendors[name] = vendor
        _log("vendors", vendor, created)

    # --- Assets ---
    for (code, name, serial, prop_name, dept_name, qty, cost,
         p_date, status, condition, vendor_name, cat_code, item_type_name) in ASSETS:
        asset, created = Asset.objects.get_or_create(
            asset_code=code,
            defaults={
                "name": name,
                "serial_number": serial,
                "property": properties[prop_name],
                "department": dept_name,
                "quantity": qty,
                "purchase_cost": cost,
                "purchase_date": p_date,
                "status": status,
                "condition": condition,
                "vendor": vendor_name,
                "category": categories[cat_code],
                "item_type": item_types[item_type_name],
                "owner": superadmin,
            },
        )
        _log("assets", asset, created)

    # --- Employees ---
    for (national_id, full_name, job_position, job_grade, dept_name,
         hire_date, family_size, marital, disability, emp_status) in EMPLOYEES:
        emp, created = Employee.objects.get_or_create(
            national_id=national_id,
            defaults={
                "full_name": full_name,
                "job_position": job_position,
                "job_grade": job_grade,
                "department": departments[dept_name],
                "hire_date": hire_date,
                "family_size": family_size,
                "marital_status": marital,
                "has_disability": disability,
                "status": emp_status,
            },
        )
        _log("employees", emp, created)

    # --- Houses ---
    for (location, h_type, h_status, capacity, desc, inside_items, damaged) in HOUSES:
        house, created = House.objects.get_or_create(
            location=location,
            defaults={
                "house_type": h_type,
                "status": h_status,
                "capacity": capacity,
                "description": desc,
                "inside_items": inside_items,
                **damaged,
            },
        )
        _log("houses", house, created)

    return summary


if __name__ == "__main__":
    import os
    import django

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
    django.setup()

    print("=" * 60)
    print("Seeding Metehara Sugar Factory S.C. data...")
    print("=" * 60)
    result = seed_metehara_factory()
    print("=" * 60)
    print("Seed summary (newly created):")
    for key, value in result.items():
        print(f"  {key:<14}: {value}")
    print("=" * 60)
