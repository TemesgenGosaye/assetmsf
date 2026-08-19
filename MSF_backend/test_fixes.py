"""Test that the fixes work."""
import os, sys, json, urllib.request, urllib.error

BASE = 'http://127.0.0.1:8000/api'

def req(method, path, data=None, token=None):
    url = BASE + path
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    body = json.dumps(data).encode('utf-8') if data else None
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

# Login
s, d = req('POST', '/auth/login/', {'email': 'admin@demo.com', 'password': 'admin123'})
token = d['data']['access']
print('Logged in')

# 1. Empty expiry_date (was broken before fix)
s, d = req('POST', '/assets/', {
    'asset_code': 'TEST-EMPTY-DATE', 'name': 'Empty Date Test',
    'property': 'PROP-001', 'department': 'MANAGEMENT INFORMATION SYSTEM', 'quantity': 1,
    'status': 'active', 'condition': 'good', 'expiry_date': '',
}, token)
msg = d.get('message')
errs = d.get('errors')
print(f'[TEST 1] Empty expiry_date: {s} - {msg}')
if errs:
    print(f'  ERRORS: {json.dumps(errs)}')

# 2. Inactive property PROP-002 (now should be active)
s, d = req('POST', '/assets/', {
    'asset_code': 'TEST-PROP002', 'name': 'Prop 002 Test',
    'property': 'PROP-002', 'department': 'MANAGEMENT INFORMATION SYSTEM', 'quantity': 1,
    'status': 'active', 'condition': 'good',
}, token)
msg = d.get('message')
print(f'[TEST 2] PROP-002 (now active): {s} - {msg}')

# 3. Full frontend payload with sample item type
s, d = req('POST', '/assets/', {
    'asset_code': '60-0-00-999', 'name': 'Frontend Style Test',
    'property': 'PROP-001', 'department': 'LOGISTICS', 'quantity': 1,
    'purchase_date': None, 'expiry_date': None, 'po_number': None,
    'condition': 'good', 'status': 'active', 'location': None,
    'description': None, 'serial_number': None,
    'amc_enabled': False, 'amc_start_date': None, 'amc_end_date': None,
    'item_type_name': 'office furniture',
}, token)
msg = d.get('message')
print(f'[TEST 3] Full payload: {s} - {msg}')

# Cleanup
s, d = req('GET', '/assets/?page_size=1000', token=token)
for a in d.get('data', {}).get('results', []):
    ac = a['asset_code']
    if ac.startswith('TEST-') or ac == '60-0-00-999':
        req('DELETE', f'/assets/{a["id"]}/', token=token)
        print(f'  Cleaned up: {ac}')

# Verify sample data
s, d = req('GET', '/assets/?page_size=5', token=token)
print('\nFirst 5 assets in DB:')
for a in d.get('data', {}).get('results', []):
    print(f'  {a["asset_code"]:15} | {a["name"]:30} | {a["item_type_name"]:20} | {a["property_name"]}')
