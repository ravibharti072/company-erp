import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  X,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import api from "../api/api";
import { useAuth } from "../context/AuthContext";

const ROLE_OPTIONS = [
  "company-admin",
  "hr",
  "manager",
  "employee",
  "intern",
  "sales-representative",
  "freelancer",
  "accountant",
];

const PORTAL_OPTIONS = [
  {
    key: "people-onboarding",
    label: "People Onboarding",
    description: "Onboard people",
  },
  {
    key: "users",
    label: "Software Users",
    description: "Create login access",
  },
  {
    key: "attendance",
    label: "Attendance",
    description: "Check-in and records",
  },
  {
    key: "tasks",
    label: "Tasks",
    description: "Assigned work",
  },
  {
    key: "sales",
    label: "Sales",
    description: "CRM and leads",
  },
  {
    key: "software-products",
    label: "Software Products",
    description: "Reusable software list",
  },
  {
    key: "receive-payment",
    label: "Receive Payment",
    description: "Payment collection",
  },
  {
    key: "sales-commission",
    label: "Sales Commission",
    description: "Sales commission payout",
  },
  {
    key: "projects",
    label: "Projects",
    description: "Project tracking",
  },
  {
    key: "maintenance",
    label: "Maintenance",
    description: "Project and company issues",
  },
  {
    key: "reports",
    label: "Reports",
    description: "Company reports",
  },
  {
    key: "settings",
    label: "Settings",
    description: "Profile and password",
  },
];

const DEFAULT_PORTAL_ACCESS_BY_ROLE = {
  "company-admin": PORTAL_OPTIONS.map((item) => item.key),
  hr: [
    "people-onboarding",
    "users",
    "attendance",
    "tasks",
    "reports",
    "settings",
  ],
  manager: [
    "people-onboarding",
    "users",
    "attendance",
    "tasks",
    "sales",
    "software-products",
    "receive-payment",
    "sales-commission",
    "projects",
    "maintenance",
    "reports",
    "settings",
  ],
  accountant: [
    "attendance",
    "tasks",
    "receive-payment",
    "reports",
    "settings",
  ],
  employee: ["attendance", "tasks", "settings"],
  intern: ["attendance", "tasks", "settings"],
  "sales-representative": [
    "attendance",
    "tasks",
    "sales",
    "software-products",
    "receive-payment",
    "sales-commission",
    "maintenance",
    "settings",
  ],
  freelancer: ["attendance", "tasks", "settings"],
};

const USERS_PER_PAGE = 20;

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replaceAll(" ", "-");
}

function normalizePortal(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replaceAll(" ", "-");
}

function formatOptionLabel(value) {
  if (!value) return "";

  return String(value)
    .replaceAll("_", " ")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getDefaultPortalAccess(role) {
  const normalizedRole = normalizeRole(role);

  return DEFAULT_PORTAL_ACCESS_BY_ROLE[normalizedRole] || [
    "attendance",
    "tasks",
    "settings",
  ];
}

function parsePortalAccess(value, role) {
  if (Array.isArray(value)) {
    return value
      .map(normalizePortal)
      .filter((item) => PORTAL_OPTIONS.some((portal) => portal.key === item));
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed
          .map(normalizePortal)
          .filter((item) =>
            PORTAL_OPTIONS.some((portal) => portal.key === item)
          );
      }
    } catch {
      return getDefaultPortalAccess(role);
    }
  }

  return getDefaultPortalAccess(role);
}

function getPortalLabel(portalKey) {
  return (
    PORTAL_OPTIONS.find((item) => item.key === portalKey)?.label ||
    formatOptionLabel(portalKey)
  );
}

function getErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item?.msg || item?.message || "Validation error")
      .join(", ");
  }

  return fallback;
}

export default function UsersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [people, setPeople] = useState([]);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);

  const [activeView, setActiveView] = useState("active");
  const [searchText, setSearchText] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [linkFilter, setLinkFilter] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const [notification, setNotification] = useState({
    type: "",
    message: "",
  });

  const [confirmModal, setConfirmModal] = useState({
    open: false,
    action: "",
    userId: null,
    userName: "",
    userEmail: "",
    loading: false,
  });

  const [accessModal, setAccessModal] = useState({
    open: false,
    userId: null,
    userName: "",
    userEmail: "",
    role: "employee",
    portal_access: [],
    loading: false,
  });

  const [formData, setFormData] = useState({
    person_id: "",
    email: "",
    password: "",
    role: "employee",
    portal_access: getDefaultPortalAccess("employee"),
  });

  const showNotification = (type, message) => {
    setNotification({
      type,
      message,
    });
  };

  useEffect(() => {
    if (!notification.message) return;

    const timer = window.setTimeout(() => {
      setNotification({
        type: "",
        message: "",
      });
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [notification.message]);

  const peopleMap = useMemo(() => {
    const map = new Map();

    people.forEach((person) => {
      map.set(person.id, person);
    });

    return map;
  }, [people]);

  const activeUsersCount = useMemo(() => {
    return users.filter((item) => item.is_active !== false).length;
  }, [users]);

  const inactiveUsersCount = useMemo(() => {
    return users.filter((item) => item.is_active === false).length;
  }, [users]);

  const peopleWithoutLogin = useMemo(() => {
    const usedPersonIds = new Set(
      users
        .filter((item) => item.is_active !== false)
        .map((item) => item.person_id)
        .filter((personId) => personId !== null && personId !== undefined)
    );

    return people.filter(
      (person) => person.is_active && !usedPersonIds.has(person.id)
    );
  }, [people, users]);

  const selectedPerson = useMemo(() => {
    if (!formData.person_id) return null;

    return people.find(
      (person) => String(person.id) === String(formData.person_id)
    );
  }, [people, formData.person_id]);

  const filteredUsers = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return users.filter((item) => {
      const linkedPerson = item.person_id ? peopleMap.get(item.person_id) : null;
      const portalAccess = parsePortalAccess(item.portal_access, item.role);

      const searchTarget = [
        item.full_name,
        item.email,
        item.role,
        item.department,
        linkedPerson?.full_name,
        linkedPerson?.email,
        linkedPerson?.phone,
        linkedPerson?.person_type,
        ...portalAccess.map(getPortalLabel),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const viewMatch =
        activeView === "active"
          ? item.is_active !== false
          : item.is_active === false;

      const searchMatch = search ? searchTarget.includes(search) : true;
      const roleMatch = roleFilter ? item.role === roleFilter : true;

      const linkMatch =
        linkFilter === "linked"
          ? Boolean(item.person_id)
          : linkFilter === "unlinked"
            ? !item.person_id
            : true;

      return viewMatch && searchMatch && roleMatch && linkMatch;
    });
  }, [users, peopleMap, activeView, searchText, roleFilter, linkFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * USERS_PER_PAGE;
    return filteredUsers.slice(startIndex, startIndex + USERS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  const pageStart = filteredUsers.length
    ? (currentPage - 1) * USERS_PER_PAGE + 1
    : 0;

  const pageEnd = Math.min(currentPage * USERS_PER_PAGE, filteredUsers.length);

  const fetchPeopleAndUsers = async () => {
    try {
      setLoading(true);

      const [peopleResponse, usersResponse] = await Promise.all([
        api.get("/people"),
        api.get("/users"),
      ]);

      setPeople(Array.isArray(peopleResponse.data) ? peopleResponse.data : []);
      setUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
    } catch (error) {
      showNotification(
        "error",
        getErrorMessage(error, "Failed to load software users")
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeopleAndUsers();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeView, searchText, roleFilter, linkFilter, users.length]);

  const updateField = (event) => {
    const { name, value } = event.target;

    if (name === "person_id") {
      const person = people.find((item) => String(item.id) === String(value));

      setFormData((prev) => ({
        ...prev,
        person_id: value,
        email: person?.email || "",
      }));

      return;
    }

    if (name === "role") {
      setFormData((prev) => ({
        ...prev,
        role: value,
        portal_access: getDefaultPortalAccess(value),
      }));

      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const toggleCreatePortalAccess = (portalKey) => {
    setFormData((prev) => {
      const currentAccess = prev.portal_access || [];
      const hasAccess = currentAccess.includes(portalKey);

      const nextAccess = hasAccess
        ? currentAccess.filter((item) => item !== portalKey)
        : [...currentAccess, portalKey];

      return {
        ...prev,
        portal_access: nextAccess,
      };
    });
  };

  const toggleModalPortalAccess = (portalKey) => {
    setAccessModal((prev) => {
      const currentAccess = prev.portal_access || [];
      const hasAccess = currentAccess.includes(portalKey);

      const nextAccess = hasAccess
        ? currentAccess.filter((item) => item !== portalKey)
        : [...currentAccess, portalKey];

      return {
        ...prev,
        portal_access: nextAccess,
      };
    });
  };

  const resetCreateAccessToDefault = () => {
    setFormData((prev) => ({
      ...prev,
      portal_access: getDefaultPortalAccess(prev.role),
    }));
  };

  const selectAllCreateAccess = () => {
    setFormData((prev) => ({
      ...prev,
      portal_access: PORTAL_OPTIONS.map((item) => item.key),
    }));
  };

  const resetModalAccessToDefault = () => {
    setAccessModal((prev) => ({
      ...prev,
      portal_access: getDefaultPortalAccess(prev.role),
    }));
  };

  const selectAllModalAccess = () => {
    setAccessModal((prev) => ({
      ...prev,
      portal_access: PORTAL_OPTIONS.map((item) => item.key),
    }));
  };

  const resetForm = () => {
    setFormData({
      person_id: "",
      email: "",
      password: "",
      role: "employee",
      portal_access: getDefaultPortalAccess("employee"),
    });
  };

  const clearFilters = () => {
    setSearchText("");
    setRoleFilter("");
    setLinkFilter("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.person_id) {
      showNotification("error", "Please select an onboarded person first.");
      return;
    }

    if (!formData.email.trim()) {
      showNotification("error", "Email is required to create software login.");
      return;
    }

    if (!formData.password.trim()) {
      showNotification("error", "Password is required.");
      return;
    }

    if (!formData.portal_access.length) {
      showNotification("error", "Please select at least one portal access.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        person_id: Number(formData.person_id),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
        portal_access: formData.portal_access,
      };

      await api.post("/users", payload);

      resetForm();
      setShowCreateForm(false);
      setActiveView("active");
      await fetchPeopleAndUsers();

      showNotification("success", "Software user created successfully.");
    } catch (error) {
      showNotification(
        "error",
        getErrorMessage(error, "Failed to create software user")
      );
    } finally {
      setSaving(false);
    }
  };

  const openAccessModal = (item) => {
    setAccessModal({
      open: true,
      userId: item.id,
      userName: item.full_name || "User",
      userEmail: item.email || "",
      role: item.role || "employee",
      portal_access: parsePortalAccess(item.portal_access, item.role),
      loading: false,
    });
  };

  const closeAccessModal = () => {
    if (accessModal.loading) return;

    setAccessModal({
      open: false,
      userId: null,
      userName: "",
      userEmail: "",
      role: "employee",
      portal_access: [],
      loading: false,
    });
  };

  const handleAccessRoleChange = (event) => {
    const nextRole = event.target.value;

    setAccessModal((prev) => ({
      ...prev,
      role: nextRole,
      portal_access: getDefaultPortalAccess(nextRole),
    }));
  };

  const handleUpdateAccess = async () => {
    if (!accessModal.userId) return;

    if (!accessModal.portal_access.length) {
      showNotification("error", "Please select at least one portal access.");
      return;
    }

    try {
      setAccessModal((prev) => ({
        ...prev,
        loading: true,
      }));

      await api.put(`/users/${accessModal.userId}`, {
        role: accessModal.role,
        portal_access: accessModal.portal_access,
      });

      await fetchPeopleAndUsers();

      setAccessModal({
        open: false,
        userId: null,
        userName: "",
        userEmail: "",
        role: "employee",
        portal_access: [],
        loading: false,
      });

      showNotification("success", "User portal access updated successfully.");
    } catch (error) {
      setAccessModal((prev) => ({
        ...prev,
        loading: false,
      }));

      showNotification(
        "error",
        getErrorMessage(error, "Failed to update portal access")
      );
    }
  };

  const openDeactivateModal = (item) => {
    setConfirmModal({
      open: true,
      action: "deactivate",
      userId: item.id,
      userName: item.full_name || "User",
      userEmail: item.email || "",
      loading: false,
    });
  };

  const openHardDeleteModal = (item) => {
    setConfirmModal({
      open: true,
      action: "hard-delete",
      userId: item.id,
      userName: item.full_name || "User",
      userEmail: item.email || "",
      loading: false,
    });
  };

  const closeConfirmModal = () => {
    if (confirmModal.loading) return;

    setConfirmModal({
      open: false,
      action: "",
      userId: null,
      userName: "",
      userEmail: "",
      loading: false,
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmModal.userId || !confirmModal.action) return;

    try {
      setConfirmModal((prev) => ({
        ...prev,
        loading: true,
      }));

      if (confirmModal.action === "deactivate") {
        await api.delete(`/users/${confirmModal.userId}`);
        await fetchPeopleAndUsers();
        setActiveView("inactive");
        showNotification("success", "Software user deactivated successfully.");
      }

      if (confirmModal.action === "hard-delete") {
        await api.delete(`/users/${confirmModal.userId}/hard-delete`);
        await fetchPeopleAndUsers();
        showNotification("success", "Software user permanently deleted.");
      }

      setConfirmModal({
        open: false,
        action: "",
        userId: null,
        userName: "",
        userEmail: "",
        loading: false,
      });
    } catch (error) {
      setConfirmModal((prev) => ({
        ...prev,
        loading: false,
      }));

      showNotification(
        "error",
        getErrorMessage(
          error,
          confirmModal.action === "hard-delete"
            ? "Failed to permanently delete user"
            : "Failed to deactivate software user"
        )
      );
    }
  };

  const goBack = () => {
    navigate(-1);
  };

  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const modalIsHardDelete = confirmModal.action === "hard-delete";

  return (
    <>
      <style>{usersPageStyles}</style>

      <div className="software-users-page">
        <div className="page-header">
          <div className="page-title-wrap">
            <button type="button" className="back-button" onClick={goBack}>
              <ArrowLeft size={18} />
            </button>

            <div className="page-title-icon">
              <UserCheck size={22} />
            </div>

            <div>
              <h1>Software Users</h1>
              <p>
                Create software login access and choose which modules each user
                can open.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="create-user-button"
            onClick={() => setShowCreateForm((prev) => !prev)}
          >
            {showCreateForm ? <X size={17} /> : <Plus size={17} />}
            {showCreateForm ? "Close" : "Create User"}
          </button>
        </div>

        {notification.message && (
          <div
            className={
              notification.type === "success"
                ? "page-notification success"
                : "page-notification error"
            }
          >
            {notification.type === "success" ? (
              <CheckCircle2 size={18} />
            ) : (
              <XCircle size={18} />
            )}
            <span>{notification.message}</span>
            <button
              type="button"
              onClick={() => setNotification({ type: "", message: "" })}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {showCreateForm && (
          <form className="module-form-card" onSubmit={handleSubmit}>
            <div className="card-title-row">
              <div className="card-title-icon">
                <KeyRound size={19} />
              </div>

              <div>
                <h2>Create Software Login</h2>
                <p>
                  First select an onboarded person, then choose software role and
                  module access.
                </p>
              </div>
            </div>

            <div className="form-content-grid">
              <div className="form-group person-select-group">
                <label>Select Onboarded Person</label>
                <select
                  name="person_id"
                  value={formData.person_id}
                  onChange={updateField}
                  required
                >
                  <option value="">Select person</option>
                  {peopleWithoutLogin.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.full_name} — {formatOptionLabel(person.person_type)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Email / Login ID</label>
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={updateField}
                  placeholder="login@example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={updateField}
                  placeholder="Set password"
                  required
                />
              </div>

              <div className="form-group">
                <label>Software Role</label>
                <select name="role" value={formData.role} onChange={updateField}>
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {formatOptionLabel(role)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="portal-access-card">
              <div className="portal-access-header">
                <div>
                  <h3>Module Access</h3>
                  <p>
                    Select only those modules that this user should see after
                    login.
                  </p>
                </div>

                <div className="portal-access-actions">
                  <button
                    type="button"
                    className="access-small-button"
                    onClick={resetCreateAccessToDefault}
                  >
                    Role Default
                  </button>
                  <button
                    type="button"
                    className="access-small-button"
                    onClick={selectAllCreateAccess}
                  >
                    Select All
                  </button>
                </div>
              </div>

              <div className="portal-access-grid">
                {PORTAL_OPTIONS.map((portal) => {
                  const checked = formData.portal_access.includes(portal.key);

                  return (
                    <label
                      className={
                        checked
                          ? "portal-checkbox checked"
                          : "portal-checkbox"
                      }
                      key={portal.key}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCreatePortalAccess(portal.key)}
                      />

                      <span>
                        <strong>{portal.label}</strong>
                        <small>{portal.description}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {selectedPerson && (
              <div className="selected-person-card">
                <div className="selected-person-icon">
                  <ShieldCheck size={18} />
                </div>

                <div>
                  <strong>{selectedPerson.full_name}</strong>
                  <p>
                    {formatOptionLabel(selectedPerson.person_type)} •{" "}
                    {selectedPerson.department || "No department"} •{" "}
                    {selectedPerson.phone || selectedPerson.email || "No contact"}
                  </p>
                </div>
              </div>
            )}

            <div className="form-actions-row">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  resetForm();
                  setShowCreateForm(false);
                }}
              >
                Cancel
              </button>

              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? "Creating..." : "Create Login User"}
              </button>
            </div>
          </form>
        )}

        <section className="user-view-tabs-card">
          <button
            type="button"
            className={
              activeView === "active" ? "user-view-tab active" : "user-view-tab"
            }
            onClick={() => setActiveView("active")}
          >
            <UserCheck size={17} />
            Active Users
            <span>{activeUsersCount}</span>
          </button>

          <button
            type="button"
            className={
              activeView === "inactive"
                ? "user-view-tab active inactive"
                : "user-view-tab"
            }
            onClick={() => setActiveView("inactive")}
          >
            <UserX size={17} />
            Deactivated Users
            <span>{inactiveUsersCount}</span>
          </button>
        </section>

        <section className="users-toolbar-card">
          <div className="search-box">
            <Search size={18} />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search by name, email, role, module, department, or person type..."
            />
          </div>

          <div className="toolbar-filters">
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
            >
              <option value="">All Roles</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {formatOptionLabel(role)}
                </option>
              ))}
            </select>

            <select
              value={linkFilter}
              onChange={(event) => setLinkFilter(event.target.value)}
            >
              <option value="">All User Links</option>
              <option value="linked">Linked To Person</option>
              <option value="unlinked">Without Person Link</option>
            </select>

            <button
              type="button"
              className="clear-filter-button"
              onClick={clearFilters}
            >
              Clear
            </button>
          </div>
        </section>

        <div className="users-list-card">
          <div className="list-header">
            <div>
              <h2>
                {activeView === "active"
                  ? "Active Software Users"
                  : "Deactivated Software Users"}
              </h2>
              <p>
                {loading
                  ? "Loading users..."
                  : `Showing ${pageStart}-${pageEnd} of ${filteredUsers.length} users`}
              </p>
            </div>

            <div className="list-count-pill">
              <Mail size={15} />
              {activeView === "active" ? activeUsersCount : inactiveUsersCount} total
            </div>
          </div>

          {paginatedUsers.length === 0 ? (
            <div className="empty-state-card">
              {activeView === "active" ? (
                <UserCheck size={32} />
              ) : (
                <UserX size={32} />
              )}
              <h3>
                {activeView === "active"
                  ? "No active software users found"
                  : "No deactivated users found"}
              </h3>
              <p>
                {activeView === "active"
                  ? "Create a software user from an onboarded person or clear filters to see all users."
                  : "Deactivated users will appear here. Hard delete is available only for inactive users."}
              </p>
            </div>
          ) : (
            <div className="users-tile-grid">
              {paginatedUsers.map((item) => {
                const linkedPerson = item.person_id
                  ? peopleMap.get(item.person_id)
                  : null;

                const isActiveUser = item.is_active !== false;
                const canManageUser =
                  item.id !== user?.id && item.role !== "super-admin";

                const portalAccess = parsePortalAccess(
                  item.portal_access,
                  item.role
                );

                return (
                  <article
                    className={
                      isActiveUser
                        ? "user-tile"
                        : "user-tile inactive-user-tile"
                    }
                    key={item.id}
                  >
                    <div className="user-tile-top">
                      <div className="user-avatar">
                        {(item.full_name || item.email || "U")
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="user-tile-actions">
                        <span
                          className={
                            isActiveUser
                              ? "status-pill active-status"
                              : "status-pill inactive-status"
                          }
                        >
                          {isActiveUser ? "Active" : "Inactive"}
                        </span>

                        {isActiveUser && canManageUser && (
                          <button
                            type="button"
                            className="access-button"
                            onClick={() => openAccessModal(item)}
                            title="Edit module access"
                          >
                            Access
                          </button>
                        )}

                        {canManageUser &&
                          (isActiveUser ? (
                            <button
                              type="button"
                              className="icon-danger-button"
                              onClick={() => openDeactivateModal(item)}
                              title="Deactivate user"
                            >
                              <Trash2 size={15} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="hard-delete-button"
                              onClick={() => openHardDeleteModal(item)}
                              title="Permanently delete user"
                            >
                              <Trash2 size={15} />
                              Hard Delete
                            </button>
                          ))}
                      </div>
                    </div>

                    <div className="user-info">
                      <h3>{item.full_name}</h3>
                      <p>{item.email}</p>
                    </div>

                    <div className="user-meta-grid">
                      <div>
                        <span>Role</span>
                        <strong>{formatOptionLabel(item.role)}</strong>
                      </div>

                      <div>
                        <span>Department</span>
                        <strong>{item.department || "-"}</strong>
                      </div>

                      <div>
                        <span>Linked Person</span>
                        <strong>{linkedPerson?.full_name || "-"}</strong>
                      </div>

                      <div>
                        <span>Modules</span>
                        <strong>{portalAccess.length} Access</strong>
                      </div>
                    </div>

                    <div className="portal-badges">
                      {portalAccess.slice(0, 4).map((portalKey) => (
                        <span key={portalKey}>{getPortalLabel(portalKey)}</span>
                      ))}

                      {portalAccess.length > 4 && (
                        <span>+{portalAccess.length - 4} more</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="pagination-row">
            <p>
              Page {currentPage} of {totalPages}
            </p>

            <div className="pagination-actions">
              <button
                type="button"
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
                Previous
              </button>

              <button
                type="button"
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {accessModal.open && (
          <div className="erp-modal-backdrop">
            <div className="access-modal-card">
              <button
                type="button"
                className="modal-close-button"
                onClick={closeAccessModal}
                disabled={accessModal.loading}
              >
                <X size={17} />
              </button>

              <div className="access-modal-icon">
                <ShieldCheck size={25} />
              </div>

              <h2>Update Module Access</h2>
              <p className="access-modal-subtitle">
                Select which modules this user can see and use after login.
              </p>

              <div className="confirm-user-card">
                <div className="confirm-user-avatar">
                  {(accessModal.userName || accessModal.userEmail || "U")
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div>
                  <strong>{accessModal.userName}</strong>
                  <span>{accessModal.userEmail || "-"}</span>
                </div>
              </div>

              <div className="access-role-box">
                <label>Software Role</label>
                <select
                  value={accessModal.role}
                  onChange={handleAccessRoleChange}
                  disabled={accessModal.loading}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {formatOptionLabel(role)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="portal-access-header modal-portal-header">
                <div>
                  <h3>Allowed Modules</h3>
                  <p>Only selected modules will be visible to this user.</p>
                </div>

                <div className="portal-access-actions">
                  <button
                    type="button"
                    className="access-small-button"
                    onClick={resetModalAccessToDefault}
                    disabled={accessModal.loading}
                  >
                    Role Default
                  </button>
                  <button
                    type="button"
                    className="access-small-button"
                    onClick={selectAllModalAccess}
                    disabled={accessModal.loading}
                  >
                    Select All
                  </button>
                </div>
              </div>

              <div className="portal-access-grid modal-access-grid">
                {PORTAL_OPTIONS.map((portal) => {
                  const checked = accessModal.portal_access.includes(portal.key);

                  return (
                    <label
                      className={
                        checked
                          ? "portal-checkbox checked"
                          : "portal-checkbox"
                      }
                      key={portal.key}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleModalPortalAccess(portal.key)}
                        disabled={accessModal.loading}
                      />

                      <span>
                        <strong>{portal.label}</strong>
                        <small>{portal.description}</small>
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="confirm-actions">
                <button
                  type="button"
                  className="modal-secondary-btn"
                  onClick={closeAccessModal}
                  disabled={accessModal.loading}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="modal-primary-btn"
                  onClick={handleUpdateAccess}
                  disabled={accessModal.loading}
                >
                  {accessModal.loading ? "Saving..." : "Save Access"}
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmModal.open && (
          <div className="erp-modal-backdrop">
            <div className="erp-confirm-modal">
              <button
                type="button"
                className="modal-close-button"
                onClick={closeConfirmModal}
                disabled={confirmModal.loading}
              >
                <X size={17} />
              </button>

              <div
                className={
                  modalIsHardDelete
                    ? "confirm-icon danger"
                    : "confirm-icon warning"
                }
              >
                {modalIsHardDelete ? (
                  <Trash2 size={24} />
                ) : (
                  <AlertTriangle size={24} />
                )}
              </div>

              <h2>
                {modalIsHardDelete
                  ? "Permanently Delete User?"
                  : "Deactivate Software User?"}
              </h2>

              <p className="confirm-message">
                {modalIsHardDelete
                  ? "This action will permanently remove this user from the database. This cannot be undone."
                  : "This user will be moved to Deactivated Users. They will no longer have active software access."}
              </p>

              <div className="confirm-user-card">
                <div className="confirm-user-avatar">
                  {(confirmModal.userName || confirmModal.userEmail || "U")
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div>
                  <strong>{confirmModal.userName}</strong>
                  <span>{confirmModal.userEmail || "-"}</span>
                </div>
              </div>

              <div className="confirm-actions">
                <button
                  type="button"
                  className="modal-secondary-btn"
                  onClick={closeConfirmModal}
                  disabled={confirmModal.loading}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className={
                    modalIsHardDelete
                      ? "modal-danger-btn"
                      : "modal-warning-btn"
                  }
                  onClick={handleConfirmAction}
                  disabled={confirmModal.loading}
                >
                  {confirmModal.loading
                    ? "Processing..."
                    : modalIsHardDelete
                      ? "Hard Delete"
                      : "Deactivate User"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const usersPageStyles = `
.software-users-page {
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
  border: 1px solid var(--erp-border);
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
  font-weight: 700;
}

.page-header p {
  margin: 7px 0 0;
  color: #334155;
  font-size: 13px;
  font-weight: 500;
}

.create-user-button {
  min-width: 128px;
  height: 42px;
  border: none;
  background: #2563eb;
  color: #ffffff;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.18);
  cursor: pointer;
}

.page-notification {
  min-height: 52px;
  padding: 13px 15px;
  border-radius: 17px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.05);
}

.page-notification.success {
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
  color: #059669;
}

.page-notification.error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
}

.page-notification span {
  flex: 1;
  font-size: 13px;
  font-weight: 800;
}

.page-notification button {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.75);
  color: inherit;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.module-form-card,
.user-view-tabs-card,
.users-toolbar-card,
.users-list-card {
  width: 100%;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid var(--erp-border);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.055);
}

.module-form-card {
  padding: 18px;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--erp-border-soft);
}

.card-title-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: #2563eb;
  background: #eef6ff;
  border: 1px solid #dbeafe;
  flex-shrink: 0;
}

.card-title-row h2,
.list-header h2 {
  margin: 0;
  color: #06142b;
  font-size: 21px;
  font-weight: 700;
}

.card-title-row p,
.list-header p {
  margin: 6px 0 0;
  color: #52677e;
  font-size: 12px;
  font-weight: 500;
}

.form-content-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1fr;
  gap: 13px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}

.form-group label {
  color: #334155;
  font-size: 12px;
  font-weight: 700;
}

.form-group input,
.form-group select,
.toolbar-filters select,
.search-box input,
.access-role-box select {
  width: 100%;
  min-height: 40px;
  border-radius: 13px;
  border: 1px solid #dbe5f2;
  background: #ffffff;
  color: #0f172a;
  padding: 9px 12px;
  font-size: 13px;
  outline: none;
}

.form-group input:focus,
.form-group select:focus,
.toolbar-filters select:focus,
.search-box:focus-within,
.access-role-box select:focus {
  border-color: #bfdbfe;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.10);
}

.portal-access-card {
  margin-top: 16px;
  padding: 15px;
  border-radius: 18px;
  background: #f8fbff;
  border: 1px solid #dbeafe;
}

.portal-access-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 13px;
}

.portal-access-header h3 {
  margin: 0;
  color: #06142b;
  font-size: 16px;
  font-weight: 800;
}

.portal-access-header p {
  margin: 5px 0 0;
  color: #52677e;
  font-size: 12px;
  font-weight: 500;
}

.portal-access-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.access-small-button {
  height: 32px;
  padding: 0 11px;
  border-radius: 11px;
  border: 1px solid #bfdbfe;
  background: #ffffff;
  color: #2563eb;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

.portal-access-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.portal-checkbox {
  min-height: 64px;
  padding: 11px;
  border-radius: 15px;
  border: 1px solid #dbe5f2;
  background: #ffffff;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
}

.portal-checkbox.checked {
  background: #eff6ff;
  border-color: #93c5fd;
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.12);
}

.portal-checkbox input {
  width: 16px;
  height: 16px;
  margin-top: 2px;
  accent-color: #2563eb;
  flex-shrink: 0;
}

.portal-checkbox span {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.portal-checkbox strong {
  color: #06142b;
  font-size: 12px;
  font-weight: 900;
}

.portal-checkbox small {
  color: #64748b;
  font-size: 11px;
  font-weight: 600;
}

.selected-person-card {
  margin-top: 14px;
  padding: 13px 14px;
  border-radius: 16px;
  background: #f8fbff;
  border: 1px solid #dbeafe;
  display: flex;
  align-items: center;
  gap: 12px;
}

.selected-person-icon {
  width: 38px;
  height: 38px;
  border-radius: 13px;
  background: #eef6ff;
  color: #2563eb;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.selected-person-card strong {
  display: block;
  color: #06142b;
  font-size: 13px;
  font-weight: 700;
}

.selected-person-card p {
  margin: 4px 0 0;
  color: #52677e;
  font-size: 12px;
  font-weight: 500;
}

.form-actions-row {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

.primary-button,
.secondary-button {
  min-width: 145px;
  height: 42px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.primary-button {
  border: none;
  background: #2563eb;
  color: #ffffff;
}

.secondary-button {
  border: 1px solid #dbe5f2;
  background: #ffffff;
  color: #0f172a;
}

.primary-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.user-view-tabs-card {
  padding: 10px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.user-view-tab {
  min-height: 46px;
  border-radius: 15px;
  border: 1px solid #dbe5f2;
  background: #ffffff;
  color: #334155;
  font-size: 13px;
  font-weight: 800;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  cursor: pointer;
}

.user-view-tab span {
  min-width: 28px;
  height: 26px;
  padding: 0 8px;
  border-radius: 999px;
  background: #f8fafc;
  color: #0f172a;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 900;
}

.user-view-tab.active {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #2563eb;
}

.user-view-tab.active.inactive {
  border-color: #fecaca;
  background: #fef2f2;
  color: #dc2626;
}

.users-toolbar-card {
  padding: 16px;
  display: grid;
  grid-template-columns: minmax(260px, 1fr) auto;
  gap: 14px;
  align-items: center;
}

.search-box {
  min-height: 42px;
  border-radius: 14px;
  border: 1px solid #dbe5f2;
  background: #ffffff;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
}

.search-box svg {
  color: #64748b;
  flex-shrink: 0;
}

.search-box input {
  border: none;
  min-height: 40px;
  padding: 0;
}

.toolbar-filters {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar-filters select {
  min-width: 150px;
}

.clear-filter-button {
  height: 40px;
  padding: 0 14px;
  border-radius: 13px;
  border: 1px solid #dbe5f2;
  background: #ffffff;
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.users-list-card {
  overflow: hidden;
}

.list-header {
  min-height: 78px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--erp-border-soft);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.list-count-pill {
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #2563eb;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.users-tile-grid {
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.user-tile {
  min-height: 260px;
  border-radius: 18px;
  border: 1px solid var(--erp-border);
  background: #ffffff;
  padding: 15px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.035);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.inactive-user-tile {
  background: #fffafa;
  border-color: #fecaca;
}

.user-tile-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.user-avatar {
  width: 44px;
  height: 44px;
  border-radius: 15px;
  background: linear-gradient(135deg, #2563eb, #14b8a6);
  color: #ffffff;
  display: grid;
  place-items: center;
  font-size: 17px;
  font-weight: 800;
  flex-shrink: 0;
}

.inactive-user-tile .user-avatar {
  background: linear-gradient(135deg, #dc2626, #f97316);
}

.user-tile-actions {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.user-info h3 {
  margin: 0;
  color: #06142b;
  font-size: 15px;
  font-weight: 700;
}

.user-info p {
  margin: 5px 0 0;
  color: #52677e;
  font-size: 12px;
  font-weight: 500;
  word-break: break-word;
}

.user-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: auto;
}

.user-meta-grid div {
  min-height: 54px;
  padding: 10px;
  border-radius: 13px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
}

.user-meta-grid span {
  display: block;
  color: #64748b;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.user-meta-grid strong {
  display: block;
  margin-top: 5px;
  color: #0f172a;
  font-size: 12px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.portal-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.portal-badges span {
  min-height: 24px;
  padding: 5px 8px;
  border-radius: 999px;
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
  font-size: 10px;
  font-weight: 800;
}

.status-pill {
  width: fit-content;
  min-height: 26px;
  padding: 5px 10px;
  border-radius: 999px;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  font-size: 11px !important;
  font-weight: 700 !important;
  white-space: nowrap;
}

.active-status {
  color: #059669 !important;
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
}

.inactive-status {
  color: #dc2626 !important;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.icon-danger-button {
  width: 30px;
  height: 30px;
  border-radius: 11px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #dc2626;
  display: inline-grid;
  place-items: center;
  cursor: pointer;
}

.access-button {
  min-height: 30px;
  padding: 0 10px;
  border-radius: 11px;
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #2563eb;
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
}

.hard-delete-button {
  min-height: 30px;
  padding: 0 9px;
  border-radius: 11px;
  border: 1px solid #fecaca;
  background: #dc2626;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

.empty-state-card {
  min-height: 260px;
  padding: 34px 20px;
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  text-align: center;
  gap: 10px;
}

.empty-state-card h3 {
  margin: 0;
  color: #06142b;
  font-size: 18px;
  font-weight: 700;
}

.empty-state-card p {
  max-width: 420px;
  margin: 0;
  color: #52677e;
  font-size: 13px;
  font-weight: 500;
}

.pagination-row {
  min-height: 62px;
  padding: 14px 20px;
  border-top: 1px solid var(--erp-border-soft);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.pagination-row p {
  color: #52677e;
  font-size: 13px;
  font-weight: 500;
}

.pagination-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pagination-actions button {
  height: 38px;
  padding: 0 13px;
  border-radius: 13px;
  border: 1px solid #dbe5f2;
  background: #ffffff;
  color: #0f172a;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.pagination-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.erp-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(15, 23, 42, 0.52);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.erp-confirm-modal,
.access-modal-card {
  width: min(440px, 100%);
  position: relative;
  border-radius: 24px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 34px 80px rgba(15, 23, 42, 0.28);
  padding: 28px;
  text-align: center;
}

.access-modal-card {
  width: min(760px, 100%);
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  text-align: left;
}

.modal-close-button {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 34px;
  height: 34px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #64748b;
  border-radius: 12px;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.confirm-icon,
.access-modal-icon {
  width: 58px;
  height: 58px;
  margin: 0 auto 16px;
  border-radius: 20px;
  display: grid;
  place-items: center;
}

.access-modal-icon {
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
}

.confirm-icon.warning {
  background: #fff7ed;
  color: #ea580c;
  border: 1px solid #fed7aa;
}

.confirm-icon.danger {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.erp-confirm-modal h2,
.access-modal-card h2 {
  margin: 0;
  color: #06142b;
  font-size: 23px;
  font-weight: 900;
  text-align: center;
}

.access-modal-subtitle {
  margin: 10px auto 18px;
  color: #52677e;
  font-size: 13px;
  line-height: 1.55;
  font-weight: 600;
  text-align: center;
}

.confirm-message {
  margin: 10px auto 18px;
  max-width: 360px;
  color: #52677e;
  font-size: 13px;
  line-height: 1.55;
  font-weight: 600;
}

.confirm-user-card {
  min-height: 68px;
  padding: 12px;
  border-radius: 18px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
}

.confirm-user-avatar {
  width: 44px;
  height: 44px;
  border-radius: 15px;
  background: linear-gradient(135deg, #2563eb, #14b8a6);
  color: #ffffff;
  display: grid;
  place-items: center;
  font-weight: 900;
  flex-shrink: 0;
}

.confirm-user-card strong {
  display: block;
  color: #06142b;
  font-size: 14px;
  font-weight: 900;
}

.confirm-user-card span {
  display: block;
  margin-top: 4px;
  color: #52677e;
  font-size: 12px;
  font-weight: 600;
}

.access-role-box {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.access-role-box label {
  color: #334155;
  font-size: 12px;
  font-weight: 800;
}

.modal-portal-header {
  margin-top: 18px;
}

.modal-access-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.confirm-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 20px;
}

.modal-secondary-btn,
.modal-warning-btn,
.modal-danger-btn,
.modal-primary-btn {
  min-height: 44px;
  border-radius: 15px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.modal-secondary-btn {
  border: 1px solid #dbe5f2;
  background: #ffffff;
  color: #0f172a;
}

.modal-warning-btn {
  border: none;
  background: #ea580c;
  color: #ffffff;
}

.modal-danger-btn {
  border: none;
  background: #dc2626;
  color: #ffffff;
}

.modal-primary-btn {
  border: none;
  background: #2563eb;
  color: #ffffff;
}

.modal-secondary-btn:disabled,
.modal-warning-btn:disabled,
.modal-danger-btn:disabled,
.modal-primary-btn:disabled,
.access-small-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

@media (max-width: 1500px) {
  .users-tile-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1280px) {
  .form-content-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .person-select-group {
    grid-column: span 2;
  }

  .users-toolbar-card {
    grid-template-columns: 1fr;
  }

  .toolbar-filters {
    flex-wrap: wrap;
  }

  .users-tile-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .portal-access-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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

  .create-user-button {
    width: 100%;
  }

  .form-content-grid {
    grid-template-columns: 1fr;
  }

  .person-select-group {
    grid-column: span 1;
  }

  .portal-access-header {
    flex-direction: column;
  }

  .portal-access-actions {
    width: 100%;
  }

  .access-small-button {
    flex: 1;
  }

  .portal-access-grid,
  .modal-access-grid {
    grid-template-columns: 1fr;
  }

  .form-actions-row {
    justify-content: stretch;
    flex-direction: column;
  }

  .primary-button,
  .secondary-button {
    width: 100%;
  }

  .user-view-tabs-card {
    grid-template-columns: 1fr;
  }

  .toolbar-filters {
    flex-direction: column;
    width: 100%;
  }

  .toolbar-filters select,
  .clear-filter-button {
    width: 100%;
  }

  .list-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .users-tile-grid {
    grid-template-columns: 1fr;
  }

  .pagination-row {
    flex-direction: column;
    align-items: stretch;
  }

  .pagination-actions {
    width: 100%;
  }

  .pagination-actions button {
    flex: 1;
    justify-content: center;
  }

  .confirm-actions {
    grid-template-columns: 1fr;
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

  .module-form-card,
  .users-toolbar-card {
    padding: 15px;
  }

  .list-header {
    padding: 16px;
  }

  .user-meta-grid {
    grid-template-columns: 1fr;
  }

  .erp-confirm-modal,
  .access-modal-card {
    padding: 22px;
  }
}
`;