// Simple test for Django login
async function testLogin() {
  console.log('Testing login...');
  try {
    const response = await fetch('http://127.0.0.1:8000/api/auth/login/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@demo.com',
        password: 'demo123',
      }),
    });

    const data = await response.json();
    console.log('Login response:', data);
    return data;
  } catch (error) {
    console.error('Login failed:', error);
  }
}

testLogin();
