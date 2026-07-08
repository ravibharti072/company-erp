import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Filter,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import api from "../api/api";
import { useAuth } from "../context/AuthContext";

const ADMIN_ROLES = ["super-admin", "company-admin", "admin", "owner"];

const PROJECTS_API = "/sales/projects";
const ISSUES_API = "/sales/project-issues";

const ISSUE_STATUS_OPTIONS = ["open", "in-progress", "fixed", "closed"];
const ISSUE_PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

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

function normalizeStatus(value, fallback = "open") {
  if (!value) return fallback;

  return String(value)
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replaceAll(" ", "-");
}

function formatLabel(value) {
  if (!value) return "-";

  return String(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function parsePortalAccess(value) {
  if (Array.isArray(value)) {
    return value.map(normalizePortal).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.map(normalizePortal).filter(Boolean);
      }
    } catch {
      return [];
    }
  }

  return [];
}

function hasPortalAccess(user, portalKey) {
  const role = normalizeRole(user?.role);

  if (ADMIN_ROLES.includes(role)) {
    return true;
  }

  const portalAccess = parsePortalAccess(user?.portal_access);

  return portalAccess.includes(normalizePortal(portalKey));
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

function getEmptyIssueForm() {
  return {
    issue_type: "project_issue",
    project_id: "",
    title: "",
    description: "",
    priority: "medium",
    remarks: "",
  };
}

export default function MaintenancePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [projects, setProjects] = useState([]);
  const [issues, setIssues] = useState([]);

  const [form, setForm] = useState(getEmptyIssueForm());

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [notification, setNotification] = useState({
    type: "",
    message: "",
  });

  const canUseMaintenance =
    hasPortalAccess(user, "sales") || hasPortalAccess(user, "projects");

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
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [notification.message]);

  const availableProjects = useMemo(() => {
    return projects.filter((project) => {
      const status = normalizeStatus(project.status, "ongoing");
      return ["delivered", "completed"].includes(status);
    });
  }, [projects]);

  const projectsMap = useMemo(() => {
    const map = new Map();

    projects.forEach((project) => {
      map.set(Number(project.id), project);
    });

    return map;
  }, [projects]);

  const issueSummary = useMemo(() => {
    return {
      total: issues.length,
      open: issues.filter((issue) => normalizeStatus(issue.status) === "open")
        .length,
      inProgress: issues.filter(
        (issue) => normalizeStatus(issue.status) === "in-progress"
      ).length,
      fixed: issues.filter((issue) => normalizeStatus(issue.status) === "fixed")
        .length,
      closed: issues.filter((issue) => normalizeStatus(issue.status) === "closed")
        .length,
    };
  }, [issues]);

  const filteredIssues = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return issues.filter((issue) => {
      const status = normalizeStatus(issue.status);
      const priority = normalizeStatus(issue.priority, "medium");

      const linkedProject = issue.project_id
        ? projectsMap.get(Number(issue.project_id))
        : null;

      const searchTarget = [
        issue.title,
        issue.description,
        issue.remarks,
        issue.priority,
        issue.status,
        issue.issue_type,
        linkedProject?.title,
        linkedProject?.client_name,
        linkedProject?.client_company_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchMatch = search ? searchTarget.includes(search) : true;
      const statusMatch = statusFilter ? status === statusFilter : true;
      const priorityMatch = priorityFilter ? priority === priorityFilter : true;

      return searchMatch && statusMatch && priorityMatch;
    });
  }, [issues, projectsMap, searchText, statusFilter, priorityFilter]);

  const fetchProjects = async () => {
    try {
      const response = await api.get(PROJECTS_API);
      setProjects(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      showNotification("error", getErrorMessage(error, "Failed to load projects"));
    }
  };

  const fetchIssues = async () => {
    try {
      const response = await api.get(ISSUES_API);
      setIssues(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      showNotification("error", getErrorMessage(error, "Failed to load issues"));
    }
  };

  const fetchAll = async () => {
    if (!canUseMaintenance) return;

    try {
      setLoading(true);
      await Promise.all([fetchProjects(), fetchIssues()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseMaintenance]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    if (name === "issue_type") {
      setForm({
        ...getEmptyIssueForm(),
        issue_type: value,
      });

      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setForm(getEmptyIssueForm());
  };

  const handleCreateIssue = async (event) => {
    event.preventDefault();

    if (!form.title.trim()) {
      showNotification("error", "Issue title is required");
      return;
    }

    if (form.issue_type === "project_issue" && !form.project_id) {
      showNotification("error", "Please choose delivered/completed project");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        project_id:
          form.issue_type === "project_issue" && form.project_id
            ? Number(form.project_id)
            : null,
        issue_type: form.issue_type,
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority || "medium",
        status: "open",
        remarks: form.remarks.trim() || null,
      };

      await api.post(ISSUES_API, payload);

      resetForm();
      await fetchAll();

      showNotification("success", "Maintenance issue raised successfully");
    } catch (error) {
      showNotification(
        "error",
        getErrorMessage(error, "Failed to create maintenance issue")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateIssueStatus = async (issue, nextStatus) => {
    const status = normalizeStatus(nextStatus);

    try {
      setSaving(true);

      try {
        await api.put(`${ISSUES_API}/${issue.id}/status`, {
          status,
          remarks: issue.remarks || null,
        });
      } catch {
        await api.put(`${ISSUES_API}/${issue.id}`, {
          status,
          remarks: issue.remarks || null,
        });
      }

      await fetchAll();

      showNotification("success", `Issue marked as ${formatLabel(status)}`);
    } catch (error) {
      showNotification(
        "error",
        getErrorMessage(error, "Failed to update issue status")
      );
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setSearchText("");
    setStatusFilter("");
    setPriorityFilter("");
  };

  if (!canUseMaintenance) {
    return (
      <>
        <style>{maintenanceStyles}</style>

        <div className="maintenance-page">
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
                <Wrench size={22} />
              </div>

              <div>
                <h1>Maintenance Access Required</h1>
                <p>You do not have access to Maintenance module.</p>
              </div>
            </div>
          </div>

          <div className="empty-state-card">
            <Wrench size={34} />
            <h3>No Maintenance Access</h3>
            <p>Please contact Company Admin to enable Sales or Projects access.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{maintenanceStyles}</style>

      <div className="maintenance-page">
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
              <Wrench size={22} />
            </div>

            <div>
              <h1>Maintenance</h1>
              <p>
                Raise issues for delivered/completed projects or create internal
                company maintenance issues.
              </p>
            </div>
          </div>

          <div className="header-actions">
            <span className="count-pill">
              {loading ? "Loading..." : `${filteredIssues.length} Issues`}
            </span>

            <button type="button" className="refresh-button" onClick={fetchAll}>
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
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
              onClick={() =>
                setNotification({
                  type: "",
                  message: "",
                })
              }
            >
              <X size={15} />
            </button>
          </div>
        )}

        <section className="summary-grid">
          <div className="summary-card">
            <div className="summary-icon red">
              <ShieldAlert size={20} />
            </div>

            <div>
              <span>Total Issues</span>
              <strong>{issueSummary.total}</strong>
              <p>All maintenance issues</p>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-icon orange">
              <AlertTriangle size={20} />
            </div>

            <div>
              <span>Open</span>
              <strong>{issueSummary.open}</strong>
              <p>New issues</p>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-icon blue">
              <Settings2 size={20} />
            </div>

            <div>
              <span>In Progress</span>
              <strong>{issueSummary.inProgress}</strong>
              <p>Currently being fixed</p>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-icon green">
              <CheckCircle2 size={20} />
            </div>

            <div>
              <span>Fixed / Closed</span>
              <strong>{issueSummary.fixed + issueSummary.closed}</strong>
              <p>Resolved issues</p>
            </div>
          </div>
        </section>

        <section className="maintenance-layout">
          <form className="issue-form-card" onSubmit={handleCreateIssue}>
            <div className="card-title-row">
              <div className="card-title-icon">
                <Wrench size={19} />
              </div>

              <div>
                <h2>Raise Issue</h2>
                <p>Create maintenance issue from project or internal company work.</p>
              </div>
            </div>

            <div className="issue-type-switch">
              <button
                type="button"
                className={form.issue_type === "project_issue" ? "active" : ""}
                onClick={() =>
                  handleFormChange({
                    target: {
                      name: "issue_type",
                      value: "project_issue",
                    },
                  })
                }
              >
                Project Issue
              </button>

              <button
                type="button"
                className={form.issue_type === "company_issue" ? "active" : ""}
                onClick={() =>
                  handleFormChange({
                    target: {
                      name: "issue_type",
                      value: "company_issue",
                    },
                  })
                }
              >
                Company Issue
              </button>
            </div>

            <div className="form-grid">
              {form.issue_type === "project_issue" && (
                <div className="form-group full-span">
                  <label>Choose Delivered / Completed Project *</label>
                  <select
                    name="project_id"
                    value={form.project_id}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="">Select project</option>

                    {availableProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title} | {project.client_name || "No client"} |{" "}
                        {formatLabel(project.status)}
                      </option>
                    ))}
                  </select>

                  {availableProjects.length === 0 && (
                    <small>
                      No delivered/completed project found. First deliver or
                      complete a project.
                    </small>
                  )}
                </div>
              )}

              <div className="form-group">
                <label>Issue Title *</label>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleFormChange}
                  placeholder="Example: Login page not opening"
                  required
                />
              </div>

              <div className="form-group">
                <label>Priority</label>
                <select
                  name="priority"
                  value={form.priority}
                  onChange={handleFormChange}
                >
                  {ISSUE_PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority} value={priority}>
                      {formatLabel(priority)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group full-span">
                <label>Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleFormChange}
                  placeholder="Explain the problem clearly"
                />
              </div>

              <div className="form-group full-span">
                <label>Remarks</label>
                <textarea
                  name="remarks"
                  value={form.remarks}
                  onChange={handleFormChange}
                  placeholder="Internal remarks"
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={resetForm}
                disabled={saving}
              >
                Clear
              </button>

              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? "Saving..." : "Raise Issue"}
              </button>
            </div>
          </form>

          <div className="issue-list-card">
            <div className="list-header">
              <div>
                <h2>Maintenance Issues</h2>
                <p>Track open, in-progress, fixed, and closed issues.</p>
              </div>
            </div>

            <div className="filter-row">
              <div className="search-box">
                <Search size={17} />
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search issue, project, client..."
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">All Status</option>
                {ISSUE_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {formatLabel(status)}
                  </option>
                ))}
              </select>

              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
              >
                <option value="">All Priority</option>
                {ISSUE_PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority} value={priority}>
                    {formatLabel(priority)}
                  </option>
                ))}
              </select>

              <button type="button" onClick={clearFilters}>
                Clear
              </button>
            </div>

            {filteredIssues.length === 0 ? (
              <div className="empty-issue-list">
                <ClipboardList size={32} />
                <h3>No issue found</h3>
                <p>Raise a maintenance issue or change filters.</p>
              </div>
            ) : (
              <div className="issue-list">
                {filteredIssues.map((issue) => {
                  const linkedProject = issue.project_id
                    ? projectsMap.get(Number(issue.project_id))
                    : null;

                  const status = normalizeStatus(issue.status);
                  const priority = normalizeStatus(issue.priority, "medium");

                  return (
                    <article className="issue-row" key={issue.id}>
                      <div className="issue-main">
                        <div className="issue-title-row">
                          <h3>{issue.title}</h3>

                          <span className={`status-badge status-${status}`}>
                            {formatLabel(status)}
                          </span>

                          <span className={`priority-badge priority-${priority}`}>
                            {formatLabel(priority)}
                          </span>
                        </div>

                        <p>{issue.description || "No description added."}</p>

                        <div className="issue-meta">
                          <span>
                            {linkedProject
                              ? `Project: ${linkedProject.title}`
                              : "Company Issue"}
                          </span>

                          {linkedProject?.client_name && (
                            <span>Client: {linkedProject.client_name}</span>
                          )}

                          <span>
                            Created:{" "}
                            {issue.created_at
                              ? new Date(issue.created_at).toLocaleDateString("en-IN")
                              : "-"}
                          </span>
                        </div>

                        {issue.remarks && <small>{issue.remarks}</small>}
                      </div>

                      <div className="issue-actions">
                        {status === "open" && (
                          <button
                            type="button"
                            className="progress-button"
                            onClick={() =>
                              handleUpdateIssueStatus(issue, "in-progress")
                            }
                            disabled={saving}
                          >
                            Start Fix
                          </button>
                        )}

                        {["open", "in-progress"].includes(status) && (
                          <button
                            type="button"
                            className="fixed-button"
                            onClick={() => handleUpdateIssueStatus(issue, "fixed")}
                            disabled={saving}
                          >
                            Mark Fixed
                          </button>
                        )}

                        {status !== "closed" && (
                          <button
                            type="button"
                            className="close-button"
                            onClick={() => handleUpdateIssueStatus(issue, "closed")}
                            disabled={saving}
                          >
                            Close
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

const maintenanceStyles = `
.maintenance-page {
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
  border: 1px solid #fed7aa;
  background: #ffffff;
  color: #ea580c;
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
  color: #ea580c;
  background: #fff7ed;
  border: 1px solid #fed7aa;
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

.count-pill {
  height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #334155;
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  font-weight: 800;
}

.refresh-button {
  height: 40px;
  padding: 0 14px;
  border: none;
  border-radius: 13px;
  background: #ea580c;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 800;
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

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.summary-card {
  min-height: 118px;
  padding: 17px;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid var(--erp-border, #e2e8f0);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.05);
  display: flex;
  align-items: center;
  gap: 14px;
}

.summary-icon {
  width: 46px;
  height: 46px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.summary-icon.red {
  color: #dc2626;
  background: #fef2f2;
}

.summary-icon.orange {
  color: #ea580c;
  background: #fff7ed;
}

.summary-icon.blue {
  color: #2563eb;
  background: #eff6ff;
}

.summary-icon.green {
  color: #059669;
  background: #ecfdf5;
}

.summary-card span {
  display: block;
  color: #64748b;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.summary-card strong {
  display: block;
  margin-top: 7px;
  color: #06142b;
  font-size: 21px;
  font-weight: 900;
}

.summary-card p {
  margin: 5px 0 0;
  color: #52677e;
  font-size: 12px;
  font-weight: 600;
}

.maintenance-layout {
  display: grid;
  grid-template-columns: minmax(380px, 0.78fr) minmax(560px, 1.22fr);
  gap: 18px;
  align-items: start;
}

.issue-form-card,
.issue-list-card {
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid var(--erp-border, #e2e8f0);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.055);
}

.issue-form-card {
  padding: 18px;
}

.issue-list-card {
  overflow: hidden;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.card-title-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: #ea580c;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  flex-shrink: 0;
}

.card-title-row h2,
.list-header h2 {
  margin: 0;
  color: #06142b;
  font-size: 21px;
  font-weight: 800;
}

.card-title-row p,
.list-header p {
  margin: 6px 0 0;
  color: #52677e;
  font-size: 12px;
  font-weight: 500;
}

.issue-type-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 15px;
}

.issue-type-switch button {
  min-height: 42px;
  border-radius: 14px;
  border: 1px solid #dbe5f2;
  background: #ffffff;
  color: #0f172a;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.issue-type-switch button.active {
  border-color: #fed7aa;
  background: #fff7ed;
  color: #ea580c;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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
  font-weight: 800;
}

.form-group input,
.form-group select,
.form-group textarea,
.search-box input,
.filter-row select {
  width: 100%;
  min-height: 40px;
  border-radius: 13px;
  border: 1px solid #dbe5f2;
  background: #ffffff;
  color: #0f172a;
  padding: 9px 12px;
  font-size: 13px;
  outline: none;
  font-family: inherit;
}

.form-group textarea {
  min-height: 92px;
  resize: vertical;
}

.form-group small {
  color: #ea580c;
  font-size: 12px;
  font-weight: 700;
}

.full-span {
  grid-column: span 2;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

.primary-button,
.secondary-button {
  min-width: 135px;
  height: 42px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.primary-button {
  border: none;
  background: #ea580c;
  color: #ffffff;
}

.secondary-button {
  border: 1px solid #dbe5f2;
  background: #ffffff;
  color: #0f172a;
}

.primary-button:disabled,
.secondary-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.list-header {
  padding: 18px 20px;
  border-bottom: 1px solid #eef2f7;
}

.filter-row {
  padding: 14px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #eef2f7;
  display: grid;
  grid-template-columns: minmax(230px, 1fr) 150px 150px 82px;
  gap: 10px;
}

.search-box {
  min-height: 40px;
  border-radius: 13px;
  border: 1px solid #dbe5f2;
  background: #ffffff;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 11px;
}

.search-box svg {
  color: #64748b;
  flex-shrink: 0;
}

.search-box input {
  border: none;
  padding: 0;
  min-height: 38px;
}

.filter-row button {
  height: 40px;
  border-radius: 13px;
  border: 1px solid #dbe5f2;
  background: #ffffff;
  color: #0f172a;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.issue-list {
  max-height: 690px;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 11px;
}

.issue-row {
  min-height: 112px;
  padding: 14px;
  border-radius: 17px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.issue-main {
  flex: 1;
  min-width: 0;
}

.issue-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.issue-title-row h3 {
  margin: 0;
  color: #06142b;
  font-size: 15px;
  font-weight: 900;
}

.issue-main p {
  margin: 8px 0 0;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.45;
}

.issue-main small {
  display: block;
  margin-top: 8px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.issue-meta {
  margin-top: 9px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.issue-meta span {
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #475569;
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 800;
}

.status-badge,
.priority-badge {
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 900;
}

.status-open {
  color: #dc2626;
  background: #fef2f2;
}

.status-in-progress {
  color: #2563eb;
  background: #eff6ff;
}

.status-fixed,
.status-closed {
  color: #059669;
  background: #ecfdf5;
}

.priority-low {
  color: #059669;
  background: #ecfdf5;
}

.priority-medium {
  color: #2563eb;
  background: #eff6ff;
}

.priority-high {
  color: #ea580c;
  background: #fff7ed;
}

.priority-urgent {
  color: #dc2626;
  background: #fef2f2;
}

.issue-actions {
  min-width: 130px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.issue-actions button {
  height: 36px;
  border: none;
  border-radius: 12px;
  color: #ffffff;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.progress-button {
  background: #2563eb;
}

.fixed-button {
  background: #059669;
}

.close-button {
  background: #475569;
}

.issue-actions button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.empty-issue-list,
.empty-state-card {
  min-height: 280px;
  padding: 34px 20px;
  color: #ea580c;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  text-align: center;
  gap: 10px;
  background: #ffffff;
}

.empty-issue-list h3,
.empty-state-card h3 {
  margin: 0;
  color: #06142b;
  font-size: 18px;
  font-weight: 800;
}

.empty-issue-list p,
.empty-state-card p {
  max-width: 380px;
  margin: 0;
  color: #52677e;
  font-size: 13px;
  font-weight: 500;
}

.empty-state-card {
  border-radius: 20px;
  border: 1px solid var(--erp-border, #e2e8f0);
}

@media (max-width: 1400px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .maintenance-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    justify-content: flex-start;
  }

  .filter-row {
    grid-template-columns: 1fr;
  }

  .issue-row {
    flex-direction: column;
  }

  .issue-actions {
    width: 100%;
    min-width: 0;
    flex-direction: row;
    flex-wrap: wrap;
  }

  .issue-actions button {
    flex: 1;
    min-width: 120px;
  }
}

@media (max-width: 640px) {
  .summary-grid,
  .form-grid,
  .issue-type-switch {
    grid-template-columns: 1fr;
  }

  .full-span {
    grid-column: span 1;
  }

  .form-actions {
    flex-direction: column;
  }

  .primary-button,
  .secondary-button,
  .count-pill,
  .refresh-button {
    width: 100%;
  }
}
`;