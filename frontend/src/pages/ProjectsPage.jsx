import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  Clock,
  IndianRupee,
  Plus,
  PlusCircle,
  Search,
  Trash2,
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
  "ongoing",
  "in-progress",
  "delivered",
  "completed",
  "cancelled",
];

const SERVICE_OPTIONS = [
  { value: "custom_software", label: "Custom Software" },
  { value: "existing_software", label: "Existing Software" },
  { value: "website", label: "Website" },
  { value: "mobile_app", label: "Mobile App" },
  { value: "social_media_management", label: "Social Media Management" },
  { value: "internal_project", label: "Internal Project" },
  { value: "maintenance", label: "Maintenance / Support" },
  { value: "other", label: "Other" },
];

const PRIORITIES = ["low", "medium", "high", "urgent"];

const ITEMS_PER_PAGE = 20;

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

const normalizeStatus = (value, fallback = "ongoing") => {
  if (!value) return fallback;
  return String(value).trim().toLowerCase().replaceAll("_", "-");
};

const normalizeType = (value) => {
  if (!value) return "custom_software";

  return String(value)
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const getEmptyProjectForm = () => ({
  source_type: "own_company",
  lead_id: "",
  assigned_to_user_id: "",
  title: "Own Company Project",
  description: "",
  project_type: "internal_project",
  priority: "medium",
  project_amount: "",
  recurring_amount: "",
  recurring_cycle: "",
  start_date: new Date().toISOString().slice(0, 10),
  due_date: "",
  admin_remarks: "",
});

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [projects, setProjects] = useState([]);
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [activeView, setActiveView] = useState("");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectForm, setProjectForm] = useState(getEmptyProjectForm());

  const isAdminUser = ADMIN_ROLES.includes(user?.role);
  const canManageProjects = isAdminUser || user?.role === "manager";

  const assignableUsers = useMemo(() => {
    return users.filter((item) =>
      [
        "employee",
        "intern",
        "manager",
        "sales-representative",
        "freelancer",
        "hr",
        "company-admin",
      ].includes(item.role)
    );
  }, [users]);

  const convertedLeads = useMemo(() => {
    return leads.filter((lead) => {
      const status = normalizeStatus(lead.status, "new");
      return status === "converted" && !lead.project_created;
    });
  }, [leads]);

  const summary = useMemo(() => {
    const active = projects.filter((item) =>
      ["ongoing", "in-progress"].includes(normalizeStatus(item.status))
    ).length;

    const delivered = projects.filter(
      (item) => normalizeStatus(item.status) === "delivered"
    ).length;

    const completed = projects.filter(
      (item) => normalizeStatus(item.status) === "completed"
    ).length;

    const cancelled = projects.filter(
      (item) => normalizeStatus(item.status) === "cancelled"
    ).length;

    const totalAmount = projects.reduce(
      (sum, item) => sum + Number(item.project_amount || 0),
      0
    );

    return {
      total: projects.length,
      active,
      delivered,
      completed,
      cancelled,
      totalAmount,
    };
  }, [projects]);

  const projectModules = useMemo(() => {
    return [
      {
        key: "active",
        title: "Active Projects",
        description: "Ongoing and in-progress client or company work.",
        count: summary.active,
        icon: Clock,
        tone: "blue",
      },
      {
        key: "delivered",
        title: "Delivered",
        description: "Projects delivered but not finally completed.",
        count: summary.delivered,
        icon: CheckCircle2,
        tone: "green",
      },
      {
        key: "completed",
        title: "Completed / Cancelled",
        description: "Closed projects and cancelled records.",
        count: summary.completed + summary.cancelled,
        icon: ClipboardList,
        tone: "purple",
      },
      {
        key: "all",
        title: "All Projects",
        description: "View every project in one list with filters.",
        count: summary.total,
        icon: BriefcaseBusiness,
        tone: "orange",
      },
    ];
  }, [summary]);

  const activeModule = useMemo(() => {
    return projectModules.find((item) => item.key === activeView) || null;
  }, [projectModules, activeView]);

  const filteredProjects = useMemo(() => {
    if (!activeView) return [];

    const search = searchText.trim().toLowerCase();

    return projects.filter((project) => {
      const status = normalizeStatus(project.status);
      const type = normalizeType(project.project_type);

      const viewMatch =
        activeView === "active"
          ? ["ongoing", "in-progress"].includes(status)
          : activeView === "delivered"
            ? status === "delivered"
            : activeView === "completed"
              ? ["completed", "cancelled"].includes(status)
              : true;

      const searchTarget = [
        project.title,
        project.description,
        project.project_type,
        project.status,
        project.priority,
        project.client_name,
        project.client_company_name,
        project.admin_remarks,
        project.submission_note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchMatch = search ? searchTarget.includes(search) : true;
      const statusMatch = statusFilter ? status === statusFilter : true;
      const typeMatch = typeFilter ? type === typeFilter : true;

      return viewMatch && searchMatch && statusMatch && typeMatch;
    });
  }, [projects, activeView, searchText, statusFilter, typeFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProjects.length / ITEMS_PER_PAGE)
  );

  const paginatedProjects = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProjects.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProjects, currentPage]);

  const pageStart = filteredProjects.length
    ? (currentPage - 1) * ITEMS_PER_PAGE + 1
    : 0;

  const pageEnd = Math.min(currentPage * ITEMS_PER_PAGE, filteredProjects.length);

  const fetchProjects = async () => {
    try {
      const response = await api.get("/sales/projects");
      setProjects(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      alert(error?.response?.data?.detail || "Failed to load projects");
    }
  };

  const fetchLeads = async () => {
    try {
      const response = await api.get("/sales/leads");
      setLeads(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Converted leads loading error:", error);
    }
  };

  const fetchUsers = async () => {
    if (!isAdminUser) return;

    try {
      const response = await api.get("/users");
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Users loading error:", error);
    }
  };

  const fetchAll = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchProjects(), fetchLeads(), fetchUsers()]);
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
  }, [activeView, searchText, statusFilter, typeFilter]);

  const clearFilters = () => {
    setSearchText("");
    setStatusFilter("");
    setTypeFilter("");
    setCurrentPage(1);
  };

  const openProjectModule = (moduleKey) => {
    setActiveView(moduleKey);
    clearFilters();
  };

  const backToModules = () => {
    setActiveView("");
    clearFilters();
  };

  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const updateProjectField = (event) => {
    const { name, value } = event.target;

    setProjectForm((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      if (name === "source_type") {
        if (value === "own_company") {
          return {
            ...getEmptyProjectForm(),
            source_type: "own_company",
            title: "Own Company Project",
            project_type: "internal_project",
          };
        }

        return {
          ...getEmptyProjectForm(),
          source_type: "converted_lead",
          title: "",
          project_type: "custom_software",
        };
      }

      if (name === "lead_id") {
        const foundLead = convertedLeads.find(
          (lead) => String(lead.id) === String(value)
        );

        if (foundLead) {
          const leadType = normalizeType(
            foundLead.service_type || foundLead.service_interest
          );

          return {
            ...next,
            title: `${foundLead.client_name} - ${formatLabel(leadType)}`,
            description: foundLead.notes || "",
            project_type: leadType,
            priority: foundLead.priority || "medium",
            project_amount:
              foundLead.final_sale_amount ||
              foundLead.proposal_amount ||
              foundLead.expected_value ||
              "",
            recurring_amount: foundLead.recurring_amount || "",
            recurring_cycle: foundLead.recurring_cycle || "",
          };
        }
      }

      return next;
    });
  };

  const openProjectModal = (sourceType = "own_company") => {
    if (sourceType === "converted_lead") {
      setProjectForm({
        ...getEmptyProjectForm(),
        source_type: "converted_lead",
        title: "",
        project_type: "custom_software",
      });
    } else {
      setProjectForm(getEmptyProjectForm());
    }

    setShowProjectModal(true);
  };

  const closeProjectModal = () => {
    setProjectForm(getEmptyProjectForm());
    setShowProjectModal(false);
  };

  const handleCreateProject = async (event) => {
    event.preventDefault();

    if (!canManageProjects) {
      alert("You do not have permission to start projects");
      return;
    }

    if (!projectForm.title.trim()) {
      alert("Project title is required");
      return;
    }

    if (projectForm.source_type === "converted_lead" && !projectForm.lead_id) {
      alert("Select converted lead");
      return;
    }

    try {
      setSaving(true);

      const selectedLead = projectForm.lead_id
        ? convertedLeads.find(
            (lead) => String(lead.id) === String(projectForm.lead_id)
          )
        : null;

      const payload = {
        lead_id: projectForm.lead_id ? Number(projectForm.lead_id) : null,
        assigned_to_user_id: projectForm.assigned_to_user_id
          ? Number(projectForm.assigned_to_user_id)
          : null,
        title: projectForm.title.trim(),
        description: projectForm.description.trim() || null,
        project_type: normalizeType(projectForm.project_type),
        priority: projectForm.priority,
        status: "ongoing",
        client_name:
          selectedLead?.client_name ||
          (projectForm.source_type === "own_company" ? "AeroState Lab" : null),
        client_company_name:
          selectedLead?.client_company_name ||
          (projectForm.source_type === "own_company" ? "AeroState Lab" : null),
        project_amount: projectForm.project_amount
          ? Number(projectForm.project_amount)
          : 0,
        recurring_amount: projectForm.recurring_amount
          ? Number(projectForm.recurring_amount)
          : null,
        recurring_cycle: projectForm.recurring_cycle || null,
        start_date: projectForm.start_date || null,
        due_date: projectForm.due_date || null,
        admin_remarks: projectForm.admin_remarks.trim() || null,
      };

      if (projectForm.source_type === "converted_lead" && projectForm.lead_id) {
        await api.post(
          `/sales/leads/${projectForm.lead_id}/create-project`,
          payload
        );
      } else {
        await api.post("/sales/projects", payload);
      }

      closeProjectModal();
      setActiveView("active");
      await fetchAll();

      alert("Project started successfully");
    } catch (error) {
      alert(error?.response?.data?.detail || "Failed to start project");
    } finally {
      setSaving(false);
    }
  };

  const handleProjectStatusUpdate = async (project, nextStatus) => {
    try {
      await api.put(`/sales/projects/${project.id}/status`, {
        status: nextStatus,
        admin_remarks: project.admin_remarks || null,
      });

      await fetchAll();
    } catch (error) {
      alert(error?.response?.data?.detail || "Failed to update project status");
    }
  };

  const handleDeleteProject = async (projectId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this project?"
    );

    if (!confirmDelete) return;

    try {
      await api.delete(`/sales/projects/${projectId}`);
      await fetchAll();
      alert("Project deleted successfully");
    } catch (error) {
      alert(error?.response?.data?.detail || "Failed to delete project");
    }
  };

  const renderProjectRow = (project) => {
    const status = normalizeStatus(project.status);
    const type = normalizeType(project.project_type);

    return (
      <article className="project-row" key={project.id}>
        <div className="project-main-cell">
          <div className="project-avatar">
            {(project.title || "P").charAt(0).toUpperCase()}
          </div>

          <div className="project-title-wrap">
            <h3>{project.title}</h3>
            <p>
              {project.client_company_name ||
                project.client_name ||
                "Own Company"}
            </p>
          </div>
        </div>

        <div className="project-detail-cell">
          <span>Type</span>
          <strong>{formatLabel(type)}</strong>
          <small>{formatLabel(project.priority || "medium")} Priority</small>
        </div>

        <div className="project-detail-cell">
          <span>Amount</span>
          <strong>{formatCurrency(project.project_amount || 0)}</strong>
          <small>
            Recurring:{" "}
            {project.recurring_amount
              ? `${formatCurrency(project.recurring_amount)} / ${formatLabel(
                  project.recurring_cycle
                )}`
              : "-"}
          </small>
        </div>

        <div className="project-detail-cell">
          <span>Timeline</span>
          <strong>{project.due_date || "-"}</strong>
          <small>Start: {project.start_date || "-"}</small>
        </div>

        <div className="project-status-cell">
          <span className={`status-pill status-${status}`}>
            {formatLabel(status)}
          </span>

          <select
            value={status}
            onChange={(event) =>
              handleProjectStatusUpdate(project, event.target.value)
            }
          >
            {PROJECT_STATUSES.map((item) => (
              <option key={item} value={item}>
                {formatLabel(item)}
              </option>
            ))}
          </select>
        </div>

        <div className="project-action-cell">
          <button
            type="button"
            className="task-button"
            onClick={() => navigate("/tasks")}
          >
            Tasks
          </button>

          {isAdminUser && (
            <button
              type="button"
              className="icon-danger-button"
              onClick={() => handleDeleteProject(project.id)}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </article>
    );
  };

  return (
    <>
      <style>{projectsPageStyles}</style>

      <div className="projects-page">
        <div className="page-header">
          <div className="page-title-wrap">
            <button
              type="button"
              className="back-button"
              onClick={() => (activeView ? backToModules() : navigate(-1))}
            >
              <ArrowLeft size={18} />
            </button>

            <div className="page-title-icon">
              <BriefcaseBusiness size={22} />
            </div>

            <div>
              <h1>{activeModule ? activeModule.title : "Projects"}</h1>
              <p>
                {activeModule
                  ? activeModule.description
                  : "Open a project module to manage active, delivered, and completed projects."}
              </p>
            </div>
          </div>

          <div className="header-actions">
            <span className="count-pill">
              {loading
                ? "Loading..."
                : activeModule
                  ? `${filteredProjects.length} Records`
                  : `${projects.length} Projects`}
            </span>

            {canManageProjects && (
              <>
                <button
                  type="button"
                  className="secondary-create-button"
                  onClick={() => openProjectModal("converted_lead")}
                >
                  <Plus size={17} />
                  From Lead
                </button>

                <button
                  type="button"
                  className="create-project-button"
                  onClick={() => openProjectModal("own_company")}
                >
                  <Plus size={17} />
                  Own Project
                </button>
              </>
            )}
          </div>
        </div>

        {!activeView && (
          <section className="pipeline-card">
            <div className="section-title-row">
              <div>
                <h2>Project Modules</h2>
                <p>Click any module to open its full project list.</p>
              </div>

              <span>{projectModules.length} modules</span>
            </div>

            <div className="pipeline-module-grid">
              {projectModules.map((module) => {
                const Icon = module.icon;

                return (
                  <button
                    key={module.key}
                    type="button"
                    className={`pipeline-module tone-${module.tone}`}
                    onClick={() => openProjectModule(module.key)}
                  >
                    <div className="module-left">
                      <div className="module-icon">
                        <Icon size={19} />
                      </div>

                      <div>
                        <h3>{module.title}</h3>
                        <p>{module.description}</p>
                      </div>
                    </div>

                    <div className="module-right">
                      <strong>{module.count}</strong>
                      <ArrowRight size={17} />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {activeView && (
          <>
            <section className="module-toolbar-card">
              <button
                type="button"
                className="back-to-modules"
                onClick={backToModules}
              >
                <ArrowLeft size={16} />
                Back to Project Modules
              </button>

              <div className="search-box">
                <Search size={18} />
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search project, client, company, type, status..."
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

                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                >
                  <option value="">All Types</option>
                  {SERVICE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
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

            <section className="projects-list-card">
              <div className="list-header">
                <div>
                  <h2>{activeModule?.title}</h2>
                  <p>
                    {loading
                      ? "Loading project data..."
                      : `Showing ${pageStart}-${pageEnd} of ${filteredProjects.length} projects`}
                  </p>
                </div>
              </div>

              <div className="project-table-head">
                <span>Project</span>
                <span>Type</span>
                <span>Amount</span>
                <span>Timeline</span>
                <span>Status</span>
                <span>Actions</span>
              </div>

              {filteredProjects.length === 0 ? (
                <div className="empty-state-card">
                  <BriefcaseBusiness size={34} />
                  <h3>No projects found</h3>
                  <p>
                    Start a project from a converted lead or create an own
                    company project.
                  </p>
                </div>
              ) : (
                <>
                  <div className="project-list">
                    {paginatedProjects.map((project) =>
                      renderProjectRow(project)
                    )}
                  </div>

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
                        Previous
                      </button>

                      <button
                        type="button"
                        onClick={goToNextPage}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>
          </>
        )}

        {showProjectModal && (
          <div
            className="project-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeProjectModal();
            }}
          >
            <form className="project-modal-card" onSubmit={handleCreateProject}>
              <div className="modal-header">
                <div className="card-title-row">
                  <div className="card-title-icon">
                    <PlusCircle size={19} />
                  </div>

                  <div>
                    <h2>Start Project</h2>
                    <p>
                      Create a project from converted lead or your own company
                      work.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="modal-close-button"
                  onClick={closeProjectModal}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="form-content-grid">
                <div className="form-group">
                  <label>Project Source</label>
                  <select
                    name="source_type"
                    value={projectForm.source_type}
                    onChange={updateProjectField}
                  >
                    <option value="own_company">Own Company Project</option>
                    <option value="converted_lead">Converted Lead</option>
                  </select>
                </div>

                {projectForm.source_type === "converted_lead" && (
                  <div className="form-group">
                    <label>Converted Lead</label>
                    <select
                      name="lead_id"
                      value={projectForm.lead_id}
                      onChange={updateProjectField}
                      required
                    >
                      <option value="">Select converted lead</option>
                      {convertedLeads.map((lead) => (
                        <option key={lead.id} value={lead.id}>
                          {lead.client_name} -{" "}
                          {lead.client_company_name || "No company"}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label>Project Title</label>
                  <input
                    name="title"
                    value={projectForm.title}
                    onChange={updateProjectField}
                    placeholder="Project title"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Project Type</label>
                  <select
                    name="project_type"
                    value={projectForm.project_type}
                    onChange={updateProjectField}
                  >
                    {SERVICE_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Assigned To</label>
                  <select
                    name="assigned_to_user_id"
                    value={projectForm.assigned_to_user_id}
                    onChange={updateProjectField}
                  >
                    <option value="">Select user</option>
                    {assignableUsers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.full_name || item.person?.full_name || item.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <select
                    name="priority"
                    value={projectForm.priority}
                    onChange={updateProjectField}
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {formatLabel(priority)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Project Amount</label>
                  <input
                    name="project_amount"
                    type="number"
                    value={projectForm.project_amount}
                    onChange={updateProjectField}
                    placeholder="Amount"
                  />
                </div>

                <div className="form-group">
                  <label>Recurring Amount</label>
                  <input
                    name="recurring_amount"
                    type="number"
                    value={projectForm.recurring_amount}
                    onChange={updateProjectField}
                    placeholder="Optional"
                  />
                </div>

                <div className="form-group">
                  <label>Recurring Cycle</label>
                  <select
                    name="recurring_cycle"
                    value={projectForm.recurring_cycle}
                    onChange={updateProjectField}
                  >
                    <option value="">None</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    name="start_date"
                    type="date"
                    value={projectForm.start_date}
                    onChange={updateProjectField}
                  />
                </div>

                <div className="form-group">
                  <label>Due Date</label>
                  <input
                    name="due_date"
                    type="date"
                    value={projectForm.due_date}
                    onChange={updateProjectField}
                  />
                </div>

                <div className="textarea-row">
                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      name="description"
                      value={projectForm.description}
                      onChange={updateProjectField}
                      placeholder="Project details"
                    />
                  </div>

                  <div className="form-group">
                    <label>Admin Remarks</label>
                    <textarea
                      name="admin_remarks"
                      value={projectForm.admin_remarks}
                      onChange={updateProjectField}
                      placeholder="Internal notes"
                    />
                  </div>
                </div>
              </div>

              <div className="form-actions-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeProjectModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving ? "Starting..." : "Start Project"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </>
  );
}

const projectsPageStyles = `
.projects-page {
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
  border: 1px solid #e2e8f0;
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
  cursor: pointer;
  flex-shrink: 0;
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

.create-project-button,
.secondary-create-button {
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
  font-weight: 800;
  cursor: pointer;
}

.secondary-create-button {
  background: #0f172a;
}

.pipeline-card,
.module-toolbar-card,
.projects-list-card {
  width: 100%;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.055);
}

.pipeline-card {
  padding: 18px;
}

.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.section-title-row h2 {
  margin: 0;
  color: #06142b;
  font-size: 21px;
  font-weight: 800;
}

.section-title-row p {
  margin: 6px 0 0;
  color: #334155;
  font-size: 13px;
  font-weight: 500;
}

.section-title-row span {
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: #eff6ff;
  color: #2563eb;
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.pipeline-module-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.pipeline-module {
  min-height: 98px;
  padding: 14px;
  border-radius: 17px;
  border: 1px solid #dbe5f2;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
  transition: 0.18s ease;
}

.pipeline-module:hover {
  transform: translateY(-1px);
  border-color: #bfdbfe;
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.08);
}

.module-left {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  min-width: 0;
}

.module-icon {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.tone-blue .module-icon {
  color: #2563eb;
  background: #eff6ff;
}

.tone-orange .module-icon {
  color: #ea580c;
  background: #fff7ed;
}

.tone-green .module-icon {
  color: #059669;
  background: #ecfdf5;
}

.tone-purple .module-icon {
  color: #7c3aed;
  background: #f5f3ff;
}

.pipeline-module h3 {
  margin: 0;
  color: #06142b;
  font-size: 14px;
  font-weight: 900;
}

.pipeline-module p {
  margin: 6px 0 0;
  color: #52677e;
  font-size: 11px;
  line-height: 1.35;
  font-weight: 500;
}

.module-right {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #94a3b8;
  flex-shrink: 0;
}

.module-right strong {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background: #f8fafc;
  color: #06142b;
  display: grid;
  place-items: center;
  font-size: 15px;
  font-weight: 900;
}

.module-toolbar-card {
  padding: 16px;
  display: grid;
  grid-template-columns: auto minmax(260px, 1fr) auto;
  gap: 14px;
  align-items: center;
}

.back-to-modules {
  height: 42px;
  padding: 0 13px;
  border-radius: 13px;
  border: 1px solid #dbeafe;
  background: #eff6ff;
  color: #2563eb;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
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
.project-status-cell select,
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
  font-weight: 800;
  cursor: pointer;
}

.projects-list-card {
  min-height: 560px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.list-header {
  min-height: 74px;
  padding: 18px 20px;
  border-bottom: 1px solid #eef2f7;
  display: flex;
  align-items: center;
}

.list-header h2 {
  margin: 0;
  color: #06142b;
  font-size: 21px;
  font-weight: 800;
}

.list-header p {
  margin: 6px 0 0;
  color: #52677e;
  font-size: 12px;
  font-weight: 500;
}

.project-table-head,
.project-row {
  display: grid;
  grid-template-columns: minmax(230px, 1.4fr) minmax(145px, 0.85fr) minmax(145px, 0.85fr) minmax(145px, 0.85fr) minmax(160px, 0.85fr) minmax(150px, 0.7fr);
  gap: 14px;
  align-items: center;
}

.project-table-head {
  min-height: 44px;
  padding: 0 16px;
  background: #f8fafc;
  border-bottom: 1px solid #eef2f7;
}

.project-table-head span {
  color: #64748b;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

.project-list {
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.project-row {
  min-height: 112px;
  padding: 14px;
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

.project-main-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.project-avatar {
  width: 46px;
  height: 46px;
  border-radius: 15px;
  background: linear-gradient(135deg, #2563eb, #0ea5e9);
  color: #ffffff;
  display: grid;
  place-items: center;
  font-size: 17px;
  font-weight: 900;
  flex-shrink: 0;
}

.project-title-wrap {
  min-width: 0;
}

.project-title-wrap h3 {
  margin: 0;
  color: #06142b;
  font-size: 15px;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-title-wrap p {
  margin: 5px 0 0;
  color: #52677e;
  font-size: 12px;
  font-weight: 600;
}

.project-detail-cell span {
  color: #64748b;
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
}

.project-detail-cell strong {
  display: block;
  margin-top: 5px;
  color: #0f172a;
  font-size: 13px;
  font-weight: 900;
}

.project-detail-cell small {
  display: block;
  margin-top: 5px;
  color: #64748b;
  font-size: 11px;
  font-weight: 600;
}

.project-status-cell {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.status-pill {
  height: 25px;
  padding: 0 10px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  width: max-content;
  font-size: 10px;
  font-weight: 900;
  border: 1px solid #e2e8f0;
  background: #f1f5f9;
  color: #334155;
}

.status-ongoing,
.status-in-progress {
  color: #ea580c;
  background: #fff7ed;
  border-color: #fed7aa;
}

.status-delivered,
.status-completed {
  color: #059669;
  background: #ecfdf5;
  border-color: #bbf7d0;
}

.status-cancelled {
  color: #dc2626;
  background: #fef2f2;
  border-color: #fecaca;
}

.project-action-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.task-button {
  height: 38px;
  padding: 0 13px;
  border-radius: 13px;
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #2563eb;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.icon-danger-button {
  width: 38px;
  height: 38px;
  border-radius: 13px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #dc2626;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.pagination-row {
  min-height: 62px;
  padding: 14px 20px;
  border-top: 1px solid #eef2f7;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pagination-row p {
  margin: 0;
  color: #52677e;
  font-size: 13px;
  font-weight: 600;
}

.pagination-actions {
  display: flex;
  gap: 10px;
}

.pagination-actions button {
  height: 38px;
  padding: 0 13px;
  border-radius: 13px;
  border: 1px solid #dbe5f2;
  background: #ffffff;
  color: #0f172a;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.pagination-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-state-card {
  flex: 1;
  min-height: 280px;
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
  font-weight: 800;
}

.empty-state-card p {
  max-width: 420px;
  margin: 0;
  color: #52677e;
  font-size: 13px;
  font-weight: 500;
}

.project-modal-backdrop {
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

.project-modal-card {
  width: min(940px, 100%);
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
  border-bottom: 1px solid #eef2f7;
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
}

.card-title-row h2 {
  margin: 0;
  color: #06142b;
  font-size: 21px;
  font-weight: 800;
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
  cursor: pointer;
}

.form-content-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 13px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.form-group label {
  color: #334155;
  font-size: 12px;
  font-weight: 800;
}

.form-group textarea {
  min-height: 104px;
  resize: vertical;
}

.textarea-row {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 13px;
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
  font-weight: 800;
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

@media (max-width: 1500px) {
  .project-table-head,
  .project-row {
    grid-template-columns: 1.4fr 1fr 1fr;
  }

  .project-action-cell {
    justify-content: flex-start;
  }
}

@media (max-width: 1280px) {
  .pipeline-module-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .module-toolbar-card {
    grid-template-columns: 1fr;
  }

  .toolbar-filters {
    flex-wrap: wrap;
  }

  .form-content-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .project-table-head {
    display: none;
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
  .create-project-button,
  .secondary-create-button {
    width: 100%;
    justify-content: center;
  }

  .pipeline-module-grid,
  .project-row,
  .form-content-grid,
  .textarea-row {
    grid-template-columns: 1fr;
  }

  .toolbar-filters {
    flex-direction: column;
  }

  .toolbar-filters select,
  .clear-filter-button,
  .back-to-modules {
    width: 100%;
    justify-content: center;
  }

  .project-action-cell {
    flex-direction: column;
    align-items: stretch;
  }

  .task-button,
  .icon-danger-button {
    width: 100%;
  }

  .project-modal-backdrop {
    align-items: flex-start;
    padding: 14px;
  }

  .project-modal-card {
    max-height: calc(100vh - 28px);
  }

  .pagination-row {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .pagination-actions {
    width: 100%;
  }

  .pagination-actions button {
    flex: 1;
  }
}
`;