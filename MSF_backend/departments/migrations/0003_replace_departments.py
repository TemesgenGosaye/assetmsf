from django.db import migrations, models
from django.utils.text import slugify


def create_new_departments(apps, schema_editor):
    Department = apps.get_model('departments', 'Department')
    # Backup existing departments
    existing = list(Department.objects.all().values('id', 'name', 'code', 'description', 'parent_id', 'head_id', 'location', 'contact_email', 'contact_phone'))
    # Store backup in a temporary table
    schema_editor.execute(
        "CREATE TABLE IF NOT EXISTS departments_backup AS SELECT * FROM departments;"
    )

    # Delete current departments
    Department.objects.all().delete()

    # New master list of 30 departments (name and generated code)
    new_departments = [
        {"name": "የውስጥ ኦዲት አገልግሎት", "code": "D01"},
        {"name": "የሕግ አገልግሎት", "code": "D02"},
        {"name": "የምርምርና ልማት ክፍል", "code": "D03"},
        {"name": "የሰው ኃይል አስተዳደር", "code": "D04"},
        {"name": "የፋይናንስ ክፍል", "code": "D05"},
        {"name": "የእቅድና በጀት ክፍል", "code": "D06"},
        {"name": "የኢንፎርሜሽንና ኮሙኒኬሽን ቴክኖሎጂ (ICT) ክፍል", "code": "D07"},
        {"name": "የግዥ ክፍል", "code": "D08"},
        {"name": "የአቅርቦትና ሎጂስቲክስ ክፍል", "code": "D09"},
        {"name": "የግብርና ኦፕሬሽን", "code": "D10"},
        {"name": "የግብርና ምርት", "code": "D11"},
        {"name": "የሸንኮራ አገዳ ልማትና እርሻ", "code": "D12"},
        {"name": "የእርሻ ማሽነሪ ኦፕሬሽን", "code": "D13"},
        {"name": "የፋብሪካ ኦፕሬሽን", "code": "D14"},
        {"name": "የስኳር ምርት", "code": "D15"},
        {"name": "የሜካኒካል ጥገና", "code": "D16"},
        {"name": "የኤሌክትሪክ ጥገና", "code": "D17"},
        {"name": "የኢንስትሩመንትን ክፍል", "code": "D18"},
        {"name": "የዎርክሾፕ ክፍል", "code": "D19"},
        {"name": "የኃይል ማመንጫ", "code": "D20"},
        {"name": "የኢታኖልና ኮምፓስት ምርት", "code": "D21"},
        {"name": "የአስተዳደር ክፍል", "code": "D22"},
        {"name": "የፋሲሊቲ አስተዳደር", "code": "D23"},
        {"name": "የንብረት አስተዳደር", "code": "D24"},
        {"name": "የኢንቬንተሪ አስተዳደር", "code": "D25"},
        {"name": "የትራንስፖርት ክፍል", "code": "D26"},
        {"name": "የተሽከርካሪ ጥገና ክፍል", "code": "D27"},
        {"name": "LPCD", "code": "D28"},
        {"name": "ሆስፒታል", "code": "D29"},
        {"name": "የግብርና ምርምር ክፍል", "code": "D30"},
    ]
    for dept in new_departments:
        Department.objects.create(name=dept["name"], code=dept["code"], description="")

    # Mapping from old department names to new names (based on approved mapping)
    name_mapping = {
        "Administration": "የሰው ኃይል አስተዳደር",
        "Information Technology": "የኢንፎርሜሽንና ኮሙኒኬሽን ታክኖሎጂ (ICT) ክፍል",
        "Logistics": "የአቅርቦትና ሎጂስቲክስ ክፍል",
        "Production": "የፋብሪካ ኦፕሬሽን",
        "Finance": "የፋይናንስ ክፍል",
    }

    def update_charfield(model_path, field_name="department"):
        Model = apps.get_model(*model_path.split('.'))
        for old, new in name_mapping.items():
            Model.objects.filter(**{field_name: old}).update(**{field_name: new})

    # Update all models that store department as a CharField
    update_charfield('assets.Asset')
    update_charfield('authentication.User')
    # Audit related models
    update_charfield('audit.AuditAssignment')
    update_charfield('audit.AuditScan')
    update_charfield('authentication.UserDepartmentAccess')
    # Add additional models here if needed

def revert_migration(apps, schema_editor):
    # Restore original departments from backup
    schema_editor.execute("DROP TABLE IF EXISTS departments;")
    schema_editor.execute("CREATE TABLE departments AS SELECT * FROM departments_backup;")
    schema_editor.execute("DROP TABLE IF EXISTS departments_backup;")

class Migration(migrations.Migration):
    dependencies = [
        ('departments', '0002_sync_constant_departments'),
        ('assets', '0001_initial'),
        ('authentication', '0001_initial'),
        ('audit', '0001_initial'),
    ]
    operations = [
        migrations.RunPython(create_new_departments, reverse_code=revert_migration),
    ]
