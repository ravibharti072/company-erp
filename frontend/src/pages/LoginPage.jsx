import { useState } from "react";
import { Building2, Lock, Mail, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import api, { clearAuthStorage, setApiAuthToken } from "../api/api";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, logout } = useAuth();

  const [formData, setFormData] = useState({
    email: "companyadmin@aerostatelab.com",
    password: "admin123",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateField = (event) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setError("");
  };

  const getErrorMessage = (err) => {
    const detail = err?.response?.data?.detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      return detail
        .map((item) => item?.msg || item?.message || "Validation error")
        .join(", ");
    }

    if (err?.response?.data?.message) {
      return err.response.data.message;
    }

    if (err?.message) {
      return err.message;
    }

    return "Login failed";
  };

  const extractToken = (data) => {
    return (
      data?.access_token ||
      data?.token ||
      data?.jwt ||
      data?.data?.access_token ||
      data?.data?.token ||
      null
    );
  };

  const extractUser = (data) => {
    const user =
      data?.user ||
      data?.current_user ||
      data?.data?.user ||
      data?.data?.current_user ||
      data?.data ||
      null;

    if (user && typeof user === "object" && !Array.isArray(user)) {
      return user;
    }

    return null;
  };

  const loginWithFormToken = async () => {
    const formBody = new URLSearchParams();
    formBody.append("username", formData.email.trim());
    formBody.append("password", formData.password);

    const response = await api.post("/token", formBody, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    return response.data;
  };

  const loginWithJson = async () => {
    const endpointOptions = ["/auth/login", "/login"];
    const payloadOptions = [
      {
        email: formData.email.trim(),
        password: formData.password,
      },
      {
        username: formData.email.trim(),
        password: formData.password,
      },
    ];

    let lastError = null;

    for (const endpoint of endpointOptions) {
      for (const payload of payloadOptions) {
        try {
          const response = await api.post(endpoint, payload);
          return response.data;
        } catch (err) {
          lastError = err;

          const status = err?.response?.status;

          if (status && ![404, 405, 422].includes(status)) {
            throw err;
          }
        }
      }
    }

    throw lastError || new Error("Login endpoint not found");
  };

  const fetchCurrentUser = async () => {
    const endpointOptions = [
      "/auth/me",
      "/users/me",
      "/me",
      "/auth/current-user",
      "/current-user",
    ];

    let lastError = null;

    for (const endpoint of endpointOptions) {
      try {
        const response = await api.get(endpoint);
        const data = response.data;

        return (
          data?.user ||
          data?.current_user ||
          data?.data?.user ||
          data?.data?.current_user ||
          data?.data ||
          data
        );
      } catch (err) {
        lastError = err;

        const status = err?.response?.status;

        if (status && ![404, 405].includes(status)) {
          throw err;
        }
      }
    }

    throw lastError || new Error("Unable to load logged-in user");
  };

  const createFallbackUser = () => {
    return {
      email: formData.email.trim(),
      full_name: "Company Admin",
      name: "Company Admin",
      role: "company-admin",
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");

      logout?.();
      clearAuthStorage();

      let loginData = null;
      let loginError = null;

      try {
        loginData = await loginWithFormToken();
      } catch (err) {
        loginError = err;
      }

      if (!loginData) {
        try {
          loginData = await loginWithJson();
        } catch (err) {
          loginError = err;
        }
      }

      if (!loginData) {
        throw loginError || new Error("Login failed");
      }

      const token = extractToken(loginData);

      if (!token) {
        throw new Error("Login response does not contain access token");
      }

      setApiAuthToken(token);

      let loggedInUser = extractUser(loginData);

      if (!loggedInUser || !loggedInUser.role) {
        try {
          loggedInUser = await fetchCurrentUser();
        } catch (err) {
          loggedInUser = createFallbackUser();
        }
      }

      const saved = login(token, loggedInUser);

      if (!saved) {
        throw new Error("Unable to save login session");
      }

      navigate("/dashboard", { replace: true });
    } catch (err) {
      logout?.();
      clearAuthStorage();
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{loginStyles}</style>

      <div className="auth-page">
        <div className="auth-background-shape shape-one" />
        <div className="auth-background-shape shape-two" />

        <div className="auth-shell">
          <section className="auth-brand-panel">
            <div className="brand-logo-box">
              <img src="/logo.png" alt="AeroState ERP" />
            </div>

            <div>
              <span className="brand-badge">AeroState ERP</span>

              <h1>Company Management ERP</h1>

              <p>
                Login to manage users, onboarding, attendance, tasks, sales,
                projects, freelancers, reports, and internal company operations.
              </p>
            </div>

            <div className="brand-feature-list">
              <div className="brand-feature">
                <ShieldCheck size={18} />
                <span>Secure company access</span>
              </div>

              <div className="brand-feature">
                <Building2 size={18} />
                <span>Centralized internal operations</span>
              </div>
            </div>
          </section>

          <form className="auth-card" onSubmit={handleSubmit}>
            <div className="auth-card-header">
              <div className="auth-icon">
                <Lock size={22} />
              </div>

              <div>
                <h2>Company Login</h2>
                <p>Enter your company credentials to continue.</p>
              </div>
            </div>

            {error && <div className="error-box">{error}</div>}

            <div className="auth-form-group">
              <label>Email</label>

              <div className="auth-input-wrap">
                <Mail size={17} />
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={updateField}
                  placeholder="companyadmin@aerostatelab.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="auth-form-group">
              <label>Password</label>

              <div className="auth-input-wrap">
                <Lock size={17} />
                <input
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={updateField}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>

            <p className="auth-help-text">
              Use your company admin or employee account to access this portal.
            </p>
          </form>
        </div>
      </div>
    </>
  );
}

const loginStyles = `
@import url("https://fonts.googleapis.com/css2?family=Stack+Sans+Text:wght@300;400;500;600;700;800;900&display=swap");

.auth-page {
  width: 100%;
  min-height: 100vh;
  background:
    radial-gradient(circle at 18% 18%, rgba(37, 99, 235, 0.13), transparent 28%),
    radial-gradient(circle at 88% 74%, rgba(20, 184, 166, 0.16), transparent 32%),
    linear-gradient(135deg, #eef3f8 0%, #f8fbff 48%, #ecfdf5 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px;
  position: relative;
  overflow: hidden;
  font-family: "Stack Sans Text", system-ui, sans-serif;
}

.auth-background-shape {
  position: absolute;
  border-radius: 999px;
  filter: blur(2px);
  opacity: 0.7;
  pointer-events: none;
}

.shape-one {
  width: 260px;
  height: 260px;
  left: -80px;
  top: -80px;
  background: rgba(37, 99, 235, 0.12);
}

.shape-two {
  width: 320px;
  height: 320px;
  right: -120px;
  bottom: -130px;
  background: rgba(20, 184, 166, 0.15);
}

.auth-shell {
  width: min(1040px, 100%);
  min-height: 600px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid #dbe5f2;
  box-shadow: 0 26px 70px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(18px);
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) 430px;
  overflow: hidden;
  position: relative;
  z-index: 1;
}

.auth-brand-panel {
  padding: 44px;
  background:
    radial-gradient(circle at right top, rgba(20, 184, 166, 0.18), transparent 30%),
    linear-gradient(135deg, #eff6ff 0%, #f8fbff 55%, #ecfdf5 100%);
  border-right: 1px solid #dbe5f2;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 26px;
}

.brand-logo-box {
  width: 74px;
  height: 74px;
  border-radius: 24px;
  background: #ffffff;
  border: 1px solid #bfdbfe;
  overflow: hidden;
  box-shadow:
    0 18px 32px rgba(37, 99, 235, 0.16),
    0 0 0 7px rgba(239, 246, 255, 0.9);
}

.brand-logo-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.brand-badge {
  width: fit-content;
  padding: 7px 12px;
  border-radius: 999px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  margin-bottom: 14px;
}

.auth-brand-panel h1 {
  margin: 0;
  max-width: 500px;
  color: #06142b;
  font-size: 42px;
  line-height: 1.05;
  letter-spacing: -0.06em;
  font-weight: 800;
}

.auth-brand-panel p {
  margin: 16px 0 0;
  max-width: 520px;
  color: #334155;
  font-size: 15px;
  line-height: 1.6;
  font-weight: 500;
}

.brand-feature-list {
  display: grid;
  gap: 12px;
  max-width: 420px;
}

.brand-feature {
  min-height: 46px;
  padding: 0 14px;
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid #dbeafe;
  color: #0f172a;
  display: flex;
  align-items: center;
  gap: 11px;
  font-size: 13px;
  font-weight: 700;
}

.brand-feature svg {
  color: #2563eb;
}

.auth-card {
  padding: 44px 38px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.auth-card-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 26px;
}

.auth-icon {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  color: #2563eb;
  background: #eef6ff;
  border: 1px solid #dbeafe;
  flex-shrink: 0;
}

.auth-card h2 {
  margin: 0;
  color: #06142b;
  font-size: 28px;
  line-height: 1.1;
  font-weight: 800;
}

.auth-card p {
  margin: 7px 0 0;
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
}

.error-box {
  width: 100%;
  padding: 12px 14px;
  margin-bottom: 16px;
  border-radius: 14px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  font-size: 13px;
  font-weight: 700;
}

.auth-form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 15px;
}

.auth-form-group label {
  color: #334155;
  font-size: 12px;
  font-weight: 700;
}

.auth-input-wrap {
  width: 100%;
  min-height: 46px;
  padding: 0 13px;
  border-radius: 15px;
  border: 1px solid #dbe5f2;
  background: #ffffff;
  display: flex;
  align-items: center;
  gap: 10px;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}

.auth-input-wrap:focus-within {
  border-color: #bfdbfe;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
}

.auth-input-wrap svg {
  color: #64748b;
  flex-shrink: 0;
}

.auth-input-wrap input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: #0f172a;
  font-size: 14px;
  font-family: inherit;
  font-weight: 500;
}

.auth-input-wrap input::placeholder {
  color: #94a3b8;
}

.login-button {
  width: 100%;
  height: 46px;
  margin-top: 8px;
  border: none;
  border-radius: 15px;
  background: #2563eb;
  color: #ffffff;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 14px 26px rgba(37, 99, 235, 0.22);
  transition: 0.16s ease;
}

.login-button:hover {
  background: #1d4ed8;
  transform: translateY(-1px);
}

.login-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.auth-help-text {
  margin-top: 18px !important;
  text-align: center;
  color: #64748b !important;
  font-size: 12px !important;
}

@media (max-width: 980px) {
  .auth-shell {
    grid-template-columns: 1fr;
  }

  .auth-brand-panel {
    padding: 34px;
    border-right: none;
    border-bottom: 1px solid #dbe5f2;
  }

  .auth-brand-panel h1 {
    font-size: 34px;
  }

  .auth-card {
    padding: 34px;
  }
}

@media (max-width: 560px) {
  .auth-page {
    padding: 14px;
    align-items: flex-start;
  }

  .auth-shell {
    border-radius: 22px;
  }

  .auth-brand-panel {
    padding: 24px;
  }

  .brand-logo-box {
    width: 60px;
    height: 60px;
    border-radius: 20px;
  }

  .auth-brand-panel h1 {
    font-size: 29px;
  }

  .auth-brand-panel p {
    font-size: 13px;
  }

  .auth-card {
    padding: 24px;
  }

  .auth-card-header {
    align-items: flex-start;
  }

  .auth-card h2 {
    font-size: 24px;
  }
}
`;