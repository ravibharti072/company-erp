import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Edit3,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Save,
  ShieldCheck,
  UserCircle,
  UserRound,
  UsersRound,
  X,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import api from "../api/api";
import { useAuth } from "../context/AuthContext";

const ADMIN_ROLES = ["company-admin", "admin", "owner", "manager"];

const formatLabel = (value) => {
  if (!value) return "-";

  return String(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const normalizeRole = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replaceAll(" ", "-");
};

const getUserName = (user) => {
  return (
    user?.full_name ||
    user?.person?.full_name ||
    user?.name ||
    user?.username ||
    "User"
  );
};

const getUserEmail = (user) => {
  return user?.email || user?.person?.email || "";
};

const getUserDepartment = (user) => {
  return (
    user?.department ||
    user?.person?.department ||
    user?.department_name ||
    ""
  );
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();

  const [profileForm, setProfileForm] = useState({
    full_name: "",
    email: "",
    department: "",
  });

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");

  const [formData, setFormData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const userRole = normalizeRole(user?.role);
  const isAdminUser = ADMIN_ROLES.includes(userRole);

  const profileName = useMemo(() => getUserName(user), [user]);
  const profileEmail = useMemo(() => getUserEmail(user), [user]);
  const profileDepartment = useMemo(() => getUserDepartment(user), [user]);

  useEffect(() => {
    setProfileForm({
      full_name: profileName === "User" ? "" : profileName,
      email: profileEmail,
      department: profileDepartment,
    });
  }, [profileName, profileEmail, profileDepartment]);

  const accessText = useMemo(() => {
    if (userRole === "company-admin" || userRole === "admin" || userRole === "owner") {
      return "Full Company Access";
    }

    if (userRole === "manager") {
      return "Manager Access";
    }

    if (userRole === "sales-representative") {
      return "Sales Access";
    }

    if (userRole === "freelancer") {
      return "Freelancer Access";
    }

    return "User Access";
  }, [userRole]);

  const passwordStrength = useMemo(() => {
    const password = formData.new_password || "";

    if (!password) {
      return {
        label: "Not entered",
        className: "strength-empty",
        width: "0%",
      };
    }

    let score = 0;

    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 1) {
      return {
        label: "Weak",
        className: "strength-weak",
        width: "35%",
      };
    }

    if (score <= 3) {
      return {
        label: "Medium",
        className: "strength-medium",
        width: "68%",
      };
    }

    return {
      label: "Strong",
      className: "strength-strong",
      width: "100%",
    };
  }, [formData.new_password]);

  const getErrorMessage = (err, fallback = "Something went wrong. Please try again.") => {
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

    return fallback;
  };

  const handleProfileChange = (event) => {
    const { name, value } = event.target;

    setProfileForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setProfileMessage("");
    setProfileError("");
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setPasswordMessage("");
    setPasswordError("");
  };

  const cancelProfileEdit = () => {
    setProfileForm({
      full_name: profileName === "User" ? "" : profileName,
      email: profileEmail,
      department: profileDepartment,
    });

    setIsEditingProfile(false);
    setProfileMessage("");
    setProfileError("");
  };

  const updateProfileRequest = async (payload) => {
    const endpoints = [
      {
        method: "put",
        url: "/auth/profile",
      },
      {
        method: "put",
        url: "/users/me",
      },
      {
        method: "put",
        url: "/me",
      },
    ];

    if (user?.id) {
      endpoints.push({
        method: "put",
        url: `/users/${user.id}`,
      });
    }

    let lastError = null;

    for (const endpoint of endpoints) {
      try {
        const response = await api[endpoint.method](endpoint.url, payload);
        return response.data;
      } catch (err) {
        lastError = err;

        const status = err?.response?.status;

        if (status && ![404, 405, 422].includes(status)) {
          throw err;
        }
      }
    }

    throw lastError || new Error("Profile update endpoint not found");
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();

    if (!profileForm.full_name.trim()) {
      setProfileError("Name is required.");
      return;
    }

    if (!profileForm.email.trim()) {
      setProfileError("Email is required.");
      return;
    }

    try {
      setProfileLoading(true);
      setProfileMessage("");
      setProfileError("");

      const payload = {
        full_name: profileForm.full_name.trim(),
        name: profileForm.full_name.trim(),
        email: profileForm.email.trim(),
        department: profileForm.department.trim() || null,
      };

      const responseData = await updateProfileRequest(payload);

      const updatedUser =
        responseData?.user ||
        responseData?.data?.user ||
        responseData?.data ||
        responseData ||
        {};

      const mergedUser = {
        ...user,
        ...updatedUser,
        full_name:
          updatedUser.full_name ||
          updatedUser.name ||
          payload.full_name,
        name:
          updatedUser.name ||
          updatedUser.full_name ||
          payload.full_name,
        email: updatedUser.email || payload.email,
        department: updatedUser.department || payload.department,
        person: {
          ...(user?.person || {}),
          ...(updatedUser.person || {}),
          full_name:
            updatedUser.person?.full_name ||
            updatedUser.full_name ||
            payload.full_name,
          email:
            updatedUser.person?.email ||
            updatedUser.email ||
            payload.email,
          department:
            updatedUser.person?.department ||
            updatedUser.department ||
            payload.department,
        },
      };

      updateUser?.(mergedUser);

      setProfileMessage("Profile updated successfully.");
      setIsEditingProfile(false);
    } catch (err) {
      setProfileError(
        getErrorMessage(
          err,
          "Failed to update profile. Backend profile update endpoint may be missing."
        )
      );
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();

    if (!formData.current_password || !formData.new_password) {
      setPasswordError("Please enter current password and new password.");
      return;
    }

    if (formData.new_password.length < 6) {
      setPasswordError("New password should be at least 6 characters.");
      return;
    }

    if (formData.new_password !== formData.confirm_password) {
      setPasswordError("New password and confirm password do not match.");
      return;
    }

    try {
      setPasswordLoading(true);
      setPasswordError("");
      setPasswordMessage("");

      const payload = {
        current_password: formData.current_password,
        new_password: formData.new_password,
      };

      try {
        await api.put("/auth/change-password", payload);
      } catch (firstError) {
        await api.post("/auth/change-password", payload);
      }

      setPasswordMessage("Password changed successfully.");

      setFormData({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
    } catch (err) {
      setPasswordError(
        getErrorMessage(err, "Failed to change password. Please try again.")
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <>
      <style>{settingsPageStyles}</style>

      <div className="settings-page">
        <div className="page-header">
          <div className="page-title-wrap">
            <button
              type="button"
              className="back-button"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={18} />
            </button>

            <div className="page-title-icon">
              <ShieldCheck size={22} />
            </div>

            <div>
              <h1>Settings</h1>
              <p>
                Manage profile, password security, internal access, and current
                login session.
              </p>
            </div>
          </div>

          <div className="header-actions">
            <span className="account-pill">{formatLabel(user?.role)}</span>
          </div>
        </div>

        <section className="settings-summary-grid">
          <article className="summary-card summary-blue">
            <UserRound size={19} />
            <div>
              <p>Account</p>
              <strong>{profileName}</strong>
            </div>
          </article>

          <article className="summary-card summary-green">
            <Mail size={19} />
            <div>
              <p>Email</p>
              <strong>{profileEmail || "-"}</strong>
            </div>
          </article>

          <article className="summary-card summary-purple">
            <ShieldCheck size={19} />
            <div>
              <p>Access Level</p>
              <strong>{accessText}</strong>
            </div>
          </article>
        </section>

        <section className="internal-access-card">
          <div className="internal-access-left">
            <div className="internal-access-icon">
              <Building2 size={23} />
            </div>

            <div>
              <h2>Internal Company ERP</h2>
              <p>
                Company Admin is the top access level for this internal setup.
                You can manage people, software users, CRM, projects, reports,
                and company operations from one place.
              </p>
            </div>
          </div>

          {isAdminUser && (
            <div className="internal-action-row">
              <button
                type="button"
                className="quick-action-btn"
                onClick={() => navigate("/users")}
              >
                <UsersRound size={17} />
                Manage Users
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                className="quick-action-btn"
                onClick={() => navigate("/people-onboarding")}
              >
                <UserRound size={17} />
                People Onboarding
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </section>

        <div className="settings-grid">
          <section className="settings-card profile-card">
            <div className="settings-card-header">
              <div className="settings-title-row">
                <div className="settings-icon settings-icon-blue">
                  <UserCircle size={23} />
                </div>

                <div>
                  <h2>Profile Information</h2>
                  <p>Update your basic account information.</p>
                </div>
              </div>

              {!isEditingProfile ? (
                <button
                  type="button"
                  className="small-action-btn"
                  onClick={() => setIsEditingProfile(true)}
                >
                  <Edit3 size={15} />
                  Edit
                </button>
              ) : (
                <button
                  type="button"
                  className="small-action-btn danger-light"
                  onClick={cancelProfileEdit}
                >
                  <X size={15} />
                  Cancel
                </button>
              )}
            </div>

            {profileMessage && (
              <div className="success-box">
                <CheckCircle2 size={17} />
                <span>{profileMessage}</span>
              </div>
            )}

            {profileError && (
              <div className="error-box">
                <XCircle size={17} />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleProfileSubmit} className="settings-form equal-form">
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  name="full_name"
                  value={profileForm.full_name}
                  onChange={handleProfileChange}
                  placeholder="Enter name"
                  disabled={!isEditingProfile || profileLoading}
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={profileForm.email}
                  onChange={handleProfileChange}
                  placeholder="Enter email"
                  disabled={!isEditingProfile || profileLoading}
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <input type="text" value={formatLabel(user?.role)} disabled />
              </div>

              <div className="form-group">
                <label>Department</label>
                <input
                  type="text"
                  name="department"
                  value={profileForm.department}
                  onChange={handleProfileChange}
                  placeholder="Enter department"
                  disabled={!isEditingProfile || profileLoading}
                />
              </div>

              <div className="settings-note">
                <ShieldCheck size={17} />
                <p>
                  Role is locked for security. Company Admin can manage access
                  levels from Software Users.
                </p>
              </div>

              <button
                type="submit"
                disabled={!isEditingProfile || profileLoading}
                className="primary-btn profile-save-btn"
              >
                <Save size={18} />
                {profileLoading ? "Saving..." : "Save Profile"}
              </button>
            </form>
          </section>

          <section className="settings-card password-card">
            <div className="settings-card-header">
              <div className="settings-title-row">
                <div className="settings-icon settings-icon-purple">
                  <Lock size={23} />
                </div>

                <div>
                  <h2>Change Password</h2>
                  <p>Update your login password securely.</p>
                </div>
              </div>
            </div>

            {passwordMessage && (
              <div className="success-box">
                <CheckCircle2 size={17} />
                <span>{passwordMessage}</span>
              </div>
            )}

            {passwordError && (
              <div className="error-box">
                <XCircle size={17} />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="settings-form equal-form">
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  name="current_password"
                  value={formData.current_password}
                  onChange={handlePasswordChange}
                  placeholder="Enter current password"
                />
              </div>

              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  name="new_password"
                  value={formData.new_password}
                  onChange={handlePasswordChange}
                  placeholder="Enter new password"
                />

                <div className="password-strength">
                  <div className="strength-track">
                    <span
                      className={`strength-fill ${passwordStrength.className}`}
                      style={{ width: passwordStrength.width }}
                    />
                  </div>

                  <small>{passwordStrength.label}</small>
                </div>
              </div>

              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  name="confirm_password"
                  value={formData.confirm_password}
                  onChange={handlePasswordChange}
                  placeholder="Confirm new password"
                />
              </div>

              <div className="password-tip-box">
                <KeyRound size={17} />
                <p>
                  Use at least 8 characters with uppercase letters, numbers, and
                  symbols for stronger security.
                </p>
              </div>

              <button
                type="submit"
                disabled={passwordLoading}
                className="primary-btn password-save-btn"
              >
                <Save size={18} />
                {passwordLoading ? "Updating..." : "Change Password"}
              </button>
            </form>
          </section>
        </div>

        <section className="logout-settings-card">
          <div className="settings-card-header logout-header">
            <div className="settings-title-row">
              <div className="settings-icon settings-icon-red">
                <LogOut size={23} />
              </div>

              <div>
                <h2>Logout</h2>
                <p>Sign out from your current session.</p>
              </div>
            </div>
          </div>

          <div className="logout-info-box">
            <KeyRound size={18} />
            <p>
              Use logout when you are done working, especially on a shared
              computer.
            </p>
          </div>

          <button
            type="button"
            className="settings-logout-btn"
            onClick={handleLogout}
          >
            <LogOut size={18} />
            Logout
          </button>
        </section>
      </div>
    </>
  );
}

const settingsPageStyles = `
.settings-page {
  width: 100%;
  min-height: calc(100vh - 58px);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.page-header {
  min-height: 92px;
  padding: 20px 22px;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid var(--erp-border, #e2e8f0);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.05);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.page-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.back-button {
  width: 40px;
  height: 40px;
  border: 1px solid #dbeafe;
  background: #ffffff;
  color: #2563eb;
  border-radius: 13px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
  cursor: pointer;
}

.page-title-icon {
  width: 44px;
  height: 44px;
  border-radius: 15px;
  display: grid;
  place-items: center;
  color: #2563eb;
  background: #eef6ff;
  border: 1px solid #dbeafe;
  flex-shrink: 0;
}

.page-header h1 {
  margin: 0;
  color: #06142b;
  font-size: 27px;
  line-height: 1.1;
  font-weight: 800;
}

.page-header p {
  margin: 7px 0 0;
  color: #334155;
  font-size: 13px;
  font-weight: 500;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.account-pill {
  min-height: 38px;
  padding: 0 15px;
  border-radius: 999px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #2563eb;
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  font-weight: 900;
}

.settings-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.summary-card {
  min-height: 78px;
  padding: 15px 16px;
  border-radius: 18px;
  border: 1px solid var(--erp-border, #e2e8f0);
  background: #ffffff;
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.045);
  display: flex;
  align-items: center;
  gap: 13px;
  overflow: hidden;
}

.summary-card svg {
  width: 42px;
  height: 42px;
  padding: 11px;
  border-radius: 15px;
  flex-shrink: 0;
}

.summary-card p {
  margin: 0;
  color: #52677e;
  font-size: 12px;
  font-weight: 600;
}

.summary-card strong {
  display: block;
  max-width: 100%;
  margin-top: 4px;
  color: #06142b;
  font-size: 18px;
  font-weight: 800;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.summary-blue svg {
  color: #2563eb;
  background: #eff6ff;
}

.summary-green svg {
  color: #059669;
  background: #ecfdf5;
}

.summary-purple svg {
  color: #7c3aed;
  background: #f5f3ff;
}

.internal-access-card {
  min-height: 112px;
  padding: 18px;
  border-radius: 20px;
  border: 1px solid #bfdbfe;
  background:
    radial-gradient(circle at right center, rgba(20, 184, 166, 0.12), transparent 30%),
    linear-gradient(135deg, #eff6ff 0%, #ffffff 55%, #ecfdf5 100%);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.05);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.internal-access-left {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.internal-access-icon {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: #ffffff;
  border: 1px solid #bfdbfe;
  color: #2563eb;
  flex-shrink: 0;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.10);
}

.internal-access-card h2 {
  margin: 0;
  color: #06142b;
  font-size: 20px;
  font-weight: 800;
}

.internal-access-card p {
  margin: 7px 0 0;
  max-width: 760px;
  color: #334155;
  font-size: 13px;
  line-height: 1.5;
  font-weight: 500;
}

.internal-action-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.quick-action-btn {
  min-height: 42px;
  padding: 0 13px;
  border-radius: 14px;
  border: 1px solid #bfdbfe;
  background: #ffffff;
  color: #2563eb;
  font-size: 13px;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  white-space: nowrap;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: stretch;
}

.settings-card,
.logout-settings-card {
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid var(--erp-border, #e2e8f0);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.055);
  padding: 18px;
}

.profile-card,
.password-card {
  min-height: 520px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.logout-settings-card {
  min-height: 120px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.65fr) 170px;
  gap: 16px;
  align-items: center;
}

.settings-card-header {
  min-height: 61px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid #eef2f7;
}

.settings-title-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.logout-header {
  padding-bottom: 0;
  margin-bottom: 0;
  border-bottom: none;
}

.settings-icon {
  width: 44px;
  height: 44px;
  border-radius: 15px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.settings-icon-blue {
  color: #2563eb;
  background: #eff6ff;
}

.settings-icon-purple {
  color: #7c3aed;
  background: #f5f3ff;
}

.settings-icon-red {
  color: #dc2626;
  background: #fef2f2;
}

.settings-card h2,
.logout-settings-card h2 {
  margin: 0;
  color: #06142b;
  font-size: 21px;
  font-weight: 800;
}

.settings-card p,
.logout-settings-card p {
  margin: 6px 0 0;
  color: #52677e;
  font-size: 12px;
  line-height: 1.45;
  font-weight: 500;
}

.small-action-btn {
  min-height: 36px;
  padding: 0 12px;
  border-radius: 13px;
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #2563eb;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
  flex-shrink: 0;
}

.danger-light {
  border-color: #fecaca;
  background: #fef2f2;
  color: #dc2626;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.equal-form {
  flex: 1;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.form-group label {
  color: #334155;
  font-size: 12px;
  font-weight: 700;
}

.form-group input {
  width: 100%;
  min-height: 42px;
  border-radius: 13px;
  border: 1px solid #dbe5f2;
  background: #ffffff;
  color: #0f172a;
  padding: 9px 12px;
  font-size: 13px;
  outline: none;
  font-family: inherit;
}

.form-group input:focus {
  border-color: #bfdbfe;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.10);
}

.form-group input:disabled {
  background: #f8fafc;
  color: #64748b;
  cursor: not-allowed;
}

.settings-note,
.logout-info-box,
.success-box,
.error-box,
.password-tip-box {
  min-height: 46px;
  padding: 12px 13px;
  border-radius: 14px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.settings-note,
.password-tip-box {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #2563eb;
}

.logout-info-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #64748b;
}

.settings-note p,
.logout-info-box p,
.password-tip-box p {
  margin: 0;
  color: #334155;
  font-size: 12px;
  line-height: 1.5;
  font-weight: 500;
}

.success-box {
  margin-bottom: 14px;
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
  color: #059669;
}

.error-box {
  margin-bottom: 14px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
}

.success-box span,
.error-box span {
  font-size: 13px;
  font-weight: 700;
}

.password-strength {
  display: flex;
  align-items: center;
  gap: 10px;
}

.strength-track {
  flex: 1;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: #e2e8f0;
}

.strength-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  transition: width 0.2s ease;
}

.strength-empty {
  background: transparent;
}

.strength-weak {
  background: #dc2626;
}

.strength-medium {
  background: #ea580c;
}

.strength-strong {
  background: #059669;
}

.password-strength small {
  min-width: 74px;
  color: #64748b;
  font-size: 11px;
  font-weight: 800;
  text-align: right;
}

.primary-btn,
.settings-logout-btn {
  min-height: 42px;
  border: none;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.primary-btn {
  margin-top: auto;
  background: #2563eb;
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.18);
}

.primary-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
}

.profile-save-btn,
.password-save-btn {
  width: 100%;
}

.settings-logout-btn {
  width: 100%;
  background: #ef4444;
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(239, 68, 68, 0.16);
}

@media (max-width: 1280px) {
  .settings-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .internal-access-card {
    flex-direction: column;
    align-items: stretch;
  }

  .internal-action-row {
    flex-wrap: wrap;
  }

  .settings-grid {
    grid-template-columns: 1fr;
  }

  .profile-card,
  .password-card {
    min-height: auto;
  }

  .logout-settings-card {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .page-title-wrap {
    align-items: flex-start;
  }

  .header-actions {
    align-items: stretch;
  }

  .account-pill {
    width: 100%;
    justify-content: center;
  }

  .settings-summary-grid {
    grid-template-columns: 1fr;
  }

  .internal-action-row {
    flex-direction: column;
  }

  .quick-action-btn {
    width: 100%;
    justify-content: center;
  }

  .settings-card-header {
    flex-direction: column;
  }

  .small-action-btn {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .page-header {
    padding: 16px;
  }

  .page-title-icon {
    display: none;
  }

  .page-header h1 {
    font-size: 23px;
  }

  .settings-card,
  .logout-settings-card,
  .internal-access-card {
    padding: 16px;
  }

  .settings-title-row,
  .internal-access-left {
    align-items: flex-start;
  }
}
`;