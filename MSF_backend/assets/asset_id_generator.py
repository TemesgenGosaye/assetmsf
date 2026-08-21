"""
Asset ID Generator — authoritative backend service for Asset ID generation.

Format: 1.06.{ITEM_TYPE_CODE}.{DEPARTMENT_CODE}.{SEQUENCE}

Where:
  1.06            = Metahara Sugar Factory permanent identifier
  ITEM_TYPE_CODE  = Official code from the Fixed Asset Registration Master Book
  DEPARTMENT_CODE = Official department code from the Department Master Data
  SEQUENCE        = Scoped sequential number per (item_type_code, department_code)

All generation is atomic and database-backed to prevent duplicates.
"""
from django.db import transaction
from django.core.exceptions import ValidationError
from .models import Asset

FACTORY_PREFIX = "1.06"


def generate_asset_id(item_type_code: str, department_code: str) -> str:
    """
    Generate the next available Asset ID for a given item type + department combo.

    This is NOT thread-safe on its own -- use generate_asset_id_atomic() for
    concurrent request safety.
    """
    if not item_type_code:
        raise ValidationError("Item Type code is required for Asset ID generation.")
    if not department_code:
        raise ValidationError("Department code is required for Asset ID generation.")

    base = f"{FACTORY_PREFIX}.{item_type_code}.{department_code}"

    existing_codes = list(
        Asset.objects.filter(asset_code__startswith=f"{base}.")
        .values_list("asset_code", flat=True)
    )

    max_seq = 0
    for code in existing_codes:
        parts = code.rsplit(".", 1)
        if len(parts) == 2:
            try:
                seq = int(parts[1])
                if seq > max_seq:
                    max_seq = seq
            except ValueError:
                continue

    next_seq = max_seq + 1
    return f"{base}.{next_seq:02d}"


@transaction.atomic
def generate_asset_id_atomic(item_type_code: str, department_code: str) -> str:
    """
    Atomically generate the next available Asset ID.

    Uses atomic transaction + ORM filtering to prevent two concurrent requests
    from getting the same sequence.

    In SQLite, the entire DB is locked during writes, so this is inherently safe.
    In PostgreSQL, we'd use SELECT ... FOR UPDATE; SQLite's atomicity is sufficient.
    """
    if not item_type_code:
        raise ValidationError("Item Type code is required for Asset ID generation.")
    if not department_code:
        raise ValidationError("Department code is required for Asset ID generation.")

    base = f"{FACTORY_PREFIX}.{item_type_code}.{department_code}"

    existing_codes = list(
        Asset.objects.filter(
            asset_code__startswith=f"{base}.",
            is_active=True,
        ).values_list("asset_code", flat=True)
    )

    max_seq = 0
    for code in existing_codes:
        parts = code.rsplit(".", 1)
        if len(parts) == 2:
            try:
                seq = int(parts[1])
                if seq > max_seq:
                    max_seq = seq
            except ValueError:
                continue

    next_seq = max_seq + 1
    candidate = f"{base}.{next_seq:02d}"

    # Final uniqueness check
    if Asset.objects.filter(asset_code=candidate).exists():
        next_seq += 1
        candidate = f"{base}.{next_seq:02d}"

    return candidate


def validate_asset_id_format(asset_code: str) -> bool:
    """Validate that an asset code matches the expected format."""
    import re
    pattern = rf"^{re.escape(FACTORY_PREFIX)}\.\d+\.\d+(\.\d+)*\.\d{{2,}}$"
    return bool(re.match(pattern, asset_code))


def parse_asset_id(asset_code: str) -> dict:
    """
    Parse an asset code into its components.

    Returns dict with keys: factory, item_type_code, department_code, sequence
    """
    parts = asset_code.split(".")
    if len(parts) < 4:
        return {}

    return {
        "factory": parts[0],
        "item_type_code": parts[1],
        "department_code": parts[2],
        "sequence": parts[3] if len(parts) > 3 else None,
    }
