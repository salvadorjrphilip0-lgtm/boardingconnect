// Quick test helper to POST an admin registration to the local API
// Usage: node scripts/test-register-admin.js

const API = process.env.API_URL || "http://localhost:5000/api";

async function test() {
  const payload = {
    fullName: "Test Administrator",
    email: `admin_test_${Date.now()}@example.com`,
    phone: "+63 900 000 0000",
    password: "password123",
    role: "admin",
  };

  try {
    const res = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Response:", data);
  } catch (err) {
    console.error("Request failed:", err);
  }
}

test();
