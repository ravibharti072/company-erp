import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  IndianRupee,
  Plus,
  PlusCircle,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import api from "../api/api";
import { useAuth } from "../context/AuthContext";

const ADMIN_ROLES = [
  "super-admin",
  "company-admin",
  "hr",
  "manager",
  "accountant",
];

const PROJECT_STATUSES = [
  "assigned",
  "in-progress",
  "submitted",
  "approved",
  "completed",
  "cancelled",
];

const PAYMENT_STATUSES = ["pending", "approved", "paid", "cancelled"];

const PROJECTS_PER_PAGE = 20;

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

const normalizeStatus = (value) => {
  if (!value) return "assigned";
  return String(value).trim().toLowerCase().replaceAll("_", "-");
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const getProjectView = (status) => {
  const value = normalizeStatus(status);

  if (["completed", "cancelled"].includes(value)) {
    return "completed";
  }

  return "ongoing";
};

export default function FreelancersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [projects, setProjects] = useState([]);
  const [payments, setPayments] = useState([]);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [projectView, setProjectView] = useState("ongoing");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const [showCreateModal, setShowCreateModal] = useState(false);

  const [formData, setFormData] = useState({
    freelancer_user_id: "",
    title: "",
    description: "",
    project_amount: "",
    start_date: "",
    due_date: "",
    admin_remarks: "",
  });

  const [submissionData, setSubmissionData] = useState({});

  const isAdminUser = ADMIN_ROLES.includes(user?.role);
  const isFreelancer = user?.role === "freelancer";

  const freelancerUsers = useMemo(() => {
    return users.filter((item) => item.role === "freelancer");
  }, [users]);

  const usersMap = useMemo(() => {
    const map = new Map();

    users.forEach((item) => {
      map.set(item.id, item);
    });

    return map;
  }, [users]);

  function getUserName(userId) {
    const foundUser = usersMap.get(userId);

    if (!foundUser) return `User ID: ${userId}`;

    return foundUser.full_name || foundUser.person?.full_name || foundUser.email;
  }

  const summary = useMemo(() => {
    const totalProjects = projects.length;

    const ongoingProjects = projects.filter(
      (project) => getProjectView(project.status) === "ongoing"
    ).length;

    const submittedProjects = projects.filter(
      (project) => normalizeStatus(project.status) === "submitted"
    ).length;

    const completedProjects = projects.filter(
      (project) => normalizeStatus(project.status) === "completed"
    ).length;

    const totalAmount = projects.reduce(
      (total, project) => total + Number(project.project_amount || 0),
      0
    );

    const pendingPayments = payments.filter(
      (payment) => normalizeStatus(payment.status) === "pending"
    ).length;

    return {
      totalProjects,
      ongoingProjects,
      submittedProjects,
      completedProjects,
      totalAmount,
      pendingPayments,
    };
  }, [projects, payments]);

  const visibleProjects = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return projects.filter((project) => {
      const status = normalizeStatus(project.status);
      const viewMatch = getProjectView(status) === projectView;

      const searchTarget = [
        project.title,
        project.description,
        project.admin_remarks,
        project.submission_note,
        project.submission_link,
        project.payment_status,
        project.status,
        getUserName(project.freelancer_user_id),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchMatch = search ? searchTarget.includes(search) : true;
      const statusMatch = statusFilter ? status === statusFilter : true;

      return viewMatch && searchMatch && statusMatch;
    });
  }, [projects, projectView, searchText, statusFilter, usersMap]);

  const visiblePayments = useMemo(() => {
    if (!paymentFilter) return payments;

    return payments.filter(
      (payment) => normalizeStatus(payment.status) === paymentFilter
    );
  }, [payments, paymentFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(visibleProjects.length / PROJECTS_PER_PAGE)
  );

  const paginatedProjects = useMemo(() => {
    const startIndex = (currentPage - 1) * PROJECTS_PER_PAGE;
    return visibleProjects.slice(startIndex, startIndex + PROJECTS_PER_PAGE);
  }, [visibleProjects, currentPage]);

  const pageStart = visibleProjects.length
    ? (currentPage - 1) * PROJECTS_PER_PAGE + 1
    : 0;

  const pageEnd = Math.min(
    currentPage * PROJECTS_PER_PAGE,
    visibleProjects.length
  );

  const fetchUsers = async () => {
    if (!isAdminUser) return;

    try {
      const response = await api.get("/users");
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Users loading error:", error);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await api.get("/freelancers/projects");
      setProjects(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      alert(error?.response?.data?.detail || "Failed to load freelancer projects");
    }
  };

  const fetchPayments = async () => {
    try {
      const response = await api.get("/freelancers/payments");
      setPayments(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Freelancer payments loading error:", error);
    }
  };

  const fetchAll = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchUsers(), fetchProjects(), fetchPayments()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [projectView, searchText, statusFilter, projects.length]);

  const updateField = (event) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setFormData({
      freelancer_user_id: "",
      title: "",
      description: "",
      project_amount: "",
      start_date: "",
      due_date: "",
      admin_remarks: "",
    });
  };

  const closeCreateModal = () => {
    resetForm();
    setShowCreateModal(false);
  };

  const clearFilters = () => {
    setSearchText("");
    setStatusFilter("");
  };

  const getPaymentForProject = (projectId) => {
    return payments.find((payment) => payment.project_id === projectId);
  };

  const handleCreateProject = async (event) => {
    event.preventDefault();

    if (!isAdminUser) {
      alert("Only admin/HR/manager can create freelancer projects");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        freelancer_user_id: Number(formData.freelancer_user_id),
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        project_amount: Number(formData.project_amount),
        start_date: formData.start_date || null,
        due_date: formData.due_date || null,
        admin_remarks: formData.admin_remarks.trim() || null,
      };

      await api.post("/freelancers/projects", payload);

      closeCreateModal();
      setProjectView("ongoing");
      await fetchAll();

      alert("Freelancer project created successfully");
    } catch (error) {
      alert(error?.response?.data?.detail || "Failed to create project");
    } finally {
      setSaving(false);
    }
  };

  const handleProjectStatusUpdate = async (projectId, status) => {
    try {
      await api.put(`/freelancers/projects/${projectId}`, {
        status,
      });

      await fetchAll();
    } catch (error) {
      alert(error?.response?.data?.detail || "Failed to update project");
    }
  };

  const handleFreelancerSubmit = async (projectId) => {
    const data = submissionData[projectId] || {};

    try {
      await api.put(`/freelancers/projects/${projectId}`, {
        status: data.status || "submitted",
        submission_note: data.submission_note || null,
        submission_link: data.submission_link || null,
      });

      setSubmissionData((prev) => ({
        ...prev,
        [projectId]: {},
      }));

      await fetchAll();

      alert("Project submitted successfully");
    } catch (error) {
      alert(error?.response?.data?.detail || "Failed to submit project");
    }
  };

  const handleGeneratePayment = async (projectId) => {
    try {
      await api.post(`/freelancers/projects/${projectId}/generate-payment`, {
        remarks: "Payment generated from portal",
      });

      await fetchAll();

      alert("Payment generated successfully");
    } catch (error) {
      alert(error?.response?.data?.detail || "Failed to generate payment");
    }
  };

  const handlePaymentUpdate = async (paymentId, status) => {
    try {
      await api.put(`/freelancers/payments/${paymentId}`, {
        status,
        payment_date:
          status === "paid" ? new Date().toISOString().slice(0, 10) : null,
        payment_method: status === "paid" ? "UPI" : null,
        remarks:
          status === "paid"
            ? "Payment marked as paid from portal"
            : "Payment status updated from portal",
      });

      await fetchAll();

      alert("Payment updated successfully");
    } catch (error) {
      alert(error?.response?.data?.detail || "Failed to update payment");
    }
  };

  const handleDeleteProject = async (projectId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this project?"
    );

    if (!confirmDelete) return;

    try {
      await api.delete(`/freelancers/projects/${projectId}`);
      await fetchAll();
      alert("Project deleted successfully");
    } catch (error) {
      alert(error?.response?.data?.detail || "Failed to delete project");
    }
  };

  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <>
      <style>{freelancersPageStyles}</style>

      <div className="freelancers-page">
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
              <BriefcaseBusiness size={22} />
            </div>

            <div>
              <h1>Freelancer Projects</h1>
              <p>Assign freelancer work, track submissions, and manage payments.</p>
            </div>
          </div>

          <div className="header-actions">
            <span className="count-pill">
              {loading ? "Loading..." : `${projects.length} Projects`}
            </span>

            {isAdminUser && (
              <button
                type="button"
                className="create-project-button"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={17} />
                Create Project
              </button>
            )}
          </div>
        </div>

        <section className="summary-grid">
          <article className="summary-card summary-blue">
            <BriefcaseBusiness size={19} />
            <div>
              <p>Total Projects</p>
              <strong>{summary.totalProjects}</strong>
            </div>
          </article>

          <article className="summary-card summary-orange">
            <Clock size={19} />
            <div>
              <p>Ongoing</p>
              <strong>{summary.ongoingProjects}</strong>
            </div>
          </article>

          <article className="summary-card summary-purple">
            <Upload size={19} />
            <div>
              <p>Submitted</p>
              <strong>{summary.submittedProjects}</strong>
            </div>
          </article>

          <article className="summary-card summary-green">
            <CheckCircle2 size={19} />
            <div>
              <p>Completed</p>
              <strong>{summary.completedProjects}</strong>
            </div>
          </article>

          <article className="summary-card summary-dark">
            <IndianRupee size={19} />
            <div>
              <p>Total Amount</p>
              <strong>{formatCurrency(summary.totalAmount)}</strong>
            </div>
          </article>

          <article className="summary-card summary-red">
            <IndianRupee size={19} />
            <div>
              <p>Pending Pay</p>
              <strong>{summary.pendingPayments}</strong>
            </div>
          </article>
        </section>

        <section className="freelancer-tabs-card">
          <button
            type="button"
            className={
              projectView === "ongoing"
                ? "freelancer-tab active"
                : "freelancer-tab"
            }
            onClick={() => setProjectView("ongoing")}
          >
            <span>Ongoing Projects</span>
            <strong>{summary.ongoingProjects}</strong>
          </button>

          <button
            type="button"
            className={
              projectView === "completed"
                ? "freelancer-tab active completed"
                : "freelancer-tab"
            }
            onClick={() => setProjectView("completed")}
          >
            <span>Completed / Cancelled</span>
            <strong>
              {
                projects.filter(
                  (project) => getProjectView(project.status) === "completed"
                ).length
              }
            </strong>
          </button>
        </section>

        <section className="freelancer-toolbar-card">
          <div className="search-box">
            <Search size={18} />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search project, freelancer, description, payment..."
            />
          </div>

          <div className="toolbar-filters">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All Status</option>
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>

            <button type="button" className="clear-filter-button" onClick={clearFilters}>
              Clear
            </button>
          </div>
        </section>

        <section className="freelancer-list-card">
          <div className="list-header">
            <div>
              <h2>
                {projectView === "ongoing"
                  ? "Ongoing Freelancer Projects"
                  : "Completed Freelancer Projects"}
              </h2>
              <p>
                {loading
                  ? "Loading projects..."
                  : `Showing ${pageStart}-${pageEnd} of ${visibleProjects.length} projects`}
              </p>
            </div>
          </div>

          {paginatedProjects.length === 0 ? (
            <div className="empty-state-card">
              <BriefcaseBusiness size={32} />
              <h3>No freelancer projects found</h3>
              <p>Create a new project or clear filters to view records.</p>
            </div>
          ) : (
            <div className="project-card-grid">
              {paginatedProjects.map((project) => {
                const projectPayment = getPaymentForProject(project.id);
                const status = normalizeStatus(project.status);

                return (
                  <article className="project-card" key={project.id}>
                    <div className="project-card-header">
                      <div className="project-title-wrap">
                        <h3>{project.title}</h3>
                        <p>{project.description || "No description added"}</p>
                      </div>

                      <span className={`status-pill status-${status}`}>
                        {formatLabel(status)}
                      </span>
                    </div>

                    <div className="project-info-row">
                      <span>Freelancer</span>
                      <strong>{getUserName(project.freelancer_user_id)}</strong>
                    </div>

                    <div className="project-mini-grid">
                      <div>
                        <span>Amount</span>
                        <strong>{formatCurrency(project.project_amount)}</strong>
                      </div>

                      <div>
                        <span>Payment</span>
                        <strong>{formatLabel(project.payment_status)}</strong>
                      </div>
                    </div>

                    <div className="project-date-line">
                      <span>Start: {project.start_date || "-"}</span>
                      <span>Due: {project.due_date || "-"}</span>
                    </div>

                    <div className="project-note">
                      <p>
                        <strong>Note:</strong>{" "}
                        {project.submission_note ||
                          project.admin_remarks ||
                          "No note added"}
                      </p>
                    </div>

                    {project.submission_link && (
                      <a
                        className="submission-link"
                        href={project.submission_link}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open Submission Link
                      </a>
                    )}

                    {isFreelancer && (
                      <div className="freelancer-submit-box">
                        <select
                          value={submissionData[project.id]?.status || project.status}
                          onChange={(event) =>
                            setSubmissionData((prev) => ({
                              ...prev,
                              [project.id]: {
                                ...prev[project.id],
                                status: event.target.value,
                              },
                            }))
                          }
                        >
                          <option value="in-progress">In Progress</option>
                          <option value="submitted">Submitted</option>
                        </select>

                        <input
                          value={submissionData[project.id]?.submission_link || ""}
                          onChange={(event) =>
                            setSubmissionData((prev) => ({
                              ...prev,
                              [project.id]: {
                                ...prev[project.id],
                                submission_link: event.target.value,
                              },
                            }))
                          }
                          placeholder="Submission link"
                        />

                        <input
                          value={submissionData[project.id]?.submission_note || ""}
                          onChange={(event) =>
                            setSubmissionData((prev) => ({
                              ...prev,
                              [project.id]: {
                                ...prev[project.id],
                                submission_note: event.target.value,
                              },
                            }))
                          }
                          placeholder="Submission note"
                        />

                        <button
                          type="button"
                          className="submit-work-button"
                          onClick={() => handleFreelancerSubmit(project.id)}
                        >
                          Submit
                        </button>
                      </div>
                    )}

                    {isAdminUser && (
                      <div className="project-actions-row">
                        <select
                          value={status}
                          onChange={(event) =>
                            handleProjectStatusUpdate(project.id, event.target.value)
                          }
                        >
                          {PROJECT_STATUSES.map((item) => (
                            <option key={item} value={item}>
                              {formatLabel(item)}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          className="payment-generate-button"
                          onClick={() => handleGeneratePayment(project.id)}
                          disabled={Boolean(projectPayment)}
                        >
                          <IndianRupee size={16} />
                          {projectPayment ? "Generated" : "Payment"}
                        </button>

                        {!projectPayment && (
                          <button
                            type="button"
                            className="icon-danger-button"
                            onClick={() => handleDeleteProject(project.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    )}
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
        </section>

        <section className="payment-card">
          <div className="list-header payment-header">
            <div>
              <h2>Freelancer Payments</h2>
              <p>Total: {visiblePayments.length}</p>
            </div>

            <select
              value={paymentFilter}
              onChange={(event) => setPaymentFilter(event.target.value)}
            >
              <option value="">All Status</option>
              {PAYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </div>

          <div className="payment-list">
            {visiblePayments.length === 0 ? (
              <div className="empty-payment">No freelancer payments found</div>
            ) : (
              visiblePayments.slice(0, 10).map((payment) => (
                <div className="payment-row" key={payment.id}>
                  <div>
                    <strong>{getUserName(payment.freelancer_user_id)}</strong>
                    <span>Project #{payment.project_id}</span>
                  </div>

                  <div>
                    <strong>{formatCurrency(payment.amount)}</strong>
                    <span>Amount</span>
                  </div>

                  <div>
                    <strong>{payment.payment_date || "-"}</strong>
                    <span>{payment.payment_method || "No method"}</span>
                  </div>

                  <div>
                    {isAdminUser ? (
                      <select
                        value={payment.status}
                        onChange={(event) =>
                          handlePaymentUpdate(payment.id, event.target.value)
                        }
                      >
                        {PAYMENT_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {formatLabel(status)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`status-pill status-${payment.status}`}>
                        {formatLabel(payment.status)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {showCreateModal && (
          <div
            className="freelancer-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeCreateModal();
            }}
          >
            <form className="freelancer-modal-card" onSubmit={handleCreateProject}>
              <div className="modal-header">
                <div className="card-title-row">
                  <div className="card-title-icon">
                    <PlusCircle size={19} />
                  </div>

                  <div>
                    <h2>Create Freelancer Project</h2>
                    <p>Assign work to a freelancer and track submission/payment.</p>
                  </div>
                </div>

                <button
                  type="button"
                  className="modal-close-button"
                  onClick={closeCreateModal}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="form-content-grid">
                <div className="form-group">
                  <label>Freelancer</label>
                  <select
                    name="freelancer_user_id"
                    value={formData.freelancer_user_id}
                    onChange={updateField}
                    required
                  >
                    <option value="">Select freelancer</option>
                    {freelancerUsers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.full_name || item.person?.full_name || item.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Project Title</label>
                  <input
                    name="title"
                    value={formData.title}
                    onChange={updateField}
                    placeholder="Create homepage banner design"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Project Amount</label>
                  <input
                    name="project_amount"
                    type="number"
                    value={formData.project_amount}
                    onChange={updateField}
                    placeholder="3000"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    name="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={updateField}
                  />
                </div>

                <div className="form-group">
                  <label>Due Date</label>
                  <input
                    name="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={updateField}
                  />
                </div>

                <div className="form-group full-span">
                  <label>Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={updateField}
                    placeholder="Project details"
                  />
                </div>

                <div className="form-group full-span">
                  <label>Admin Remarks</label>
                  <textarea
                    name="admin_remarks"
                    value={formData.admin_remarks}
                    onChange={updateField}
                    placeholder="Remarks for freelancer"
                  />
                </div>
              </div>

              <div className="form-actions-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeCreateModal}
                >
                  Cancel
                </button>

                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </>
  );
}

const freelancersPageStyles = `
.freelancers-page {
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

.create-project-button {
  min-width: 140px;
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
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.18);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
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
  margin-top: 4px;
  color: #06142b;
  font-size: 21px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
}

.summary-blue svg {
  color: #2563eb;
  background: #eff6ff;
}

.summary-orange svg {
  color: #ea580c;
  background: #fff7ed;
}

.summary-purple svg {
  color: #7c3aed;
  background: #f5f3ff;
}

.summary-green svg {
  color: #059669;
  background: #ecfdf5;
}

.summary-dark svg {
  color: #0f172a;
  background: #f1f5f9;
}

.summary-red svg {
  color: #dc2626;
  background: #fef2f2;
}

.freelancer-tabs-card,
.freelancer-toolbar-card,
.freelancer-list-card,
.payment-card {
  width: 100%;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid var(--erp-border, #e2e8f0);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.055);
}

.freelancer-tabs-card {
  height: 66px;
  padding: 10px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  box-sizing: border-box;
}

.freelancer-tab {
  height: 46px;
  border-radius: 15px;
  border: 1px solid #dbe5f2;
  background: #ffffff;
  color: #334155;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  font-family: inherit;
  cursor: pointer;
}

.freelancer-tab span {
  font-size: 13px;
  font-weight: 800;
}

.freelancer-tab strong {
  min-width: 30px;
  height: 26px;
  padding: 0 9px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #0f172a;
  font-size: 13px;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.freelancer-tab.active {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #2563eb;
}

.freelancer-tab.active strong {
  background: #2563eb;
  color: #ffffff;
}

.freelancer-tab.active.completed {
  border-color: #bbf7d0;
  background: #ecfdf5;
  color: #059669;
}

.freelancer-tab.active.completed strong {
  background: #059669;
  color: #ffffff;
}

.freelancer-toolbar-card {
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
  width: 100%;
  border: none;
  min-height: 40px;
  padding: 0;
  outline: none;
  font-size: 13px;
  font-family: inherit;
}

.toolbar-filters {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar-filters select,
.payment-header select,
.project-actions-row select,
.freelancer-submit-box select,
.freelancer-submit-box input,
.payment-row select,
.form-group input,
.form-group select,
.form-group textarea {
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
}

.freelancer-list-card {
  min-height: 560px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.list-header {
  height: 74px;
  min-height: 74px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--erp-border-soft, #eef2f7);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  box-sizing: border-box;
}

.list-header h2 {
  margin: 0;
  color: #06142b;
  font-size: 21px;
  font-weight: 700;
}

.list-header p {
  margin: 6px 0 0;
  color: #52677e;
  font-size: 12px;
  font-weight: 500;
}

.project-card-grid {
  flex: 1;
  padding: 18px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-content: start;
  gap: 16px;
}

.project-card {
  position: relative;
  height: 342px;
  min-height: 342px;
  max-height: 342px;
  border-radius: 20px;
  border: 1px solid var(--erp-border, #e2e8f0);
  background: #ffffff;
  padding: 15px;
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.045);
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
  box-sizing: border-box;
}

.project-card-header {
  height: 44px;
  min-height: 44px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  overflow: hidden;
}

.project-title-wrap {
  min-width: 0;
}

.project-title-wrap h3 {
  margin: 0;
  color: #06142b;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-title-wrap p {
  margin: 5px 0 0;
  color: #52677e;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-pill {
  height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #334155;
  border: 1px solid #e2e8f0;
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
  flex-shrink: 0;
}

.status-assigned,
.status-in-progress,
.status-pending {
  color: #ea580c;
  background: #fff7ed;
  border-color: #fed7aa;
}

.status-submitted,
.status-approved {
  color: #2563eb;
  background: #eff6ff;
  border-color: #bfdbfe;
}

.status-completed,
.status-paid {
  color: #059669;
  background: #ecfdf5;
  border-color: #bbf7d0;
}

.status-cancelled {
  color: #dc2626;
  background: #fef2f2;
  border-color: #fecaca;
}

.project-info-row {
  height: 54px;
  min-height: 54px;
  padding: 9px 11px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
  overflow: hidden;
  box-sizing: border-box;
}

.project-info-row span,
.project-mini-grid span {
  display: block;
  color: #64748b;
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.project-info-row strong,
.project-mini-grid strong {
  display: block;
  margin-top: 5px;
  color: #0f172a;
  font-size: 12px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-mini-grid {
  height: 54px;
  min-height: 54px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}

.project-mini-grid div {
  height: 54px;
  padding: 9px 11px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
  overflow: hidden;
  box-sizing: border-box;
}

.project-date-line {
  height: 34px;
  min-height: 34px;
  padding: 7px 10px;
  border-radius: 13px;
  background: #ffffff;
  border: 1px solid #eef2f7;
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
}

.project-date-line span {
  color: #475569;
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}

.project-note {
  height: 40px;
  min-height: 40px;
  padding: 10px 11px;
  border-radius: 13px;
  background: #f8fbff;
  border: 1px solid #dbeafe;
  overflow: hidden;
  box-sizing: border-box;
}

.project-note p {
  margin: 0;
  color: #334155;
  font-size: 11px;
  line-height: 1.35;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-note strong {
  color: #2563eb;
  font-weight: 900;
}

.submission-link {
  height: 32px;
  min-height: 32px;
  border-radius: 12px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #2563eb;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  font-size: 12px;
  font-weight: 800;
}

.project-actions-row {
  margin-top: auto;
  min-height: 46px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 138px 40px;
  gap: 9px;
  align-items: center;
}

.payment-generate-button {
  height: 40px;
  border-radius: 13px;
  border: none;
  background: #2563eb;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.payment-generate-button:disabled {
  background: #f1f5f9;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.icon-danger-button {
  width: 40px;
  height: 40px;
  border-radius: 13px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #dc2626;
  display: inline-grid;
  place-items: center;
}

.freelancer-submit-box {
  margin-top: auto;
  min-height: 132px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  align-items: center;
}

.freelancer-submit-box select {
  grid-column: span 2;
}

.submit-work-button {
  height: 40px;
  border-radius: 13px;
  border: none;
  background: #2563eb;
  color: #ffffff;
  font-size: 12px;
  font-weight: 800;
}

.pagination-row {
  height: 62px;
  min-height: 62px;
  padding: 14px 20px;
  border-top: 1px solid var(--erp-border-soft, #eef2f7);
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
}

.pagination-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-state-card {
  flex: 1;
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
  max-width: 380px;
  margin: 0;
  color: #52677e;
  font-size: 13px;
  font-weight: 500;
}

.payment-card {
  overflow: hidden;
}

.payment-list {
  padding: 14px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.payment-row {
  min-height: 62px;
  padding: 12px 14px;
  border-radius: 15px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 150px;
  gap: 12px;
  align-items: center;
}

.payment-row strong {
  display: block;
  color: #0f172a;
  font-size: 13px;
  font-weight: 800;
}

.payment-row span {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-size: 11px;
  font-weight: 600;
}

.empty-payment {
  min-height: 84px;
  border-radius: 15px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  color: #64748b;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 700;
}

.freelancer-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(15, 23, 42, 0.48);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22px;
}

.freelancer-modal-card {
  width: min(980px, 100%);
  max-height: calc(100vh - 44px);
  overflow-y: auto;
  border-radius: 22px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 30px 80px rgba(15, 23, 42, 0.25);
  padding: 18px;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--erp-border-soft, #eef2f7);
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
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

.card-title-row h2 {
  margin: 0;
  color: #06142b;
  font-size: 21px;
  font-weight: 700;
}

.card-title-row p {
  margin: 6px 0 0;
  color: #52677e;
  font-size: 12px;
  font-weight: 500;
}

.modal-close-button {
  width: 40px;
  height: 40px;
  border-radius: 13px;
  border: 1px solid #dbe5f2;
  background: #ffffff;
  color: #0f172a;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.form-content-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
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

.form-group textarea {
  min-height: 86px;
  resize: vertical;
}

.full-span {
  grid-column: span 3;
}

.form-actions-row {
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
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
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

@media (min-width: 1700px) {
  .project-card-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 1500px) {
  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .project-card-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1280px) {
  .freelancer-toolbar-card {
    grid-template-columns: 1fr;
  }

  .toolbar-filters {
    flex-wrap: wrap;
  }

  .form-content-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .full-span {
    grid-column: span 2;
  }

  .payment-row {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 980px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .project-card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .project-actions-row {
    grid-template-columns: 1fr 1fr;
    min-height: 90px;
  }

  .project-actions-row select {
    grid-column: span 2;
  }

  .project-card {
    height: 380px;
    min-height: 380px;
    max-height: 380px;
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
    flex-direction: column;
    align-items: stretch;
  }

  .count-pill,
  .create-project-button {
    width: 100%;
    justify-content: center;
  }

  .summary-grid,
  .freelancer-tabs-card,
  .project-card-grid,
  .form-content-grid {
    grid-template-columns: 1fr;
  }

  .freelancer-tabs-card {
    height: auto;
  }

  .toolbar-filters {
    flex-direction: column;
    width: 100%;
  }

  .toolbar-filters select,
  .clear-filter-button {
    width: 100%;
  }

  .project-actions-row,
  .freelancer-submit-box {
    grid-template-columns: 1fr;
    min-height: 178px;
  }

  .project-actions-row select,
  .freelancer-submit-box select {
    grid-column: auto;
  }

  .project-card {
    height: auto;
    min-height: 390px;
    max-height: none;
  }

  .payment-generate-button,
  .icon-danger-button {
    width: 100%;
  }

  .pagination-row {
    flex-direction: column;
    align-items: stretch;
    height: auto;
  }

  .pagination-actions {
    width: 100%;
  }

  .pagination-actions button {
    flex: 1;
    justify-content: center;
  }

  .payment-row {
    grid-template-columns: 1fr;
  }

  .full-span {
    grid-column: span 1;
  }

  .freelancer-modal-backdrop {
    align-items: flex-start;
    padding: 14px;
  }

  .freelancer-modal-card {
    max-height: calc(100vh - 28px);
    border-radius: 18px;
  }

  .form-actions-row {
    flex-direction: column;
  }

  .primary-button,
  .secondary-button {
    width: 100%;
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

  .freelancer-toolbar-card {
    padding: 15px;
  }

  .list-header {
    padding: 16px;
  }

  .project-card-grid {
    padding: 12px;
  }

  .freelancer-modal-card {
    padding: 15px;
  }
}
`;