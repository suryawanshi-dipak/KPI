import { useState } from "react";
import { T, s } from "../utils/theme";
import { Input, FormGroup } from "../components/common/FormControls";
import Btn from "../components/common/Btn";
import { login } from "../api/auth";
import { useNavigate } from "react-router-dom";

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Call the login API helper with user credentials
      const data = await login(email, password);
      
      // Store the JWT token and user details in sessionStorage.
      // kpi_token is read by store.js and auth.js to authenticate all API requests.
      sessionStorage.setItem("kpi_token", data.token);
      sessionStorage.setItem(
        "kpi_user",
        JSON.stringify({
          email: data.email,
          role: data.role,
          name: data.name,
          employeeId: data.employeeId,
        })
      );
      
      // Call onLogin callback if provided by the parent component
      onLogin?.({
        email: data.email,
        role: data.role,
        name: data.name,
        employeeId: data.employeeId,
      });
      
      // Navigate to the main dashboard page upon successful authentication
      navigate("/");
    } catch (err) {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          background: T.card,
          borderRadius: 12,
          boxShadow: "0 4px 24px rgba(0,0,0,.10)",
          padding: "44px 40px 36px",
          width: "100%",
          maxWidth: 400,
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              borderRadius: 12,
              background: T.navy,
              marginBottom: 16,
            }}
          >
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 20, letterSpacing: -0.5 }}>
              KPI 
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.text }}>
            Welcome back
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: T.textMuted }}>
            Sign in to your KPI dashboard
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <FormGroup label="Email">
            <Input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </FormGroup>

          <FormGroup label="Password">
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </FormGroup>

          {error && (
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 13,
                color: T.danger,
                background: "#fff5f5",
                border: `1px solid #ffc9c9`,
                borderRadius: 6,
                padding: "8px 12px",
              }}
            >
              {error}
            </p>
          )}

          <Btn
            type="submit"
            variant="primary"
            disabled={loading}
            style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </Btn>
        </form>
      </div>
    </div>
  );
}
