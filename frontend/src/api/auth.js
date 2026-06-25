// api/auth.js
const BASE_URL = import.meta.env.VITE_BASE_URL || "/kpi";

export async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) throw new Error("Invalid credentials");

  return res.json(); // { token, email, role, name }
}

export function logout() {

  sessionStorage.removeItem("kpi_token");
  sessionStorage.removeItem("kpi_user");

  window.location.href = "/kpi/login";
}

export function isAuthenticated() {

  return !!sessionStorage.getItem("kpi_token");
}