"""Test creating assets via API to find validation errors."""
import os, sys, json, urllib.request, urllib.error

BASE = 'http://127.0.0.1:8000/api'

def api_post(path, data, token=None):
    url = f'{BASE}{path}'
    body = json.dumps(data).encode('utf-8')
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(url, data=body, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

def api_delete(path, token):
    url = f'{BASE}{path}'
    headers = {'Authorization': f'Bearer {token}'}
    req = urllib.request.Request(url, headers=headers, method='DELETE')
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code

# Login
status, data = api_post('/auth/login/', {'email': 'admin@demo.com', 'password': 'admin123'})
token = data['data']['access']
print(f'Logged in. Token: {token[:20]}...')

tests = [
    ("string quantity", {
        'asset_code': '60-0-00-001', 'name': 'Test 1', 'property': 'PROP-001',
        'department': 'Admin', 'quantity': '1', 'status': 'active', 'condition': 'good',
        'item_type_name': 'office furniture',
    }),
    ("empty expiry_date", {
        'asset_code': '60-0-00-002', 'name': 'Test 2', 'property': 'PROP-001',
        'department': 'Admin', 'quantity': 1, 'status': 'active', 'condition': 'good',
        'expiry_date': '', 'item_type_name': 'office furniture',
    }),
    ("no item_type_name", {
        'asset_code': '60-0-00-003', 'name': 'Test 3', 'property': 'PROP-001',
        'department': 'Admin', 'quantity': 1, 'status': 'active', 'condition': 'good',
    }),
    ("inactive property PROP-002", {
        'asset_code': '60-0-00-004', 'name': 'Test 4', 'property': 'PROP-002',
        'department': 'Admin', 'quantity': 1, 'status': 'active', 'condition': 'good',
        'item_type_name': 'office furniture',
    }),
    ("inactive property PROP-003", {
        'asset_code': '60-0-00-005', 'name': 'Test 5', 'property': 'PROP-003',
        'department': 'Admin', 'quantity': 1, 'status': 'active', 'condition': 'good',
        'item_type_name': 'office furniture',
    }),
    ("full payload like frontend", {
        'asset_code': '60-0-00-006', 'name': 'Test 6', 'property': 'PROP-001',
        'department': 'Logistics', 'quantity': 1, 'status': 'active', 'condition': 'good',
        'location': None, 'description': None, 'serial_number': None,
        'amc_enabled': False, 'amc_start_date': None, 'amc_end_date': None,
        'purchase_date': None, 'expiry_date': None, 'po_number': None,
        'item_type_name': 'light vehicle',
    }),
]

for label, payload in tests:
    status, result = api_post('/assets/', payload, token)
    print(f'[{status}] {label}: {result.get("message")}', end='')
    if result.get('errors'):
        print(f' | Errors: {json.dumps(result["errors"])}')
    elif result.get('success'):
        aid = result['data']['id']
        code = result['data']['asset_code']
        print(f' | Created: {code}')
        api_delete(f'/assets/{aid}/', token)
        print(f'  Deleted: {aid}')
    else:
        print()
