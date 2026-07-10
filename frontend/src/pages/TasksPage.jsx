import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Edit3,
  Eye,
  Filter,
  Lock,
  Plus,
  PlusCircle,
  Save,
  Search,
  Trash2,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import api from "../api/api";
import { useAuth } from "../context/AuthContext";

const TASK_MANAGER_ROLES = [
  "super-admin",
  "company-admin",
  "admin",
  "owner",
  "hr",
  "manager",
  "team-lead",
  "project-manager",
];

const ROLE_LEVELS = {
  "super-admin": 100,
  "company-admin": 90,
  admin: 90,
  owner: 90,
  hr: 80,
  manager: 70,
  "team-lead": 65,
  "project-manager": 65,
  employee: 50,
  "sales-representative": 50,
  accountant: 50,
  developer: 50,
  designer: 50,
  freelancer: 40,
  intern: 10,
};

const TASK_STATUSES = ["pending", "in-progress", "completed"];
const PRIORITIES = ["low", "medium", "high", "urgent"];
const TASKS_PER_PAGE = 20;

const normalizeRole = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replaceAll(" ", "-");

const normalizeTaskStatus = (status) => {
  const value = String(status || "pending").trim().toLowerCase();

  if (value === "in_progress") return "in-progress";
  if (["submitted", "done", "complete"].includes(value)) return "completed";

  return value;
};

const formatOptionLabel = (value) => {
  if (!value) return "-";

  return String(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
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

  return [{ value: "completed", label: "Completed" }];
};

const canChangeTaskStatus = (oldStatus, newStatus) => {
  const order = {
    pending: 1,
    "in-progress": 2,
    completed: 3,
  };

  return (
    order[normalizeTaskStatus(newStatus)] >=
    order[normalizeTaskStatus(oldStatus)]
  );
};

const extractProjectLine = (value) => {
  if (!value) return "";

  const projectLine = String(value)
    .split("\n")
    .find((line) => line.trim().toLowerCase().startsWith("project:"));

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

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item?.msg || item?.message || "Validation error")
      .join(", ");
  }

  return error?.response?.data?.message || fallback;
};

const getEmptyTaskForm = () => ({
  project_id: "",
  assigned_to_user_id: "",
  title: "",
  description: "",
  priority: "medium",
  due_date: "",
  remarks: "",
});

const getEmptyEditForm = () => ({
  project_id: "",
  assigned_to_user_id: "",
  title: "",
  description: "",
  priority: "medium",
  due_date: "",
  remarks: "",
  status: "pending",
  submission_note: "",
});

export default function TasksPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailsSaving, setDetailsSaving] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [taskView, setTaskView] = useState("ongoing");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedTask, setSelectedTask] = useState(null);
  const [detailsMode, setDetailsMode] = useState("view");
  const [editForm, setEditForm] = useState(getEmptyEditForm());

  const [notification, setNotification] = useState({
    type: "",
    message: "",
  });

  const [deleteModal, setDeleteModal] = useState({
    open: false,
    task: null,
    loading: false,
  });

  const [formData, setFormData] = useState(getEmptyTaskForm());
  const [submissionNotes, setSubmissionNotes] = useState({});

  const currentRole = normalizeRole(user?.role);
  const isTaskManager = TASK_MANAGER_ROLES.includes(currentRole);
  const isIntern = currentRole === "intern";
  const canCreateTask = isTaskManager || isIntern;

  const showNotification = (type, message) => {
    setNotification({ type, message });
  };

  useEffect(() => {
    if (!notification.message) return undefined;

    const timer = window.setTimeout(() => {
      setNotification({ type: "", message: "" });
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [notification.message]);

  useEffect(() => {
    if (!selectedTask && !showCreateForm && !deleteModal.open) return undefined;

    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      if (detailsSaving || saving || deleteModal.loading) return;

      if (deleteModal.open) {
        setDeleteModal({ open: false, task: null, loading: false });
      } else if (selectedTask) {
        setSelectedTask(null);
        setDetailsMode("view");
      } else if (showCreateForm) {
        setShowCreateForm(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [
    selectedTask,
    showCreateForm,
    deleteModal.open,
    deleteModal.loading,
    detailsSaving,
    saving,
  ]);

  const usersMap = useMemo(() => {
    const map = new Map();
    users.forEach((item) => map.set(Number(item.id), item));
    return map;
  }, [users]);

  const projectsMap = useMemo(() => {
    const map = new Map();
    projects.forEach((item) => map.set(Number(item.id), item));
    return map;
  }, [projects]);

  const assignableUsers = useMemo(() => {
    if (isIntern) {
      return user ? [user] : [];
    }

    return users.filter((item) =>
      [
        "employee",
        "intern",
        "sales-representative",
        "freelancer",
        "manager",
        "hr",
        "company-admin",
      ].includes(normalizeRole(item.role))
    );
  }, [users, isIntern, user]);

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
    return taskView === "completed"
      ? ["completed"]
      : TASK_STATUSES.filter((status) => status !== "completed");
  }, [taskView]);

  const getProjectName = (task) => {
    if (task?.project_title) return task.project_title;
    if (task?.project?.title) return task.project.title;

    if (task?.project_id) {
      const project = projectsMap.get(Number(task.project_id));
      if (project) return project.title;
    }

    return extractProjectLine(task?.remarks) || "-";
  };

  const getUserName = (userId) => {
    const foundUser = usersMap.get(Number(userId));

    if (!foundUser) {
      if (Number(userId) === Number(user?.id)) {
        return user?.full_name || user?.name || user?.email || `User #${userId}`;
      }

      return userId ? `User #${userId}` : "-";
    }

    return foundUser.full_name || foundUser.person?.full_name || foundUser.email;
  };

  const getUserSubtitle = (userId) => {
    const foundUser = usersMap.get(Number(userId));

    if (!foundUser) {
      if (Number(userId) === Number(user?.id)) {
        const role = formatOptionLabel(user?.role || "user");
        const department = user?.department;
        return `${role}${department ? ` • ${department}` : ""}`;
      }

      return "-";
    }

    const role = formatOptionLabel(foundUser.role || "user");
    const department = foundUser.department || foundUser.person?.department;

    return `${role}${department ? ` • ${department}` : ""}`;
  };

  const getCreator = (task) => usersMap.get(Number(task?.assigned_by_user_id));

  const getCreatorRole = (task) => {
    const creator = getCreator(task);

    return normalizeRole(
      creator?.role ||
        task?.assigned_by_role ||
        task?.creator_role ||
        (Number(task?.assigned_by_user_id) === Number(user?.id)
          ? user?.role
          : "")
    );
  };

  const canFullyEditTask = (task) => {
    if (!task || !isTaskManager) return false;
    if (currentRole === "super-admin") return true;

    if (Number(task.assigned_by_user_id) === Number(user?.id)) {
      return true;
    }

    const creatorRole = getCreatorRole(task);

    if (!creatorRole) {
      return ["company-admin", "admin", "owner"].includes(currentRole);
    }

    return (
      (ROLE_LEVELS[currentRole] || 20) >=
      (ROLE_LEVELS[creatorRole] || 20)
    );
  };

  const canDeleteTask = (task) => canFullyEditTask(task);

  const canUpdateProgress = (task) => {
    if (!task) return false;
    if (isTaskManager) return true;

    return Number(task.assigned_to_user_id) === Number(user?.id);
  };

  const filteredTasks = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return tasks.filter((task) => {
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
        getUserName(task.assigned_to_user_id),
        getUserName(task.assigned_by_user_id),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        viewMatch &&
        (!search || searchTarget.includes(search)) &&
        (!statusFilter || currentStatus === statusFilter) &&
        (!priorityFilter || task.priority === priorityFilter)
      );
    });
  }, [
    tasks,
    searchText,
    statusFilter,
    priorityFilter,
    taskView,
    usersMap,
    projectsMap,
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
    try {
      const response = await api.get("/users");
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      if (isTaskManager) {
        console.error("Users loading error:", error);
      }

      if (user) {
        setUsers([user]);
      }
    }
  };

  const fetchProjects = async () => {
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
      const taskList = Array.isArray(response.data) ? response.data : [];

      setTasks(taskList);

      if (selectedTask) {
        const refreshedTask = taskList.find(
          (item) => Number(item.id) === Number(selectedTask.id)
        );

        if (refreshedTask) {
          setSelectedTask(refreshedTask);
          fillEditForm(refreshedTask);
        } else {
          setSelectedTask(null);
          setDetailsMode("view");
        }
      }
    } catch (error) {
      showNotification("error", getErrorMessage(error, "Failed to load tasks"));
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

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const updateEditField = (event) => {
    const { name, value } = event.target;

    setEditForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const fillEditForm = (task) => {
    setEditForm({
      project_id: task.project_id ? String(task.project_id) : "",
      assigned_to_user_id: task.assigned_to_user_id
        ? String(task.assigned_to_user_id)
        : "",
      title: task.title || "",
      description: task.description || "",
      priority: task.priority || "medium",
      due_date: task.due_date || "",
      remarks: removeProjectLine(task.remarks) || "",
      status: normalizeTaskStatus(task.status),
      submission_note: task.submission_note || "",
    });
  };

  const resetForm = () => setFormData(getEmptyTaskForm());

  const openCreateModal = () => {
    setFormData({
      ...getEmptyTaskForm(),
      assigned_to_user_id: isIntern ? String(user?.id || "") : "",
    });

    setShowCreateForm(true);
  };

  const closeCreateModal = () => {
    if (saving) return;
    resetForm();
    setShowCreateForm(false);
  };

  const openTaskDetails = (task) => {
    setSelectedTask(task);
    setDetailsMode("view");
    fillEditForm(task);
  };

  const closeTaskDetails = () => {
    if (detailsSaving) return;

    setSelectedTask(null);
    setDetailsMode("view");
    setEditForm(getEmptyEditForm());
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

    if (!canCreateTask) {
      showNotification("error", "You do not have permission to create tasks.");
      return;
    }

    if (isIntern && Number(formData.assigned_to_user_id) !== Number(user?.id)) {
      showNotification("error", "Interns can only create tasks for themselves.");
      return;
    }

    if (!formData.project_id) {
      showNotification("error", "Please select project.");
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

      const payload = {
        project_id: Number(formData.project_id),
        project_title: selectedProject.title,
        assigned_to_user_id: Number(formData.assigned_to_user_id),
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        priority: formData.priority,
        due_date: formData.due_date || null,
        remarks: [projectContext, formData.remarks.trim()]
          .filter(Boolean)
          .join("\n"),
      };

      await api.post("/tasks", payload);

      closeCreateModal();
      setTaskView("ongoing");
      await fetchTasks();

      showNotification("success", "Task created successfully.");
    } catch (error) {
      showNotification("error", getErrorMessage(error, "Failed to create task"));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (task, newStatus) => {
    const currentStatus = normalizeTaskStatus(task.status);
    const nextStatus = normalizeTaskStatus(newStatus);

    if (!canUpdateProgress(task)) {
      showNotification("error", "You cannot update this task.");
      return;
    }

    if (!canChangeTaskStatus(currentStatus, nextStatus)) {
      showNotification(
        "error",
        `Task status cannot be reverted from ${formatOptionLabel(
          currentStatus
        )} to ${formatOptionLabel(nextStatus)}.`
      );
      return;
    }

    try {
      const payload = { status: nextStatus };
      const note = submissionNotes[task.id];

      if (note?.trim()) {
        payload.submission_note = note.trim();
      }

      await api.put(`/tasks/${task.id}`, payload);

      setSubmissionNotes((previous) => ({
        ...previous,
        [task.id]: "",
      }));

      await fetchTasks();
      showNotification("success", "Task updated successfully.");
    } catch (error) {
      showNotification("error", getErrorMessage(error, "Failed to update task"));
      await fetchTasks();
    }
  };

  const handleSaveSubmissionNote = async (task) => {
    await handleStatusUpdate(task, normalizeTaskStatus(task.status));
  };

  const handleSaveTaskDetails = async () => {
    if (!selectedTask) return;

    const fullEditAllowed = canFullyEditTask(selectedTask);
    const progressAllowed = canUpdateProgress(selectedTask);

    if (!fullEditAllowed && !progressAllowed) {
      showNotification("error", "You cannot update this task.");
      return;
    }

    const nextStatus = normalizeTaskStatus(editForm.status);
    const currentStatus = normalizeTaskStatus(selectedTask.status);

    if (!canChangeTaskStatus(currentStatus, nextStatus)) {
      showNotification("error", "Completed task status cannot be reverted.");
      return;
    }

    try {
      setDetailsSaving(true);

      let payload;

      if (fullEditAllowed) {
        const selectedProject = projectsMap.get(Number(editForm.project_id));
        const projectContext = selectedProject
          ? `Project: ${selectedProject.title}${
              selectedProject.client_company_name
                ? ` | Company: ${selectedProject.client_company_name}`
                : ""
            }${
              selectedProject.project_type
                ? ` | Type: ${formatOptionLabel(selectedProject.project_type)}`
                : ""
            }`
          : extractProjectLine(selectedTask.remarks);

        payload = {
          project_id: editForm.project_id ? Number(editForm.project_id) : null,
          project_title: selectedProject?.title || getProjectName(selectedTask),
          assigned_to_user_id: Number(editForm.assigned_to_user_id),
          title: editForm.title.trim(),
          description: editForm.description.trim() || null,
          priority: editForm.priority,
          due_date: editForm.due_date || null,
          remarks: [projectContext, editForm.remarks.trim()]
            .filter(Boolean)
            .join("\n"),
          status: nextStatus,
          submission_note: editForm.submission_note.trim() || null,
        };
      } else {
        payload = {
          status: nextStatus,
          submission_note: editForm.submission_note.trim() || null,
        };
      }

      await api.put(`/tasks/${selectedTask.id}`, payload);
      await fetchTasks();

      setDetailsMode("view");
      showNotification("success", "Task details updated successfully.");
    } catch (error) {
      showNotification(
        "error",
        getErrorMessage(error, "Failed to update task details")
      );
    } finally {
      setDetailsSaving(false);
    }
  };

  const openDeleteModal = (task) => {
    if (!canDeleteTask(task)) {
      showNotification(
        "error",
        "You cannot delete a task created by a higher-role user."
      );
      return;
    }

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
      setDeleteModal((previous) => ({
        ...previous,
        loading: true,
      }));

      await api.delete(`/tasks/${deleteModal.task.id}`);
      await fetchTasks();

      if (Number(selectedTask?.id) === Number(deleteModal.task.id)) {
        setSelectedTask(null);
        setDetailsMode("view");
      }

      setDeleteModal({
        open: false,
        task: null,
        loading: false,
      });

      showNotification("success", "Task deleted successfully.");
    } catch (error) {
      setDeleteModal((previous) => ({
        ...previous,
        loading: false,
      }));

      showNotification("error", getErrorMessage(error, "Failed to delete task"));
    }
  };

  const getTaskNote = (task) => {
    const remarksWithoutProject = removeProjectLine(task.remarks);

    if (taskView === "completed") {
      return task.submission_note || remarksWithoutProject || "";
    }

    return remarksWithoutProject || task.submission_note || "";
  };

  const goToPreviousPage = () => {
    setCurrentPage((previous) => Math.max(1, previous - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((previous) => Math.min(totalPages, previous + 1));
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
              <p>Open any task to view full details, progress and permissions.</p>
            </div>
          </div>

          {canCreateTask && (
            <button
              type="button"
              className="create-task-button"
              onClick={openCreateModal}
            >
              <Plus size={17} />
              Create Task
            </button>
          )}
        </div>

        {notification.message && (
          <div
            className={`page-notification ${
              notification.type === "success" ? "success" : "error"
            }`}
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
            className={`task-view-tab ${taskView === "ongoing" ? "active" : ""}`}
            onClick={() => changeTaskView("ongoing")}
          >
            <span>Ongoing</span>
            <strong>{summary.ongoing}</strong>
          </button>

          <button
            type="button"
            className={`task-view-tab ${
              taskView === "completed" ? "active completed" : ""
            }`}
            onClick={() => changeTaskView("completed")}
          >
            <span>Completed</span>
            <strong>{summary.completed}</strong>
          </button>
        </section>

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
              {statusFilterOptions.map((taskStatus) => (
                <option key={taskStatus} value={taskStatus}>
                  {formatOptionLabel(taskStatus)}
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

                return (
                  <article
                    className="task-card"
                    key={task.id}
                    onClick={() => openTaskDetails(task)}
                  >
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
                      <strong>{getProjectName(task)}</strong>
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
                      <p>{taskNote || "No note added"}</p>
                    </div>

                    {currentStatus === "completed" ? (
                      <div className="task-footer-row">
                        <span className="completed-pill">Completed</span>

                        <button
                          type="button"
                          className="view-task-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openTaskDetails(task);
                          }}
                        >
                          <Eye size={15} />
                        </button>

                        {canDeleteTask(task) && (
                          <button
                            type="button"
                            className="icon-danger-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openDeleteModal(task);
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div
                        className="task-actions-row"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <select
                          value={currentStatus}
                          disabled={!canUpdateProgress(task)}
                          onChange={(event) =>
                            handleStatusUpdate(task, event.target.value)
                          }
                        >
                          {allowedStatuses.map((taskStatus) => (
                            <option key={taskStatus.value} value={taskStatus.value}>
                              {taskStatus.label}
                            </option>
                          ))}
                        </select>

                        <input
                          value={submissionNotes[task.id] || ""}
                          disabled={!canUpdateProgress(task)}
                          onChange={(event) =>
                            setSubmissionNotes((previous) => ({
                              ...previous,
                              [task.id]: event.target.value,
                            }))
                          }
                          placeholder="Add note"
                        />

                        <button
                          type="button"
                          className="save-small-button"
                          disabled={!canUpdateProgress(task)}
                          onClick={() => handleSaveSubmissionNote(task)}
                        >
                          <Save size={16} />
                        </button>

                        <button
                          type="button"
                          className="view-task-button"
                          onClick={() => openTaskDetails(task)}
                        >
                          <Eye size={15} />
                        </button>
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
      </div>

      {showCreateForm && (
        <div className="task-modal-backdrop" onMouseDown={closeCreateModal}>
          <form
            className="task-modal-card"
            onSubmit={handleCreateTask}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div className="card-title-row">
                <div className="card-title-icon">
                  <PlusCircle size={19} />
                </div>

                <div>
                  <h2>Create Task</h2>
                  <p>
                    {isIntern
                      ? "Create a task for yourself."
                      : "Select a project and assign work to a software user."}
                  </p>
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
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Assign To</label>

                <select
                  name="assigned_to_user_id"
                  value={formData.assigned_to_user_id}
                  onChange={updateField}
                  disabled={isIntern}
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

                {isIntern && (
                  <small className="helper-text">
                    Interns can only assign tasks to themselves.
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Task Title</label>

                <input
                  name="title"
                  value={formData.title}
                  onChange={updateField}
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
                />
              </div>

              <div className="form-group description-group">
                <label>Remarks</label>

                <textarea
                  name="remarks"
                  value={formData.remarks}
                  onChange={updateField}
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

              <button
                type="submit"
                className="primary-button"
                disabled={saving}
              >
                {saving ? "Creating..." : "Create Task"}
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedTask && (
        <div className="task-modal-backdrop" onMouseDown={closeTaskDetails}>
          <section
            className="task-details-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div className="card-title-row">
                <div className="card-title-icon">
                  <ClipboardList size={19} />
                </div>

                <div>
                  <h2>{selectedTask.title}</h2>
                  <p>
                    Task #{selectedTask.id} •{" "}
                    {formatOptionLabel(selectedTask.status)}
                  </p>
                </div>
              </div>

              <div className="details-header-actions">
                {detailsMode === "view" && canFullyEditTask(selectedTask) && (
                  <button
                    type="button"
                    className="edit-task-button"
                    onClick={() => setDetailsMode("edit")}
                  >
                    <Edit3 size={16} />
                    Edit
                  </button>
                )}

                <button
                  type="button"
                  className="modal-close-button"
                  onClick={closeTaskDetails}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {detailsMode === "view" ? (
              <>
                {!canFullyEditTask(selectedTask) && (
                  <div className="permission-banner">
                    <Lock size={17} />
                    <span>
                      This task was assigned by a higher-role user. You can update
                      only status and your submission note.
                    </span>
                  </div>
                )}

                <div className="task-details-grid">
                  <article>
                    <span>Project</span>
                    <strong>{getProjectName(selectedTask)}</strong>
                  </article>

                  <article>
                    <span>Priority</span>
                    <strong>{formatOptionLabel(selectedTask.priority)}</strong>
                  </article>

                  <article>
                    <span>Status</span>
                    <strong>{formatOptionLabel(selectedTask.status)}</strong>
                  </article>

                  <article>
                    <span>Due Date</span>
                    <strong>{selectedTask.due_date || "-"}</strong>
                  </article>

                  <article>
                    <span>Assigned To</span>
                    <strong>{getUserName(selectedTask.assigned_to_user_id)}</strong>
                  </article>

                  <article>
                    <span>Assigned By</span>
                    <strong>{getUserName(selectedTask.assigned_by_user_id)}</strong>
                  </article>

                  <article>
                    <span>Created</span>
                    <strong>
                      {selectedTask.created_at
                        ? new Date(selectedTask.created_at).toLocaleString("en-IN")
                        : "-"}
                    </strong>
                  </article>

                  <article>
                    <span>Last Updated</span>
                    <strong>
                      {selectedTask.updated_at
                        ? new Date(selectedTask.updated_at).toLocaleString("en-IN")
                        : "-"}
                    </strong>
                  </article>
                </div>

                <div className="task-detail-block">
                  <span>Description</span>
                  <p>{selectedTask.description || "No description added."}</p>
                </div>

                <div className="task-detail-block admin-remarks-block">
                  <span>Admin / Manager Remarks</span>
                  <p>
                    {removeProjectLine(selectedTask.remarks) ||
                      "No admin remarks added."}
                  </p>
                </div>

                <div className="task-detail-block submission-block">
                  <span>Submission Note</span>
                  <p>{selectedTask.submission_note || "No submission note added."}</p>
                </div>

                {canUpdateProgress(selectedTask) && (
                  <div className="progress-update-panel">
                    <div className="form-group">
                      <label>Status</label>

                      <select
                        name="status"
                        value={editForm.status}
                        onChange={updateEditField}
                      >
                        {getAllowedTaskStatuses(selectedTask.status).map(
                          (taskStatus) => (
                            <option
                              key={taskStatus.value}
                              value={taskStatus.value}
                            >
                              {taskStatus.label}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Your Submission Note</label>

                      <textarea
                        name="submission_note"
                        value={editForm.submission_note}
                        onChange={updateEditField}
                        placeholder="Add your work update"
                      />
                    </div>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={handleSaveTaskDetails}
                      disabled={detailsSaving}
                    >
                      <Save size={16} />
                      {detailsSaving ? "Saving..." : "Save Progress"}
                    </button>
                  </div>
                )}

                <div className="details-footer">
                  {canDeleteTask(selectedTask) && (
                    <button
                      type="button"
                      className="details-delete-button"
                      onClick={() => openDeleteModal(selectedTask)}
                    >
                      <Trash2 size={16} />
                      Delete Task
                    </button>
                  )}

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={closeTaskDetails}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="form-content-grid details-edit-grid">
                  <div className="form-group project-group">
                    <label>Project</label>

                    <select
                      name="project_id"
                      value={editForm.project_id}
                      onChange={updateEditField}
                    >
                      <option value="">Select project</option>
                      {activeProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Assign To</label>

                    <select
                      name="assigned_to_user_id"
                      value={editForm.assigned_to_user_id}
                      onChange={updateEditField}
                    >
                      {assignableUsers.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.full_name || item.person?.full_name || item.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Task Title</label>

                    <input
                      name="title"
                      value={editForm.title}
                      onChange={updateEditField}
                    />
                  </div>

                  <div className="form-group">
                    <label>Priority</label>

                    <select
                      name="priority"
                      value={editForm.priority}
                      onChange={updateEditField}
                    >
                      {PRIORITIES.map((priority) => (
                        <option key={priority} value={priority}>
                          {formatOptionLabel(priority)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Status</label>

                    <select
                      name="status"
                      value={editForm.status}
                      onChange={updateEditField}
                    >
                      {getAllowedTaskStatuses(selectedTask.status).map(
                        (taskStatus) => (
                          <option key={taskStatus.value} value={taskStatus.value}>
                            {taskStatus.label}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Due Date</label>

                    <input
                      name="due_date"
                      type="date"
                      value={editForm.due_date}
                      onChange={updateEditField}
                    />
                  </div>

                  <div className="form-group description-group">
                    <label>Description</label>

                    <textarea
                      name="description"
                      value={editForm.description}
                      onChange={updateEditField}
                    />
                  </div>

                  <div className="form-group description-group">
                    <label>Admin / Manager Remarks</label>

                    <textarea
                      name="remarks"
                      value={editForm.remarks}
                      onChange={updateEditField}
                    />
                  </div>

                  <div className="form-group description-group">
                    <label>Submission Note</label>

                    <textarea
                      name="submission_note"
                      value={editForm.submission_note}
                      onChange={updateEditField}
                    />
                  </div>
                </div>

                <div className="details-footer">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      fillEditForm(selectedTask);
                      setDetailsMode("view");
                    }}
                    disabled={detailsSaving}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleSaveTaskDetails}
                    disabled={detailsSaving}
                  >
                    <Save size={16} />
                    {detailsSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

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
              This task will be permanently deleted. This action cannot be
              undone.
            </p>

            <div className="confirm-task-card">
              <ClipboardList size={20} />

              <div>
                <strong>{deleteModal.task?.title || "Task"}</strong>
                <span>
                  Project:{" "}
                  {deleteModal.task ? getProjectName(deleteModal.task) : "-"}
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

.page-header,
.task-view-tabs-card,
.tasks-toolbar-card,
.tasks-list-card {
  width: 100%;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid var(--erp-border, #e2e8f0);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.05);
}

.page-header {
  min-height: 92px;
  padding: 20px 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.page-title-wrap,
.card-title-row,
.details-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-title-icon,
.card-title-icon {
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

.back-button,
.modal-close-button,
.view-task-button,
.save-small-button,
.icon-danger-button {
  display: grid;
  place-items: center;
  cursor: pointer;
}

.back-button,
.modal-close-button {
  width: 40px;
  height: 40px;
  border: 1px solid #dbeafe;
  background: #ffffff;
  color: #2563eb;
  border-radius: 13px;
}

.page-header h1 {
  margin: 0;
  color: #06142b;
  font-size: 27px;
}

.page-header p,
.card-title-row p,
.list-header p {
  margin: 6px 0 0;
  color: #52677e;
  font-size: 12px;
}

.create-task-button,
.primary-button,
.edit-task-button {
  min-height: 42px;
  border: none;
  border-radius: 14px;
  background: #2563eb;
  color: #ffffff;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  cursor: pointer;
}

.create-task-button {
  padding: 0 17px;
}

.page-notification {
  min-height: 52px;
  padding: 13px 15px;
  border-radius: 17px;
  display: flex;
  align-items: center;
  gap: 10px;
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
  font-weight: 800;
}

.page-notification button {
  border: none;
  background: transparent;
  color: inherit;
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
  border: 1px solid var(--erp-border, #e2e8f0);
  background: #ffffff;
  display: flex;
  align-items: center;
  gap: 13px;
}

.summary-card svg {
  width: 42px;
  height: 42px;
  padding: 11px;
  border-radius: 15px;
}

.summary-card p {
  margin: 0;
  color: #52677e;
  font-size: 12px;
}

.summary-card strong {
  display: block;
  margin-top: 4px;
  color: #06142b;
  font-size: 24px;
}

.summary-blue svg { color: #2563eb; background: #eff6ff; }
.summary-orange svg { color: #ea580c; background: #fff7ed; }
.summary-purple svg { color: #7c3aed; background: #f5f3ff; }
.summary-green svg { color: #059669; background: #ecfdf5; }

.task-view-tabs-card {
  padding: 10px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.task-view-tab {
  min-height: 46px;
  border-radius: 15px;
  border: 1px solid #dbe5f2;
  background: #ffffff;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.task-view-tab.active {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #2563eb;
}

.task-view-tab.active.completed {
  border-color: #bbf7d0;
  background: #ecfdf5;
  color: #059669;
}

.tasks-toolbar-card {
  padding: 16px;
  display: grid;
  grid-template-columns: minmax(260px, 1fr) auto;
  gap: 14px;
}

.search-box {
  min-height: 42px;
  border: 1px solid #dbe5f2;
  border-radius: 14px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.search-box input,
.toolbar-filters select,
.clear-filter-button,
.form-group input,
.form-group select,
.form-group textarea,
.task-actions-row input,
.task-actions-row select {
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

.search-box input {
  border: none;
  padding: 0;
}

.toolbar-filters {
  display: flex;
  gap: 10px;
}

.toolbar-filters select {
  min-width: 145px;
}

.clear-filter-button {
  width: auto;
  font-weight: 700;
  cursor: pointer;
}

.tasks-list-card {
  min-height: 560px;
  overflow: hidden;
}

.list-header {
  min-height: 74px;
  padding: 18px 20px;
  border-bottom: 1px solid #eef2f7;
}

.list-header h2,
.card-title-row h2 {
  margin: 0;
  color: #06142b;
  font-size: 21px;
}

.task-card-list {
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.task-card {
  min-height: 330px;
  border-radius: 18px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  padding: 13px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.task-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 30px rgba(15, 23, 42, 0.08);
}

.task-card-header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.task-title-wrap {
  min-width: 0;
}

.task-title-wrap h3 {
  margin: 0;
  color: #06142b;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-title-wrap p {
  margin: 4px 0 0;
  color: #52677e;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-priority {
  height: 23px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
}

.priority-low { color: #059669; background: #ecfdf5; border: 1px solid #bbf7d0; }
.priority-medium { color: #2563eb; background: #eff6ff; border: 1px solid #bfdbfe; }
.priority-high { color: #ea580c; background: #fff7ed; border: 1px solid #fed7aa; }
.priority-urgent { color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; }

.task-project-row,
.task-info-row,
.task-mini-grid div,
.task-note {
  padding: 9px 10px;
  border-radius: 13px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
}

.task-project-row {
  background: #eff6ff;
  border-color: #dbeafe;
}

.task-project-row span,
.task-info-row span,
.task-mini-grid span {
  display: block;
  color: #64748b;
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
}

.task-project-row strong,
.task-info-row strong,
.task-mini-grid strong {
  display: block;
  margin-top: 4px;
  color: #0f172a;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-info-row small {
  display: block;
  margin-top: 3px;
  color: #64748b;
  font-size: 10px;
}

.task-mini-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.task-note p {
  margin: 0;
  color: #334155;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-note p {
  color: #94a3b8;
}

.task-actions-row,
.task-footer-row {
  margin-top: auto;
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr) 38px 38px;
  gap: 8px;
  align-items: center;
}

.task-footer-row {
  grid-template-columns: minmax(0, 1fr) 38px 38px;
}

.save-small-button,
.view-task-button,
.icon-danger-button {
  width: 38px;
  height: 38px;
  border-radius: 13px;
}

.save-small-button,
.view-task-button {
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
  padding: 8px 13px;
  border-radius: 999px;
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #bbf7d0;
  font-size: 12px;
  font-weight: 800;
}

.pagination-row {
  min-height: 62px;
  padding: 14px 20px;
  border-top: 1px solid #eef2f7;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pagination-actions {
  display: flex;
  gap: 10px;
}

.pagination-actions button,
.secondary-button {
  min-height: 42px;
  padding: 0 14px;
  border-radius: 13px;
  border: 1px solid #dbe5f2;
  background: #ffffff;
  color: #0f172a;
  font-weight: 700;
  cursor: pointer;
}

.pagination-actions button:disabled,
.primary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.task-modal-backdrop,
.erp-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(15, 23, 42, 0.52);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22px;
}

.task-modal-card,
.task-details-modal {
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
  border-bottom: 1px solid #eef2f7;
}

.edit-task-button {
  padding: 0 14px;
}

.form-content-grid {
  display: grid;
  grid-template-columns: 1.3fr 1fr 1fr 0.8fr 0.8fr;
  gap: 13px;
}

.project-group,
.description-group {
  grid-column: span 2;
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

.form-group label span,
.helper-text {
  color: #dc2626;
}

.form-group textarea {
  min-height: 86px;
  resize: vertical;
}

.form-actions-row,
.details-footer {
  margin-top: 18px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.primary-button,
.secondary-button {
  min-width: 135px;
  padding: 0 15px;
}

.task-details-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.task-details-grid article,
.task-detail-block,
.progress-update-panel {
  padding: 13px;
  border-radius: 15px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.task-details-grid span,
.task-detail-block > span {
  color: #64748b;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
}

.task-details-grid strong {
  display: block;
  margin-top: 5px;
  color: #06142b;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.task-detail-block {
  margin-top: 12px;
}

.task-detail-block p {
  margin: 8px 0 0;
  color: #334155;
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
}

.admin-remarks-block {
  background: #fff7ed;
  border-color: #fed7aa;
}

.submission-block {
  background: #ecfdf5;
  border-color: #bbf7d0;
}

.permission-banner {
  min-height: 44px;
  margin-bottom: 13px;
  padding: 10px 12px;
  border-radius: 13px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #c2410c;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
}

.progress-update-panel {
  margin-top: 13px;
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;
}

.progress-update-panel textarea {
  min-height: 70px;
}

.details-delete-button {
  min-height: 42px;
  padding: 0 15px;
  margin-right: auto;
  border: 1px solid #fecaca;
  border-radius: 13px;
  background: #fef2f2;
  color: #dc2626;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
}

.erp-confirm-modal {
  width: min(440px, 100%);
  position: relative;
  border-radius: 24px;
  background: #ffffff;
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
  border-radius: 12px;
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
}

.confirm-message {
  margin: 10px 0 18px;
  color: #52677e;
  font-size: 13px;
}

.confirm-task-card {
  padding: 12px;
  border-radius: 18px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
}

.confirm-task-card strong,
.confirm-task-card span {
  display: block;
}

.confirm-task-card span {
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
}

.confirm-actions {
  margin-top: 20px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.confirm-secondary-btn,
.confirm-danger-btn {
  min-height: 44px;
  border-radius: 15px;
  font-weight: 800;
  cursor: pointer;
}

.confirm-secondary-btn {
  border: 1px solid #dbe5f2;
  background: #ffffff;
}

.confirm-danger-btn {
  border: none;
  background: #dc2626;
  color: #ffffff;
}

.empty-state-card {
  min-height: 260px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  color: #2563eb;
}

.empty-state-card h3,
.empty-state-card p {
  margin: 0;
}

.empty-state-card p {
  color: #64748b;
}

@media (max-width: 1450px) {
  .task-card-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1280px) {
  .summary-grid,
  .task-details-grid {
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
}

@media (max-width: 980px) {
  .task-card-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .progress-update-panel {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .page-header,
  .modal-header,
  .details-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .summary-grid,
  .task-view-tabs-card,
  .task-card-list,
  .task-details-grid,
  .form-content-grid,
  .confirm-actions {
    grid-template-columns: 1fr;
  }

  .project-group,
  .description-group {
    grid-column: span 1;
  }

  .toolbar-filters {
    flex-direction: column;
  }

  .toolbar-filters select,
  .clear-filter-button,
  .create-task-button,
  .primary-button,
  .secondary-button,
  .details-delete-button {
    width: 100%;
  }

  .task-actions-row {
    grid-template-columns: 1fr 1fr;
  }

  .task-modal-backdrop {
    align-items: flex-start;
    padding: 14px;
  }

  .task-modal-card,
  .task-details-modal {
    max-height: calc(100vh - 28px);
  }
}
`;
