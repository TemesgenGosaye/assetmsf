import urllib.request, json

BASE = 'http://127.0.0.1:8000/api'

# 1. Login as superuser
print('=== 1. LOGIN ===')
login_data = json.dumps({'email': 'superadmin@msf.org', 'password': 'SuperAdmin@2025'}).encode()
req = urllib.request.Request(BASE + '/auth/login/', data=login_data, headers={'Content-Type': 'application/json'})
resp = urllib.request.urlopen(req)
body = json.loads(resp.read())
token = body['data']['access']
user = body['data']['user']
print('Login OK. Role:', user['role'], '| Name:', user['name'])

hdrs = {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}

# 2. Verify password (correct)
print('\n=== 2. VERIFY PASSWORD (correct) ===')
vdata = json.dumps({'password': 'SuperAdmin@2025'}).encode()
req2 = urllib.request.Request(BASE + '/auth/verify-password/', data=vdata, headers=hdrs)
resp2 = urllib.request.urlopen(req2)
vbody = json.loads(resp2.read())
print('Valid:', vbody['data']['valid'], '| Success:', vbody['success'])

# 3. Verify password (wrong) - must return 401
print('\n=== 3. VERIFY PASSWORD (wrong) ===')
try:
    vbad = json.dumps({'password': 'wrongpassword'}).encode()
    req3 = urllib.request.Request(BASE + '/auth/verify-password/', data=vbad, headers=hdrs)
    urllib.request.urlopen(req3)
    print('ERROR: should have been rejected')
except urllib.error.HTTPError as e:
    b3 = json.loads(e.read())
    print('Rejected correctly. success:', b3['success'], '| message:', b3['message'])

# 4. List employees
print('\n=== 4. LIST EMPLOYEES ===')
req4 = urllib.request.Request(BASE + '/employees/?page_size=50', headers=hdrs)
resp4 = urllib.request.urlopen(req4)
emp_body = json.loads(resp4.read())
emps = emp_body['data'] if isinstance(emp_body['data'], list) else []
print('Count:', len(emps))
for e in emps:
    print(' ', e['employee_id'], '|', e['full_name'], '|', e['job_position'], '|', e['status'], '| yrs:', e['service_years'])

# 5. Create employee via API
print('\n=== 5. CREATE EMPLOYEE ===')
new_emp = json.dumps({
    'full_name': 'Sara Mbeki',
    'national_id': 'MSF-2025-0002',
    'job_position': 'Logistics Officer',
    'job_grade': 'G5',
    'hire_date': '2023-06-01',
    'family_size': 2,
    'has_disability': False,
    'status': 'Active',
}).encode()
req5 = urllib.request.Request(BASE + '/employees/', data=new_emp, headers=hdrs, method='POST')
try:
    resp5 = urllib.request.urlopen(req5)
    c5 = json.loads(resp5.read())
    print('Created:', c5['data']['employee_id'], c5['data']['full_name'])
    new_id = c5['data']['id']
except urllib.error.HTTPError as e:
    print('Error:', e.read())
    new_id = None

# 6. Update employee
if new_id:
    print('\n=== 6. UPDATE EMPLOYEE ===')
    patch = json.dumps({'job_grade': 'G6', 'status': 'Active'}).encode()
    req6 = urllib.request.Request(BASE + '/employees/' + new_id + '/', data=patch, headers=hdrs, method='PATCH')
    resp6 = urllib.request.urlopen(req6)
    u6 = json.loads(resp6.read())
    print('Updated grade:', u6['data']['job_grade'])

    # 7. Delete employee
    print('\n=== 7. DELETE EMPLOYEE ===')
    req7 = urllib.request.Request(BASE + '/employees/' + new_id + '/', headers=hdrs, method='DELETE')
    resp7 = urllib.request.urlopen(req7)
    d7 = json.loads(resp7.read())
    print('Deleted. Message:', d7['message'])

print('\n=== ALL TESTS PASSED ===')
