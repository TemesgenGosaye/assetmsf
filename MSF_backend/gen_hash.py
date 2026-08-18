import hashlib, base64, secrets, sys

def make_django_hash(password):
    algorithm = "pbkdf2_sha256"
    iterations = 870000
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), iterations, dklen=32)
    encoded = base64.b64encode(dk).decode().strip()
    return f"{algorithm}${iterations}${salt}${encoded}"

admin_hash = make_django_hash("admin123")
super_hash = make_django_hash("SuperAdmin@2025")

# Use dollar-quoting for PostgreSQL
sql = f"""BEGIN;
UPDATE users SET password = $${admin_hash}$$ WHERE email != 'superadmin@msf.org';
UPDATE users SET password = $${super_hash}$$ WHERE email = 'superadmin@msf.org';
COMMIT;
"""

sqlfile = r"F:\MetaharaSugarFactory Asset and House\MetaharaSugarFactory Asset and House\MSF_backend\fix_hashes.sql"
with open(sqlfile, "w") as f:
    f.write(sql)

print(f"admin123: {admin_hash}")
print(f"superadmin: {super_hash}")
print(f"SQL written to {sqlfile}")
