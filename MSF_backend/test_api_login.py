import urllib.request
import urllib.parse
import json

url = "http://localhost:8000/api/auth/login/"
data = {
    "email": "tsegaye@msf.com",
    "password": "admin12345"
}

print(f"Testing API endpoint: {url}")
print(f"Request data: {data}")
print()

try:
    json_data = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=json_data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as response:
        status_code = response.getcode()
        response_data = response.read().decode('utf-8')
        print(f"Status Code: {status_code}")
        print(f"Response Body: {json.dumps(json.loads(response_data), indent=2)}")
except Exception as e:
    print(f"Error: {e}")
