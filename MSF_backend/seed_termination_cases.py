"""Seed default termination cases — run via: python manage.py shell < seed_termination_cases.py"""
from houses.models import TerminationCase

cases = [
    {"code": "TRANSFER", "name": "Changed House / House Transfer", "category": "Transfer",
     "description": "Employee is being transferred from one allocated house to another.",
     "requires_inspection": "Conditional", "requires_approval": True, "auto_verify_employment": False, "priority": 1},
    {"code": "RETIREMENT", "name": "Retirement", "category": "Retirement",
     "description": "Employee is retiring from service.",
     "requires_inspection": "Always", "requires_approval": True, "auto_verify_employment": True, "priority": 2},
    {"code": "RELEASE", "name": "Release From Factory Employment", "category": "Release",
     "description": "Employee has been released/separated from factory employment.",
     "requires_inspection": "Always", "requires_approval": True, "auto_verify_employment": True, "priority": 3},
    {"code": "VOLUNTARY", "name": "Voluntary Surrender", "category": "Voluntary",
     "description": "Employee voluntarily surrenders their housing allocation.",
     "requires_inspection": "Always", "requires_approval": True, "auto_verify_employment": False, "priority": 4},
    {"code": "DISCIPLINARY", "name": "Disciplinary Action", "category": "Disciplinary",
     "description": "Housing allocation terminated as a result of disciplinary action.",
     "requires_inspection": "Conditional", "requires_approval": True, "auto_verify_employment": False, "priority": 5},
    {"code": "OTHER", "name": "Other / Special Circumstances", "category": "Other",
     "description": "Termination for reasons not covered by other cases.",
     "requires_inspection": "Conditional", "requires_approval": True, "auto_verify_employment": False, "priority": 99},
]

for c in cases:
    obj, created = TerminationCase.objects.get_or_create(code=c["code"], defaults=c)
    status = "Created" if created else "Exists"
    print(f"  {status}: {obj.code} - {obj.name}")

print(f"Done. Total cases: {TerminationCase.objects.count()}")
