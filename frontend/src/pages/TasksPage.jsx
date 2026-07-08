import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Filter,
  Plus,
  PlusCircle,
  Save,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import api from "../api/api";
import { useAuth } from "../context/AuthContext";

const TASK_MANAGER_ROLES = ["super-admin", "company-admin", "hr", "manager"];

const TASK_STATUSES = ["pending", "in-progress", "completed"];

const PRIORITIES = ["low", "medium", "high", "urgent"];

const TASKS_PER_PAGE = 20;

const normalizeTaskStatus = (status) => {
  const value = String(status || "pending").trim().toLowerCase();

  if (value === "in_progress") return "in-progress";
  if (value === "submitted") return "completed";
  if (value === "done") return "completed";
  if (value === "complete") return "completed";

  return value;
};

const formatOptionLabel = (value) => {
  if (!value) return "";

  return String(value)
    .replaceAll("_", " ")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const getAllowedTaskStatuses = (currentStatus) => {
  const status = normalizeTaskStatus(currentStatus);

  if (status === "pending") {
    return [
      { value: "pending", label: "Pending" },
      { value: "in-progress", label: "In Progress" },
      { value: "completed", label: "Completed" },
    ];
  }

  if (status === "in-progress") {
    return [
      { value: "in-progress", label: "In Progress" },
      { value: "completed", label: "Completed" },
    ];
  }

  if (status === "completed") {
    return [{ value: "completed", label: "Completed" }];
  }

  return [
    { value: "pending", label: "Pending" },
    { value: "in-progress", label: "In Progress" },
    { value: "completed", label: "Completed" },
  ];
};

const canChangeTaskStatus = (oldStatus, newStatus) => {
  const statusOrder = {
    pending: 1,
    "in-progress": 2,
    completed: 3,
  };

  const oldValue = normalizeTaskStatus(oldStatus);
  const newValue = normalizeTaskStatus(newStatus);

  return statusOrder[newValue] >= statusOrder[oldValue];
};

const extractProjectLine = (value) => {
  if (!value) return "";

  const lines = String(value).split("\n");
  const projectLine = lines.find((line) =>
    line.trim().toLowerCase().startsWith("project:")
  );

  return projectLine ? projectLine.replace(/^project:/i, "").trim() : "";
};

const removeProjectLine = (value) => {
  if (!value) return "";

  return String(value)
    .split("\n")
    .filter((line) => !line.trim().toLowerCase().startsWith("project:"))
    .join("\n")
    .trim();
};

const getErrorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item?.msg || item?.message || "Validation error")
      .join(", ");
  }

  if (error?.response?.data?.message) {
    return error.response.data.message;
  }

  return fallback;
};

export default function TasksPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [taskView, setTaskView] = useState("ongoing");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [notification, setNotification] = useState({
    type: "",
    message: "",
  });

  const [deleteModal, setDeleteModal] = useState({
    open: false,
    task: null,
    loading: false,
  });

  const [formData, setFormData] = useState({
    project_id: "",
    assigned_to_user_id: "",
    title: "",
    description: "",
    priority: "medium",
    due_date: "",
    remarks: "",
  });

  const [submissionNotes, setSubmissionNotes] = useState({});

  const isTaskManager = TASK_MANAGER_ROLES.includes(user?.role);

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

  const usersMap = useMemo(() => {
    const map = new Map();

    users.forEach((item) => {
      map.set(item.id, item);
    });

    return map;
  }, [users]);

  const projectsMap = useMemo(() => {
    const map = new Map();

    projects.forEach((item) => {
      map.set(Number(item.id), item);
    });

    return map;
  }, [projects]);

  const assignableUsers = useMemo(() => {
    return users.filter((item) =>
      [
        "employee",
        "intern",
        "sales-representative",
        "freelancer",
        "manager",
        "hr",
        "company-admin",
      ].includes(item.role)
    );
  }, [users]);

  const activeProjects = useMemo(() => {
    return projects.filter((project) => {
      const status = String(project.status || "ongoing")
        .trim()
        .toLowerCase()
        .replaceAll("_", "-");

      return !["completed", "cancelled"].includes(status);
    });
  }, [projects]);

  const summary = useMemo(() => {
    const pending = tasks.filter(
      (task) => normalizeTaskStatus(task.status) === "pending"
    ).length;

    const inProgress = tasks.filter(
      (task) => normalizeTaskStatus(task.status) === "in-progress"
    ).length;

    const completed = tasks.filter(
      (task) => normalizeTaskStatus(task.status) === "completed"
    ).length;

    return {
      total: tasks.length,
      pending,
      inProgress,
      completed,
      ongoing: pending + inProgress,
    };
  }, [tasks]);

  const statusFilterOptions = useMemo(() => {
    if (taskView === "completed") {
      return ["completed"];
    }

    return TASK_STATUSES.filter((status) => status !== "completed");
  }, [taskView]);

  const getProjectName = (task) => {
    if (task.project_title) return task.project_title;
    if (task.project?.title) return task.project.title;

    if (task.project_id) {
      const project = projectsMap.get(Number(task.project_id));
      if (project) return project.title;
    }

    const fromRemarks = extractProjectLine(task.remarks);
    if (fromRemarks) return fromRemarks;

    return "-";
  };

  const filteredTasks = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return tasks.filter((task) => {
      const assignedUser = usersMap.get(task.assigned_to_user_id);
      const currentStatus = normalizeTaskStatus(task.status);
      const projectName = getProjectName(task);

      const viewMatch =
        taskView === "completed"
          ? currentStatus === "completed"
          : currentStatus !== "completed";

      const searchTarget = [
        task.title,
        task.description,
        task.priority,
        currentStatus,
        task.remarks,
        task.submission_note,
        task.due_date,
        projectName,
        assignedUser?.full_name,
        assignedUser?.person?.full_name,
        assignedUser?.email,
        assignedUser?.role,
        assignedUser?.department,
        assignedUser?.person?.department,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchMatch = search ? searchTarget.includes(search) : true;
      const statusMatch = statusFilter ? currentStatus === statusFilter : true;
      const priorityMatch = priorityFilter
        ? task.priority === priorityFilter
        : true;

      return viewMatch && searchMatch && statusMatch && priorityMatch;
    });
  }, [
    tasks,
    usersMap,
    projectsMap,
    searchText,
    statusFilter,
    priorityFilter,
    taskView,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTasks.length / TASKS_PER_PAGE)
  );

  const paginatedTasks = useMemo(() => {
    const startIndex = (currentPage - 1) * TASKS_PER_PAGE;
    return filteredTasks.slice(startIndex, startIndex + TASKS_PER_PAGE);
  }, [filteredTasks, currentPage]);

  const pageStart = filteredTasks.length
    ? (currentPage - 1) * TASKS_PER_PAGE + 1
    : 0;

  const pageEnd = Math.min(currentPage * TASKS_PER_PAGE, filteredTasks.length);

  const fetchUsers = async () => {
    if (!isTaskManager) return;

    try {
      const response = await api.get("/users");
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Users loading error:", error);
    }
  };

  const fetchProjects = async () => {
    if (!isTaskManager) return;

    try {
      const response = await api.get("/sales/projects");
      setProjects(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Projects loading error:", error);
      setProjects([]);
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);

      const response = await api.get("/tasks");

      setTasks(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      showNotification(
        "error",
        getErrorMessage(error, "Failed to load tasks")
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchAll = async () => {
    await Promise.all([fetchUsers(), fetchProjects(), fetchTasks()]);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, statusFilter, priorityFilter, taskView, tasks.length]);

  const updateField = (event) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setFormData({
      project_id: "",
      assigned_to_user_id: "",
      title: "",
      description: "",
      priority: "medium",
      due_date: "",
      remarks: "",
    });
  };

  const closeCreateModal = () => {
    resetForm();
    setShowCreateForm(false);
  };

  const changeTaskView = (nextView) => {
    setTaskView(nextView);
    setStatusFilter("");
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchText("");
    setStatusFilter("");
    setPriorityFilter("");
  };

  const handleCreateTask = async (event) => {
    event.preventDefault();

    if (!isTaskManager) {
      showNotification("error", "Only admin/HR/manager can create tasks.");
      return;
    }

    if (!formData.project_id) {
      showNotification(
        "error",
        "Please select project. Project is mandatory for every task."
      );
      return;
    }

    if (!formData.assigned_to_user_id) {
      showNotification("error", "Please select user.");
      return;
    }

    const selectedProject = projectsMap.get(Number(formData.project_id));

    if (!selectedProject) {
      showNotification(
        "error",
        "Selected project was not found. Refresh the page and try again."
      );
      return;
    }

    try {
      setSaving(true);

      const projectContext = `Project: ${selectedProject.title}${
        selectedProject.client_company_name
          ? ` | Company: ${selectedProject.client_company_name}`
          : ""
      }${
        selectedProject.project_type
          ? ` | Type: ${formatOptionLabel(selectedProject.project_type)}`
          : ""
      }`;

      const cleanedRemarks = formData.remarks.trim();

      const payload = {
        project_id: Number(formData.project_id),
        project_title: selectedProject.title,
        assigned_to_user_id: Number(formData.assigned_to_user_id),
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        priority: formData.priority,
        due_date: formData.due_date || null,
        remarks: [projectContext, cleanedRemarks].filter(Boolean).join("\n"),
      };

      await api.post("/tasks", payload);

      resetForm();
      setShowCreateForm(false);
      setTaskView("ongoing");
      await fetchTasks();

      showNotification("success", "Task created successfully.");
    } catch (error) {
      showNotification(
        "error",
        getErrorMessage(error, "Failed to create task")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (task, newStatus) => {
    const currentStatus = normalizeTaskStatus(task.status);
    const nextStatus = normalizeTaskStatus(newStatus);

    if (!canChangeTaskStatus(currentStatus, nextStatus)) {
      showNotification(
        "error",
        `Task status cannot be reverted from ${formatOptionLabel(
          currentStatus
        )} to ${formatOptionLabel(nextStatus)}.`
      );

      await fetchTasks();
      return;
    }

    try {
      const payload = {
        status: nextStatus,
      };

      const note = submissionNotes[task.id];

      if (note && note.trim()) {
        payload.submission_note = note.trim();
      }

      await api.put(`/tasks/${task.id}`, payload);

      setSubmissionNotes((prev) => ({
        ...prev,
        [task.id]: "",
      }));

      await fetchTasks();

      showNotification("success", "Task updated successfully.");
    } catch (error) {
      showNotification(
        "error",
        getErrorMessage(error, "Failed to update task")
      );
      await fetchTasks();
    }
  };

  const handleSaveSubmissionNote = async (task) => {
    await handleStatusUpdate(task, normalizeTaskStatus(task.status));
  };

  const openDeleteModal = (task) => {
    setDeleteModal({
      open: true,
      task,
      loading: false,
    });
  };

  const closeDeleteModal = () => {
    if (deleteModal.loading) return;

    setDeleteModal({
      open: false,
      task: null,
      loading: false,
    });
  };

  const handleConfirmDeleteTask = async () => {
    if (!deleteModal.task?.id) return;

    try {
      setDeleteModal((prev) => ({
        ...prev,
        loading: true,
      }));

      await api.delete(`/tasks/${deleteModal.task.id}`);
      await fetchTasks();

      setDeleteModal({
        open: false,
        task: null,
        loading: false,
      });

      showNotification("success", "Task deleted successfully.");
    } catch (error) {
      setDeleteModal((prev) => ({
        ...prev,
        loading: false,
      }));

      showNotification(
        "error",
        getErrorMessage(error, "Failed to delete task")
      );
    }
  };

  const getUserName = (userId) => {
    const foundUser = usersMap.get(userId);

    if (!foundUser) return `User ID: ${userId}`;

    return foundUser.full_name || foundUser.person?.full_name || foundUser.email;
  };

  const getUserSubtitle = (userId) => {
    const foundUser = usersMap.get(userId);

    if (!foundUser) return "-";

    const role = foundUser.role ? formatOptionLabel(foundUser.role) : "User";
    const department = foundUser.department || foundUser.person?.department;

    return `${role}${department ? ` • ${department}` : ""}`;
  };

  const getTaskNote = (task) => {
    const remarksWithoutProject = removeProjectLine(task.remarks);

    if (taskView === "completed") {
      return task.submission_note || remarksWithoutProject || "";
    }

    return remarksWithoutProject || task.submission_note || "";
  };

  const getTaskNoteLabel = (task) => {
    if (taskView === "completed" && task.submission_note) {
      return "Submission";
    }

    return "Note";
  };

  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <>
      <style>{tasksPageStyles}</style>

      <div className="tasks-page">
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
              <ClipboardList size={22} />
            </div>

            <div>
              <h1>Task Assignment</h1>
              <p>Assign work and track progress for your team.</p>
            </div>
          </div>

          {isTaskManager && (
            <button
              type="button"
              className="create-task-button"
              onClick={() => setShowCreateForm(true)}
            >
              <Plus size={17} />
              Create Task
            </button>
          )}
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

        <section className="summary-grid">
          <article className="summary-card summary-blue">
            <ClipboardList size={19} />
            <div>
              <p>Total Tasks</p>
              <strong>{summary.total}</strong>
            </div>
          </article>

          <article className="summary-card summary-orange">
            <Filter size={19} />
            <div>
              <p>Pending</p>
              <strong>{summary.pending}</strong>
            </div>
          </article>

          <article className="summary-card summary-purple">
            <CalendarDays size={19} />
            <div>
              <p>In Progress</p>
              <strong>{summary.inProgress}</strong>
            </div>
          </article>

          <article className="summary-card summary-green">
            <CheckCircle2 size={19} />
            <div>
              <p>Completed</p>
              <strong>{summary.completed}</strong>
            </div>
          </article>
        </section>

        <section className="task-view-tabs-card">
          <button
            type="button"
            className={
              taskView === "ongoing"
                ? "task-view-tab active"
                : "task-view-tab"
            }
            onClick={() => changeTaskView("ongoing")}
          >
            <span>Ongoing</span>
            <strong>{summary.ongoing}</strong>
          </button>

          <button
            type="button"
            className={
              taskView === "completed"
                ? "task-view-tab active completed"
                : "task-view-tab"
            }
            onClick={() => changeTaskView("completed")}
          >
            <span>Completed</span>
            <strong>{summary.completed}</strong>
          </button>
        </section>

        {isTaskManager && showCreateForm && (
          <div
            className="task-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeCreateModal();
              }
            }}
          >
            <form className="task-modal-card" onSubmit={handleCreateTask}>
              <div className="modal-header">
                <div className="card-title-row modal-title-row">
                  <div className="card-title-icon">
                    <PlusCircle size={19} />
                  </div>

                  <div>
                    <h2>Create Task</h2>
                    <p>Select a project first, then assign work to a software user.</p>
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
                <div className="form-group project-group">
                  <label>
                    Project <span>*</span>
                  </label>
                  <select
                    name="project_id"
                    value={formData.project_id}
                    onChange={updateField}
                    required
                  >
                    <option value="">Select project</option>
                    {activeProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                        {project.client_company_name
                          ? ` — ${project.client_company_name}`
                          : ""}
                        {project.project_type
                          ? ` (${formatOptionLabel(project.project_type)})`
                          : ""}
                      </option>
                    ))}
                  </select>

                  {activeProjects.length === 0 && (
                    <small className="helper-text">
                      No active project found. Create a CRM project first.
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label>Assign To</label>
                  <select
                    name="assigned_to_user_id"
                    value={formData.assigned_to_user_id}
                    onChange={updateField}
                    required
                  >
                    <option value="">Select user</option>
                    {assignableUsers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.full_name || item.person?.full_name || item.email} —{" "}
                        {formatOptionLabel(item.role)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Task Title</label>
                  <input
                    name="title"
                    value={formData.title}
                    onChange={updateField}
                    placeholder="Enter task title"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={updateField}
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {formatOptionLabel(priority)}
                      </option>
                    ))}
                  </select>
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

                <div className="form-group description-group">
                  <label>Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={updateField}
                    placeholder="Task details"
                  />
                </div>

                <div className="form-group description-group">
                  <label>Remarks</label>
                  <textarea
                    name="remarks"
                    value={formData.remarks}
                    onChange={updateField}
                    placeholder="Admin remarks"
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
                  {saving ? "Creating..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        )}

        <section className="tasks-toolbar-card">
          <div className="search-box">
            <Search size={18} />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search title, project, user, priority, status..."
            />
          </div>

          <div className="toolbar-filters">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All Status</option>
              {statusFilterOptions.map((status) => (
                <option key={status} value={status}>
                  {formatOptionLabel(status)}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
            >
              <option value="">All Priority</option>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {formatOptionLabel(priority)}
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

        <div className="tasks-list-card">
          <div className="list-header">
            <div>
              <h2>
                {taskView === "completed" ? "Completed Tasks" : "Ongoing Tasks"}
              </h2>
              <p>
                {loading
                  ? "Loading tasks..."
                  : `Showing ${pageStart}-${pageEnd} of ${filteredTasks.length} tasks`}
              </p>
            </div>
          </div>

          {paginatedTasks.length === 0 ? (
            <div className="empty-state-card">
              <ClipboardList size={32} />
              <h3>No tasks found</h3>
              <p>Create a task or clear filters to view assigned work.</p>
            </div>
          ) : (
            <div className="task-card-list">
              {paginatedTasks.map((task) => {
                const currentStatus = normalizeTaskStatus(task.status);
                const allowedStatuses = getAllowedTaskStatuses(currentStatus);
                const taskNote = getTaskNote(task);
                const taskNoteLabel = getTaskNoteLabel(task);
                const taskProjectName = getProjectName(task);

                return (
                  <article className="task-card" key={task.id}>
                    <div className="task-card-header">
                      <div className="task-title-wrap">
                        <h3>{task.title}</h3>
                        <p>{task.description || "No description added"}</p>
                      </div>

                      <span className={`task-priority priority-${task.priority}`}>
                        {formatOptionLabel(task.priority)}
                      </span>
                    </div>

                    <div className="task-project-row">
                      <span>Project</span>
                      <strong>{taskProjectName}</strong>
                    </div>

                    <div className="task-info-row">
                      <span>Assigned</span>
                      <strong>{getUserName(task.assigned_to_user_id)}</strong>
                      <small>{getUserSubtitle(task.assigned_to_user_id)}</small>
                    </div>

                    <div className="task-mini-grid">
                      <div>
                        <span>Due</span>
                        <strong>{task.due_date || "-"}</strong>
                      </div>

                      <div>
                        <span>Status</span>
                        <strong>{formatOptionLabel(currentStatus)}</strong>
                      </div>
                    </div>

                    <div className={taskNote ? "task-note" : "task-note empty-note"}>
                      {taskNote ? (
                        <p>
                          <strong>{taskNoteLabel}:</strong> {taskNote}
                        </p>
                      ) : (
                        <p>No note added</p>
                      )}
                    </div>

                    {currentStatus === "completed" ? (
                      <div className="task-footer-row">
                        <span className="completed-pill">Completed</span>

                        {isTaskManager && (
                          <button
                            type="button"
                            className="icon-danger-button"
                            onClick={() => openDeleteModal(task)}
                            title="Delete task"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="task-actions-row">
                        <select
                          value={currentStatus}
                          onChange={(event) =>
                            handleStatusUpdate(task, event.target.value)
                          }
                        >
                          {allowedStatuses.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>

                        <input
                          value={submissionNotes[task.id] || ""}
                          onChange={(event) =>
                            setSubmissionNotes((prev) => ({
                              ...prev,
                              [task.id]: event.target.value,
                            }))
                          }
                          placeholder="Note"
                        />

                        <button
                          type="button"
                          className="save-small-button"
                          onClick={() => handleSaveSubmissionNote(task)}
                        >
                          <Save size={16} />
                        </button>

                        {isTaskManager && (
                          <button
                            type="button"
                            className="icon-danger-button"
                            onClick={() => openDeleteModal(task)}
                            title="Delete task"
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
        </div>

        {deleteModal.open && (
          <div className="erp-modal-backdrop">
            <div className="erp-confirm-modal">
              <button
                type="button"
                className="confirm-close-button"
                onClick={closeDeleteModal}
                disabled={deleteModal.loading}
              >
                <X size={17} />
              </button>

              <div className="confirm-icon danger">
                <AlertTriangle size={25} />
              </div>

              <h2>Delete Task?</h2>

              <p className="confirm-message">
                This task will be permanently deleted from task assignment. This
                action cannot be undone.
              </p>

              <div className="confirm-task-card">
                <div className="confirm-task-icon">
                  <ClipboardList size={20} />
                </div>

                <div>
                  <strong>{deleteModal.task?.title || "Task"}</strong>
                  <span>
                    Project: {deleteModal.task ? getProjectName(deleteModal.task) : "-"}
                  </span>
                </div>
              </div>

              <div className="confirm-actions">
                <button
                  type="button"
                  className="confirm-secondary-btn"
                  onClick={closeDeleteModal}
                  disabled={deleteModal.loading}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="confirm-danger-btn"
                  onClick={handleConfirmDeleteTask}
                  disabled={deleteModal.loading}
                >
                  {deleteModal.loading ? "Deleting..." : "Delete Task"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const tasksPageStyles = `
.tasks-page {
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

.create-task-button {
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
  background: rgba(255, 255, 255, 0.78);
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
  min-height: 78px;
  padding: 15px 16px;
  border-radius: 18px;
  border: 1px solid var(--erp-border);
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
  font-size: 24px;
  font-weight: 800;
  line-height: 1;
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

.task-view-tabs-card,
.tasks-toolbar-card,
.tasks-list-card {
  width: 100%;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid var(--erp-border);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.055);
}

.task-view-tabs-card {
  height: 66px;
  padding: 10px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  align-items: stretch;
  box-sizing: border-box;
}

.task-view-tab {
  width: 100%;
  height: 46px;
  min-height: 46px;
  box-sizing: border-box;
  border-radius: 15px;
  border: 1px solid #dbe5f2;
  background: #ffffff;
  color: #334155;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px;
  font-family: inherit;
  cursor: pointer;
}

.task-view-tab span {
  font-size: 13px;
  font-weight: 800;
}

.task-view-tab strong {
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

.task-view-tab.active {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #2563eb;
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.08);
}

.task-view-tab.active strong {
  background: #2563eb;
  color: #ffffff;
}

.task-view-tab.active.completed {
  border-color: #bbf7d0;
  background: #ecfdf5;
  color: #059669;
}

.task-view-tab.active.completed strong {
  background: #059669;
  color: #ffffff;
}

.task-modal-backdrop {
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

.task-modal-card {
  width: min(1080px, 100%);
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
  border-bottom: 1px solid var(--erp-border-soft);
}

.modal-title-row {
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0;
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
  cursor: pointer;
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
  grid-template-columns: 1.3fr 1fr 1fr 0.8fr 0.8fr;
  gap: 13px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}

.project-group {
  grid-column: span 2;
}

.description-group {
  grid-column: span 2;
}

.form-group label {
  color: #334155;
  font-size: 12px;
  font-weight: 700;
}

.form-group label span {
  color: #dc2626;
  font-weight: 900;
}

.helper-text {
  color: #dc2626;
  font-size: 11px;
  font-weight: 700;
}

.form-group input,
.form-group select,
.form-group textarea,
.toolbar-filters select,
.search-box input,
.task-actions-row select,
.task-actions-row input {
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
  min-height: 86px;
  resize: vertical;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus,
.toolbar-filters select:focus,
.search-box:focus-within,
.task-actions-row select:focus,
.task-actions-row input:focus {
  border-color: #bfdbfe;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.10);
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

.tasks-toolbar-card {
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
  min-width: 145px;
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

.tasks-list-card {
  min-height: 560px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.list-header {
  height: 74px;
  min-height: 74px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--erp-border-soft);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  box-sizing: border-box;
}

.task-card-list {
  flex: 1;
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-content: start;
  gap: 14px;
}

.task-card {
  height: 330px;
  min-height: 330px;
  max-height: 330px;
  border-radius: 18px;
  border: 1px solid var(--erp-border);
  background: #ffffff;
  padding: 13px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.035);
  display: flex;
  flex-direction: column;
  gap: 9px;
  overflow: hidden;
  box-sizing: border-box;
}

.task-card-header {
  height: 40px;
  min-height: 40px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  overflow: hidden;
}

.task-title-wrap {
  min-width: 0;
}

.task-title-wrap h3 {
  margin: 0;
  color: #06142b;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-title-wrap p {
  margin: 4px 0 0;
  color: #52677e;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-priority {
  height: 23px;
  min-height: 23px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.priority-low {
  color: #059669;
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
}

.priority-medium {
  color: #2563eb;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
}

.priority-high {
  color: #ea580c;
  background: #fff7ed;
  border: 1px solid #fed7aa;
}

.priority-urgent {
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.task-project-row {
  height: 42px;
  min-height: 42px;
  padding: 8px 10px;
  border-radius: 13px;
  background: #eff6ff;
  border: 1px solid #dbeafe;
  box-sizing: border-box;
  overflow: hidden;
}

.task-project-row span {
  display: block;
  color: #2563eb;
  font-size: 9px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.task-project-row strong {
  display: block;
  margin-top: 4px;
  color: #06142b;
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-info-row {
  height: 54px;
  min-height: 54px;
  padding: 8px 10px;
  border-radius: 13px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
  box-sizing: border-box;
  overflow: hidden;
}

.task-info-row span,
.task-mini-grid span {
  display: block;
  color: #64748b;
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.task-info-row strong,
.task-mini-grid strong {
  display: block;
  margin-top: 4px;
  color: #0f172a;
  font-size: 11px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-info-row small {
  display: block;
  margin-top: 3px;
  color: #64748b;
  font-size: 10px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-mini-grid {
  height: 50px;
  min-height: 50px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.task-mini-grid div {
  height: 50px;
  min-height: 50px;
  padding: 8px 10px;
  border-radius: 13px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
  box-sizing: border-box;
  overflow: hidden;
}

.task-note {
  height: 38px;
  min-height: 38px;
  padding: 9px 10px;
  border-radius: 13px;
  background: #f8fbff;
  border: 1px solid #dbeafe;
  box-sizing: border-box;
  overflow: hidden;
}

.task-note p {
  margin: 0;
  color: #334155;
  font-size: 11px;
  line-height: 1.35;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-note strong {
  color: #2563eb;
  font-size: 11px;
  font-weight: 800;
}

.empty-note {
  background: #f8fafc;
  border-color: #eef2f7;
}

.empty-note p {
  color: #94a3b8;
}

.task-actions-row,
.task-footer-row {
  height: 42px;
  min-height: 42px;
  margin-top: auto;
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr) 38px 38px;
  gap: 8px;
  align-items: center;
}

.task-actions-row select,
.task-actions-row input {
  height: 38px;
  min-height: 38px;
  padding: 7px 10px;
}

.task-footer-row {
  grid-template-columns: minmax(0, 1fr) 38px;
}

.save-small-button,
.icon-danger-button {
  width: 38px;
  height: 38px;
  border-radius: 13px;
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  cursor: pointer;
}

.save-small-button {
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #2563eb;
}

.icon-danger-button {
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #dc2626;
}

.completed-pill {
  width: fit-content;
  max-width: 100%;
  height: 34px;
  padding: 0 13px;
  border-radius: 999px;
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #bbf7d0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
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

.pagination-row {
  height: 62px;
  min-height: 62px;
  padding: 14px 20px;
  border-top: 1px solid var(--erp-border-soft);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  box-sizing: border-box;
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

.erp-confirm-modal {
  width: min(440px, 100%);
  position: relative;
  border-radius: 24px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 34px 80px rgba(15, 23, 42, 0.28);
  padding: 28px;
  text-align: center;
}

.confirm-close-button {
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

.confirm-icon {
  width: 58px;
  height: 58px;
  margin: 0 auto 16px;
  border-radius: 20px;
  display: grid;
  place-items: center;
}

.confirm-icon.danger {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.erp-confirm-modal h2 {
  margin: 0;
  color: #06142b;
  font-size: 23px;
  font-weight: 900;
}

.confirm-message {
  margin: 10px auto 18px;
  max-width: 360px;
  color: #52677e;
  font-size: 13px;
  line-height: 1.55;
  font-weight: 600;
}

.confirm-task-card {
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

.confirm-task-icon {
  width: 44px;
  height: 44px;
  border-radius: 15px;
  background: #eff6ff;
  color: #2563eb;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.confirm-task-card strong {
  display: block;
  color: #06142b;
  font-size: 14px;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.confirm-task-card span {
  display: block;
  max-width: 320px;
  margin-top: 4px;
  color: #52677e;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.confirm-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 20px;
}

.confirm-secondary-btn,
.confirm-danger-btn {
  min-height: 44px;
  border-radius: 15px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.confirm-secondary-btn {
  border: 1px solid #dbe5f2;
  background: #ffffff;
  color: #0f172a;
}

.confirm-danger-btn {
  border: none;
  background: #dc2626;
  color: #ffffff;
}

.confirm-secondary-btn:disabled,
.confirm-danger-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

@media (max-width: 1450px) {
  .task-card-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1280px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .form-content-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .project-group,
  .description-group {
    grid-column: span 2;
  }

  .tasks-toolbar-card {
    grid-template-columns: 1fr;
  }

  .toolbar-filters {
    flex-wrap: wrap;
  }
}

@media (max-width: 980px) {
  .task-card-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .task-actions-row {
    grid-template-columns: 1fr 1fr 38px 38px;
    height: 86px;
    min-height: 86px;
  }

  .task-actions-row select {
    grid-column: span 2;
  }

  .task-actions-row input {
    grid-column: span 2;
  }

  .task-card {
    height: 375px;
    min-height: 375px;
    max-height: 375px;
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

  .create-task-button {
    width: 100%;
  }

  .summary-grid,
  .form-content-grid,
  .task-view-tabs-card {
    grid-template-columns: 1fr;
  }

  .task-view-tabs-card {
    height: auto;
  }

  .project-group,
  .description-group {
    grid-column: span 1;
  }

  .form-actions-row {
    justify-content: stretch;
    flex-direction: column;
  }

  .primary-button,
  .secondary-button {
    width: 100%;
  }

  .toolbar-filters {
    flex-direction: column;
    width: 100%;
  }

  .toolbar-filters select,
  .clear-filter-button {
    width: 100%;
  }

  .task-card-list {
    grid-template-columns: 1fr;
  }

  .task-actions-row {
    grid-template-columns: 1fr;
    height: 178px;
    min-height: 178px;
  }

  .task-actions-row select,
  .task-actions-row input {
    grid-column: auto;
  }

  .task-card {
    height: auto;
    min-height: 390px;
    max-height: none;
  }

  .save-small-button,
  .icon-danger-button {
    width: 100%;
  }

  .task-footer-row {
    grid-template-columns: 1fr;
    height: 82px;
    min-height: 82px;
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

  .task-modal-backdrop {
    align-items: flex-start;
    padding: 14px;
  }

  .task-modal-card {
    max-height: calc(100vh - 28px);
    border-radius: 18px;
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

  .tasks-toolbar-card {
    padding: 15px;
  }

  .list-header {
    padding: 16px;
  }

  .task-card-list {
    padding: 12px;
  }

  .task-modal-card {
    padding: 15px;
  }

  .modal-header {
    align-items: flex-start;
  }

  .erp-confirm-modal {
    padding: 22px;
  }
}
`;