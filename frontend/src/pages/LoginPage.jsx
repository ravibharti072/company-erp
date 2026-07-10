import { useEffect, useState } from "react";
import {
  Building2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import api, {
  clearAuthStorage,
  setApiAuthToken,
} from "../api/api";
import { useAuth } from "../context/AuthContext";

const REMEMBERED_EMAIL_KEY =
  "company_erp_remembered_email";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, logout } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [rememberEmail, setRememberEmail] =
    useState(false);

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const savedEmail = localStorage.getItem(
      REMEMBERED_EMAIL_KEY
    );

    if (!savedEmail) return;

    setFormData((previous) => ({
      ...previous,
      email: savedEmail,
    }));

    setRememberEmail(true);
  }, []);

  const updateField = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
  };

  const getErrorMessage = (err) => {
    const detail =
      err?.response?.data?.detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      return detail
        .map(
          (item) =>
            item?.msg ||
            item?.message ||
            "Validation error"
        )
        .join(", ");
    }

    if (err?.response?.data?.message) {
      return err.response.data.message;
    }

    if (err?.message) {
      return err.message;
    }

    return "Login failed. Please check your email and password.";
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
    const currentUser =
      data?.user ||
      data?.current_user ||
      data?.data?.user ||
      data?.data?.current_user ||
      null;

    if (
      currentUser &&
      typeof currentUser === "object" &&
      !Array.isArray(currentUser)
    ) {
      return currentUser;
    }

    return null;
  };

  const loginWithFormToken = async () => {
    const formBody =
      new URLSearchParams();

    formBody.append(
      "username",
      formData.email.trim()
    );

    formBody.append(
      "password",
      formData.password
    );

    const response = await api.post(
      "/token",
      formBody,
      {
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
      }
    );

    return response.data;
  };

  const loginWithJson = async () => {
    const endpointOptions = [
      "/auth/login",
      "/login",
    ];

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
          const response = await api.post(
            endpoint,
            payload
          );

          return response.data;
        } catch (err) {
          lastError = err;

          const status =
            err?.response?.status;

          if (
            status &&
            ![404, 405, 422].includes(
              status
            )
          ) {
            throw err;
          }
        }
      }
    }

    throw (
      lastError ||
      new Error(
        "Login endpoint not found"
      )
    );
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
        const response =
          await api.get(endpoint);

        const data = response.data;

        const currentUser =
          data?.user ||
          data?.current_user ||
          data?.data?.user ||
          data?.data?.current_user ||
          data?.data ||
          data;

        if (
          currentUser &&
          typeof currentUser === "object" &&
          !Array.isArray(currentUser)
        ) {
          return currentUser;
        }
      } catch (err) {
        lastError = err;

        const status =
          err?.response?.status;

        if (
          status &&
          ![404, 405].includes(status)
        ) {
          throw err;
        }
      }
    }

    throw (
      lastError ||
      new Error(
        "Unable to load logged-in user details"
      )
    );
  };

  const saveRememberedEmail = () => {
    const email =
      formData.email.trim();

    if (rememberEmail && email) {
      localStorage.setItem(
        REMEMBERED_EMAIL_KEY,
        email
      );

      return;
    }

    localStorage.removeItem(
      REMEMBERED_EMAIL_KEY
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const email =
      formData.email.trim();

    if (!email) {
      setError(
        "Please enter your email address."
      );

      return;
    }

    if (!formData.password) {
      setError(
        "Please enter your password."
      );

      return;
    }

    try {
      setLoading(true);
      setError("");

      logout?.();
      clearAuthStorage();

      let loginData = null;
      let loginError = null;

      try {
        loginData =
          await loginWithFormToken();
      } catch (err) {
        loginError = err;
      }

      if (!loginData) {
        try {
          loginData =
            await loginWithJson();
        } catch (err) {
          loginError = err;
        }
      }

      if (!loginData) {
        throw (
          loginError ||
          new Error("Login failed")
        );
      }

      const token =
        extractToken(loginData);

      if (!token) {
        throw new Error(
          "Login response does not contain an access token"
        );
      }

      setApiAuthToken(token);

      let loggedInUser =
        extractUser(loginData);

      if (
        !loggedInUser ||
        !loggedInUser.role
      ) {
        loggedInUser =
          await fetchCurrentUser();
      }

      if (!loggedInUser) {
        throw new Error(
          "Unable to load user account details"
        );
      }

      const sessionSaved = login(
        token,
        loggedInUser
      );

      if (!sessionSaved) {
        throw new Error(
          "Unable to save login session"
        );
      }

      saveRememberedEmail();

      navigate("/dashboard", {
        replace: true,
      });
    } catch (err) {
      logout?.();
      clearAuthStorage();

      setFormData((previous) => ({
        ...previous,
        password: "",
      }));

      setShowPassword(false);
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
              <img
                src="/logo.png"
                alt="AeroState Company ERP"
              />
            </div>

            <div>
              <span className="brand-badge">
                AeroState
              </span>

              <h1>Company ERP</h1>

              <p>
                Manage users, onboarding,
                attendance, tasks, sales,
                payments, projects, reports and
                internal company operations from
                one secure portal.
              </p>
            </div>

            <div className="brand-feature-list">
              <div className="brand-feature">
                <ShieldCheck size={18} />

                <span>
                  Secure company access
                </span>
              </div>

              <div className="brand-feature">
                <Building2 size={18} />

                <span>
                  Centralized internal operations
                </span>
              </div>
            </div>
          </section>

          <form
            className="auth-card"
            onSubmit={handleSubmit}
            autoComplete="off"
          >
            <div className="hidden-autofill-fields">
              <input
                type="text"
                name="fake-email"
                autoComplete="off"
                tabIndex={-1}
                aria-hidden="true"
              />

              <input
                type="password"
                name="fake-password"
                autoComplete="new-password"
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>

            <div className="auth-card-header">
              <div className="auth-icon">
                <Lock size={22} />
              </div>

              <div>
                <h2>Company Login</h2>

                <p>
                  Enter your company credentials
                  to continue.
                </p>
              </div>
            </div>

            {error && (
              <div
                className="error-box"
                role="alert"
              >
                {error}
              </div>
            )}

            <div className="auth-form-group">
              <label htmlFor="company-login-email">
                Email
              </label>

              <div className="auth-input-wrap">
                <Mail size={17} />

                <input
                  id="company-login-email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={updateField}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck="false"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="auth-form-group">
              <label htmlFor="company-login-password">
                Password
              </label>

              <div className="auth-input-wrap">
                <Lock size={17} />

                <input
                  id="company-login-password"
                  name="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={formData.password}
                  onChange={updateField}
                  autoComplete="new-password"
                  disabled={loading}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(
                      (previous) =>
                        !previous
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  title={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>
              </div>
            </div>

            <div className="login-options-row">
              <label className="remember-email-option">
                <input
                  type="checkbox"
                  checked={rememberEmail}
                  onChange={(event) =>
                    setRememberEmail(
                      event.target.checked
                    )
                  }
                  disabled={loading}
                />

                <span>
                  Remember my email
                </span>
              </label>

              <span className="password-manager-text">
                Password is not stored by ERP
              </span>
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >
              {loading
                ? "Logging in..."
                : "Login"}
            </button>

            <p className="auth-help-text">
              Use your company admin or employee
              account to access this portal.
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
    radial-gradient(
      circle at 18% 18%,
      rgba(37, 99, 235, 0.13),
      transparent 28%
    ),
    radial-gradient(
      circle at 88% 74%,
      rgba(20, 184, 166, 0.16),
      transparent 32%
    ),
    linear-gradient(
      135deg,
      #eef3f8 0%,
      #f8fbff 48%,
      #ecfdf5 100%
    );
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px;
  position: relative;
  overflow: hidden;
  font-family:
    "Stack Sans Text",
    system-ui,
    sans-serif;
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
  background: #ffffff;
  border: 1px solid #dbe5f2;
  box-shadow:
    0 26px 70px rgba(15, 23, 42, 0.12);
  display: grid;
  grid-template-columns:
    minmax(0, 1.05fr)
    430px;
  overflow: hidden;
  position: relative;
  z-index: 1;
}

.auth-brand-panel {
  padding: 44px;
  background:
    radial-gradient(
      circle at right top,
      rgba(20, 184, 166, 0.13),
      transparent 30%
    ),
    linear-gradient(
      135deg,
      #eff6ff 0%,
      #f8fbff 55%,
      #f0fdfa 100%
    );
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
  margin-bottom: 14px;
  border-radius: 999px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
}

.auth-brand-panel h1 {
  max-width: 500px;
  margin: 0;
  color: #06142b;
  font-size: 42px;
  line-height: 1.05;
  letter-spacing: -0.06em;
  font-weight: 800;
}

.auth-brand-panel p {
  max-width: 520px;
  margin: 16px 0 0;
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
  background: #ffffff;
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
  position: relative;
}

.hidden-autofill-fields {
  position: fixed;
  width: 1px;
  height: 1px;
  left: -10000px;
  top: -10000px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
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
  min-height: 48px;
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
  background: #ffffff;
  border-color: #93c5fd;
  box-shadow:
    0 0 0 4px rgba(37, 99, 235, 0.1);
}

.auth-input-wrap > svg {
  color: #64748b;
  flex-shrink: 0;
}

.auth-input-wrap input {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 0;
  border: none;
  outline: none;
  background: #ffffff;
  color: #0f172a;
  caret-color: #2563eb;
  font-size: 14px;
  font-family: inherit;
  font-weight: 500;
}

.auth-input-wrap input:focus {
  background: #ffffff;
}

.auth-input-wrap input:-webkit-autofill,
.auth-input-wrap input:-webkit-autofill:hover,
.auth-input-wrap input:-webkit-autofill:focus,
.auth-input-wrap input:-webkit-autofill:active {
  -webkit-box-shadow:
    0 0 0 1000px #ffffff inset !important;
  -webkit-text-fill-color:
    #0f172a !important;
  caret-color: #2563eb;
  background-color:
    #ffffff !important;
  transition:
    background-color 9999s ease-in-out 0s;
}

.password-toggle {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 9px;
  background: #ffffff;
  color: #64748b;
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
}

.password-toggle:hover {
  background: #f8fafc;
  color: #2563eb;
}

.password-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.login-options-row {
  min-height: 28px;
  margin-top: -2px;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.remember-email-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #334155;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.remember-email-option input {
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: #2563eb;
  cursor: pointer;
}

.remember-email-option input:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.password-manager-text {
  color: #94a3b8;
  font-size: 10px;
  line-height: 1.35;
  text-align: right;
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
  box-shadow:
    0 14px 26px rgba(37, 99, 235, 0.22);
  transition:
    background 0.16s ease,
    transform 0.16s ease;
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

  .login-options-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 7px;
  }

  .password-manager-text {
    text-align: left;
  }
}
`;