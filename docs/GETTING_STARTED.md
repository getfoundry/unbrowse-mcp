# 🚀 Getting Started - Quick Guide

**5-minute guide to get up and running with the Reverse Engineer API**

---

## Prerequisites

1. Server running: `pnpm dev`
2. PostgreSQL database connected
3. API available at: `http://localhost:4111`

---

## Step 1: Register a New Account

```bash
curl -X POST http://localhost:4111/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@email.com",
    "password": "YourPassword123!",
    "name": "Your Name"
  }'
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIuLi4iLCJlbWFpbCI6InlvdXJAZW1haWwuY29tIiwibmFtZSI6IllvdXIgTmFtZSIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxNzAwNjA0ODAwLCJpc3MiOiJyZXZlcnNlLWVuZ2luZWVyLWFwaSJ9.signature",
  "user": {
    "id": "abc-123-def",
    "email": "your@email.com",
    "name": "Your Name"
  }
}
```

✅ **Save the `token` value - you'll need it for all requests!**

---

## Step 2: Test Authentication

```bash
# Replace YOUR_TOKEN with the token from Step 1
curl http://localhost:4111/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "authenticated": true,
  "user": {
    "id": "abc-123-def",
    "email": "your@email.com",
    "name": "Your Name"
  }
}
```

✅ If you see your user data, authentication is working!

---

## Step 3: Login (Existing Users)

If you already have an account:

```bash
curl -X POST http://localhost:4111/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@email.com",
    "password": "YourPassword123!"
  }'
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "abc-123-def",
    "email": "your@email.com",
    "name": "Your Name"
  }
}
```

---

## Complete Example: JavaScript/Node.js

```javascript
// register-and-login.js
const API_URL = 'http://localhost:4111';

async function registerUser() {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'user@example.com',
      password: 'SecurePass123!',
      name: 'Test User'
    })
  });

  const data = await response.json();
  console.log('Registration:', data);
  return data.token;
}

async function loginUser() {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'user@example.com',
      password: 'SecurePass123!'
    })
  });

  const data = await response.json();
  console.log('Login:', data);
  return data.token;
}

async function getMe(token) {
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const data = await response.json();
  console.log('User data:', data);
  return data;
}

// Run the flow
async function main() {
  try {
    // Register new user
    const token = await registerUser();

    // Get user data with token
    await getMe(token);

    // Login with existing user
    const loginToken = await loginUser();

    // Verify login token works
    await getMe(loginToken);

    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
```

Run it:
```bash
node register-and-login.js
```

---

## Complete Example: Python

```python
# register_and_login.py
import requests

API_URL = 'http://localhost:4111'

def register_user():
    response = requests.post(
        f'{API_URL}/auth/register',
        json={
            'email': 'user@example.com',
            'password': 'SecurePass123!',
            'name': 'Test User'
        }
    )
    data = response.json()
    print('Registration:', data)
    return data['token']

def login_user():
    response = requests.post(
        f'{API_URL}/auth/login',
        json={
            'email': 'user@example.com',
            'password': 'SecurePass123!'
        }
    )
    data = response.json()
    print('Login:', data)
    return data['token']

def get_me(token):
    response = requests.get(
        f'{API_URL}/auth/me',
        headers={'Authorization': f'Bearer {token}'}
    )
    data = response.json()
    print('User data:', data)
    return data

# Run the flow
if __name__ == '__main__':
    try:
        # Register new user
        token = register_user()

        # Get user data with token
        get_me(token)

        # Login with existing user
        login_token = login_user()

        # Verify login token works
        get_me(login_token)

        print('✅ All tests passed!')
    except Exception as e:
        print(f'❌ Error: {e}')
```

Run it:
```bash
python register_and_login.py
```

---

## Complete Example: React/Frontend

```typescript
// useAuth.ts
import { useState, useEffect } from 'react';

const API_URL = 'http://localhost:4111';

interface User {
  id: string;
  email: string;
  name: string;
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('jwt_token')
  );
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  // Verify token on mount
  useEffect(() => {
    if (token) {
      verifyToken();
    }
  }, [token]);

  const register = async (email: string, password: string, name: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('jwt_token', data.token);
        setToken(data.token);
        setUser(data.user);
      }

      return data;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('jwt_token', data.token);
        setToken(data.token);
        setUser(data.user);
      }

      return data;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('jwt_token');
    setToken(null);
    setUser(null);
  };

  const verifyToken = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (data.success) {
        setUser(data.user);
      } else {
        // Token invalid, clear it
        logout();
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      logout();
    }
  };

  return {
    token,
    user,
    loading,
    register,
    login,
    logout,
    isAuthenticated: !!token && !!user
  };
}
```

**Usage in a component:**

```tsx
// LoginPage.tsx
import { useAuth } from './useAuth';

export function LoginPage() {
  const { register, login, user, isAuthenticated } = useAuth();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;

    const result = await register(
      form.email.value,
      form.password.value,
      form.name.value
    );

    if (result.success) {
      console.log('Registered!', result.user);
    } else {
      console.error('Registration failed:', result.error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;

    const result = await login(
      form.email.value,
      form.password.value
    );

    if (result.success) {
      console.log('Logged in!', result.user);
    } else {
      console.error('Login failed:', result.error);
    }
  };

  if (isAuthenticated) {
    return <div>Welcome, {user?.name}!</div>;
  }

  return (
    <div>
      <form onSubmit={handleRegister}>
        <h2>Register</h2>
        <input type="email" name="email" placeholder="Email" required />
        <input type="password" name="password" placeholder="Password" required />
        <input type="text" name="name" placeholder="Name" required />
        <button type="submit">Register</button>
      </form>

      <form onSubmit={handleLogin}>
        <h2>Login</h2>
        <input type="email" name="email" placeholder="Email" required />
        <input type="password" name="password" placeholder="Password" required />
        <button type="submit">Login</button>
      </form>
    </div>
  );
}
```

---

## Common Issues

### 1. "Connection Refused"
**Problem:** Server not running

**Solution:**
```bash
pnpm dev
```

### 2. "401 Unauthorized"
**Problem:** Token missing or invalid

**Solution:**
- Check you're including `Authorization: Bearer YOUR_TOKEN` header
- Token may have expired (7 days), login again to get new token

### 3. "500 Internal Server Error on duplicate email"
**Problem:** Email already registered

**Solution:**
- Use `/auth/login` instead
- Or register with a different email

### 4. "Weak password rejected"
**Problem:** Password less than 8 characters

**Solution:**
- Use password with at least 8 characters

---

## Next Steps

Once you have authentication working:

1. **See [API_COMPLETE_GUIDE.md](./API_COMPLETE_GUIDE.md)** for all endpoints
2. **See [AUTHENTICATION.md](./AUTHENTICATION.md)** for advanced auth patterns
3. **See [TEST_SUITE_GUIDE.md](./TEST_SUITE_GUIDE.md)** for testing examples

---

## Quick Reference Card

```bash
# Register
POST /auth/register
Body: { "email": "...", "password": "...", "name": "..." }
Returns: { "success": true, "token": "...", "user": {...} }

# Login
POST /auth/login
Body: { "email": "...", "password": "..." }
Returns: { "success": true, "token": "...", "user": {...} }

# Get User
GET /auth/me
Headers: { "Authorization": "Bearer YOUR_TOKEN" }
Returns: { "success": true, "authenticated": true, "user": {...} }

# Protected Endpoints
All other endpoints require:
Headers: { "Authorization": "Bearer YOUR_TOKEN" }
```

---

## Testing It Works

Run this simple test:

```bash
# 1. Register
TOKEN=$(curl -s -X POST http://localhost:4111/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!","name":"Test"}' \
  | jq -r '.token')

# 2. Verify token works
curl http://localhost:4111/auth/me \
  -H "Authorization: Bearer $TOKEN"

# If you see your user data, it works! ✅
```

---

**Ready to build! 🚀**
