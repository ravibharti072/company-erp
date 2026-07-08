import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Clock,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  Timer,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import api from "../api/api";
import { useAuth } from "../context/AuthContext";

function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateTime(value) {
  if (!value) return "-";

  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatTime(value) {
  if (!value) return "-";

  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatHours(value) {
  if (value === null || value === undefined || value === "") return "-";

  const number = Number(value);

  if (Number.isNaN(number)) return "-";

  return `${number.toFixed(2)} hrs`;
}

function getErrorMessage(error, fallback) {
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
}

const ADMIN_ROLES = [
  "super-admin",
  "company-admin",
  "hr",
  "manager",
  "accountant",
];

export default function AttendancePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [attendance, setAttendance] = useState([]);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [filterDate, setFilterDate] = useState(getTodayDate());
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [remarks, setRemarks] = useState("");

  const [notification, setNotification] = useState({
    type: "",
    message: "",
  });

  const isAdminUser = ADMIN_ROLES.includes(user?.role);
  const canMarkAttendance = user?.role !== "super-admin";

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

  const todayRecord = useMemo(() => {
    const today = getTodayDate();

    return attendance.find(
      (item) => item.user_id === user?.id && item.attendance_date === today
    );
  }, [attendance, user?.id]);

  const hasCheckedIn = Boolean(todayRecord);
  const hasCheckedOut = Boolean(todayRecord?.check_out_time);

  const checkedOutCount = attendance.filter((item) => item.check_out_time).length;

  const activeCount = attendance.filter(
    (item) => item.check_in_time && !item.check_out_time
  ).length;

  const filteredAttendance = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return attendance.filter((item) => {
      const itemUser = usersMap.get(item.user_id);

      const searchTarget = [
        item.id,
        item.user_id,
        item.attendance_date,
        item.status,
        item.remarks,
        itemUser?.full_name,
        itemUser?.email,
        itemUser?.role,
        itemUser?.department,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchMatch = search ? searchTarget.includes(search) : true;

      const statusMatch =
        statusFilter === "active"
          ? item.check_in_time && !item.check_out_time
          : statusFilter === "completed"
            ? Boolean(item.check_out_time)
            : true;

      return searchMatch && statusMatch;
    });
  }, [attendance, usersMap, searchText, statusFilter]);

  const fetchAttendance = async () => {
    try {
      setLoading(true);

      const response = await api.get("/attendance", {
        params: filterDate ? { attendance_date: filterDate } : {},
      });

      setAttendance(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      showNotification(
        "error",
        getErrorMessage(error, "Failed to load attendance")
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get("/users");
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch {
      setUsers([]);
    }
  };

  useEffect(() => {
    fetchAttendance();
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDate]);

  const handleCheckIn = async () => {
    try {
      setActionLoading(true);

      await api.post("/attendance/check-in", {
        remarks: remarks.trim() || null,
      });

      setRemarks("");

      if (filterDate !== getTodayDate()) {
        setFilterDate(getTodayDate());
      } else {
        await fetchAttendance();
      }

      showNotification("success", "Check-in marked successfully.");
    } catch (error) {
      showNotification("error", getErrorMessage(error, "Failed to check in"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setActionLoading(true);

      await api.post("/attendance/check-out");

      if (filterDate !== getTodayDate()) {
        setFilterDate(getTodayDate());
      } else {
        await fetchAttendance();
      }

      showNotification("success", "Check-out marked successfully.");
    } catch (error) {
      showNotification("error", getErrorMessage(error, "Failed to check out"));
    } finally {
      setActionLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchText("");
    setStatusFilter("");
  };

  return (
    <>
      <style>{attendanceStyles}</style>

      <div className="attendance-page">
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
              <CalendarCheck size={22} />
            </div>

            <div>
              <h1>Attendance</h1>
              <p>Mark attendance and view daily attendance records.</p>
            </div>
          </div>

          <button
            type="button"
            className="refresh-button"
            onClick={fetchAttendance}
            disabled={loading}
          >
            <RefreshCw size={17} />
            {loading ? "Loading..." : "Refresh"}
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

        <div
          className={
            canMarkAttendance
              ? "attendance-top-grid"
              : "attendance-top-grid admin-only-grid"
          }
        >
          {canMarkAttendance && (
            <div className="attendance-action-card">
              <div className="card-title-row">
                <div className="card-title-icon">
                  <CalendarCheck size={19} />
                </div>

                <div>
                  <h2>Today Attendance</h2>
                  <p>Check in and check out for today.</p>
                </div>
              </div>

              <div className="today-status-box">
                <div>
                  <p>Status</p>
                  <h3>
                    {!hasCheckedIn
                      ? "Not Checked In"
                      : hasCheckedOut
                        ? "Checked Out"
                        : "Checked In"}
                  </h3>
                </div>

                <span
                  className={
                    !hasCheckedIn
                      ? "status-pill inactive-status"
                      : hasCheckedOut
                        ? "status-pill active-status"
                        : "status-pill progress-status"
                  }
                >
                  {!hasCheckedIn
                    ? "Pending"
                    : hasCheckedOut
                      ? "Completed"
                      : "Active"}
                </span>
              </div>

              <div className="attendance-times">
                <div>
                  <Clock size={18} />
                  <p>Check In</p>
                  <h4>{formatTime(todayRecord?.check_in_time)}</h4>
                </div>

                <div>
                  <Timer size={18} />
                  <p>Total Hours</p>
                  <h4>{formatHours(todayRecord?.total_hours)}</h4>
                </div>

                <div>
                  <Clock size={18} />
                  <p>Check Out</p>
                  <h4>{formatTime(todayRecord?.check_out_time)}</h4>
                </div>
              </div>

              {!hasCheckedIn && (
                <div className="form-group">
                  <label>Remarks</label>
                  <input
                    value={remarks}
                    onChange={(event) => setRemarks(event.target.value)}
                    placeholder="Started work"
                  />
                </div>
              )}

              <div className="attendance-actions">
                <button
                  type="button"
                  className="checkin-button"
                  onClick={handleCheckIn}
                  disabled={actionLoading || hasCheckedIn}
                >
                  <LogIn size={18} />
                  {actionLoading && !hasCheckedIn ? "Saving..." : "Check In"}
                </button>

                <button
                  type="button"
                  className="checkout-button"
                  onClick={handleCheckOut}
                  disabled={actionLoading || !hasCheckedIn || hasCheckedOut}
                >
                  <LogOut size={18} />
                  {actionLoading && hasCheckedIn && !hasCheckedOut
                    ? "Saving..."
                    : "Check Out"}
                </button>
              </div>
            </div>
          )}

          <div className="attendance-summary-card">
            <div className="card-title-row">
              <div className="card-title-icon">
                <Timer size={19} />
              </div>

              <div>
                <h2>Summary</h2>
                <p>
                  {isAdminUser
                    ? "Company attendance overview."
                    : "Your attendance overview."}
                </p>
              </div>
            </div>

            <div className="mini-summary-grid">
              <div className="mini-summary-card summary-blue">
                <Users size={18} />
                <p>Total Records</p>
                <h3>{attendance.length}</h3>
              </div>

              <div className="mini-summary-card summary-green">
                <CheckCircle2 size={18} />
                <p>Checked Out</p>
                <h3>{checkedOutCount}</h3>
              </div>

              <div className="mini-summary-card summary-orange">
                <Activity size={18} />
                <p>Active</p>
                <h3>{activeCount}</h3>
              </div>
            </div>

            <div className="form-group">
              <label>Filter Date</label>
              <input
                type="date"
                value={filterDate}
                onChange={(event) => setFilterDate(event.target.value)}
              />
            </div>

            <p className="small-note">
              {isAdminUser
                ? "Admin can view company attendance records."
                : "You can view only your own attendance records."}
            </p>
          </div>
        </div>

        <section className="attendance-toolbar-card">
          <div className="search-box">
            <Search size={18} />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search by name, email, user ID, status, or remarks..."
            />
          </div>

          <div className="toolbar-filters">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
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

        <div className="module-list-card">
          <div className="list-header">
            <div>
              <h2>Attendance Records</h2>
              <p>
                Date: {filterDate || "All"} • Showing {filteredAttendance.length}{" "}
                records
              </p>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>User</th>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Total Hours</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>

              <tbody>
                {filteredAttendance.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="empty-table">
                      No attendance records found
                    </td>
                  </tr>
                ) : (
                  filteredAttendance.map((item) => {
                    const itemUser = usersMap.get(item.user_id);

                    return (
                      <tr key={item.id}>
                        <td>{item.id}</td>

                        <td>
                          <strong>
                            {itemUser?.full_name || `User #${item.user_id}`}
                          </strong>
                          <span>{itemUser?.email || `ID: ${item.user_id}`}</span>
                        </td>

                        <td>{item.attendance_date}</td>
                        <td>{formatDateTime(item.check_in_time)}</td>
                        <td>{formatDateTime(item.check_out_time)}</td>
                        <td>{formatHours(item.total_hours)}</td>

                        <td>
                          <span
                            className={
                              item.check_out_time
                                ? "status-pill active-status"
                                : "status-pill progress-status"
                            }
                          >
                            {item.check_out_time ? "Completed" : "Active"}
                          </span>
                        </td>

                        <td>{item.remarks || "-"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

const attendanceStyles = `
.attendance-page {
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

.refresh-button {
  min-width: 112px;
  height: 42px;
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #2563eb;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
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

.attendance-top-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(360px, 0.85fr);
  gap: 18px;
  align-items: stretch;
}

.admin-only-grid {
  grid-template-columns: 1fr;
}

.attendance-action-card,
.attendance-summary-card,
.attendance-toolbar-card,
.module-list-card {
  width: 100%;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid var(--erp-border);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.055);
}

.attendance-action-card,
.attendance-summary-card {
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

.today-status-box {
  min-height: 86px;
  padding: 15px;
  border-radius: 17px;
  background: linear-gradient(135deg, #f8fbff 0%, #eef6ff 100%);
  border: 1px solid #dbeafe;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
}

.today-status-box p {
  margin: 0;
  color: #52677e;
  font-size: 12px;
  font-weight: 600;
}

.today-status-box h3 {
  margin: 5px 0 0;
  color: #06142b;
  font-size: 23px;
  font-weight: 800;
}

.attendance-times {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.attendance-times div {
  min-height: 88px;
  padding: 13px;
  border-radius: 16px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
}

.attendance-times svg {
  color: #2563eb;
}

.attendance-times p {
  margin: 8px 0 5px;
  color: #52677e;
  font-size: 12px;
  font-weight: 600;
}

.attendance-times h4 {
  margin: 0;
  color: #06142b;
  font-size: 15px;
  font-weight: 800;
}

.mini-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.mini-summary-card {
  min-height: 92px;
  padding: 13px;
  border-radius: 16px;
  border: 1px solid #eef2f7;
}

.mini-summary-card svg {
  margin-bottom: 8px;
}

.mini-summary-card p {
  margin: 0;
  color: #52677e;
  font-size: 12px;
  font-weight: 600;
}

.mini-summary-card h3 {
  margin: 6px 0 0;
  color: #06142b;
  font-size: 24px;
  font-weight: 800;
}

.summary-blue {
  background: #eff6ff;
  color: #2563eb;
}

.summary-green {
  background: #ecfdf5;
  color: #059669;
}

.summary-orange {
  background: #fff7ed;
  color: #ea580c;
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

.form-group input,
.toolbar-filters select,
.search-box input {
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
.toolbar-filters select:focus,
.search-box:focus-within {
  border-color: #bfdbfe;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.10);
}

.small-note {
  margin: 12px 0 0;
  color: #64748b;
  font-size: 12px;
  font-weight: 500;
}

.attendance-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
}

.checkin-button,
.checkout-button {
  flex: 1;
  height: 42px;
  border: none;
  border-radius: 14px;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
}

.checkin-button {
  background: #16a34a;
}

.checkout-button {
  background: #ef4444;
}

.checkin-button:disabled,
.checkout-button:disabled,
.refresh-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.attendance-toolbar-card {
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

.module-list-card {
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

.table-wrap {
  width: 100%;
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 980px;
}

.data-table thead {
  background: #f8fafc;
}

.data-table th {
  padding: 13px 16px;
  color: #475569;
  font-size: 12px;
  font-weight: 700;
  text-align: left;
  border-bottom: 1px solid var(--erp-border-soft);
  white-space: nowrap;
}

.data-table td {
  padding: 14px 16px;
  color: #0f172a;
  font-size: 13px;
  font-weight: 400;
  border-bottom: 1px solid #eef2f7;
  vertical-align: middle;
}

.data-table tbody tr:hover {
  background: #f8fbff;
}

.data-table td strong {
  display: block;
  color: #06142b;
  font-size: 13px;
  font-weight: 700;
}

.data-table td span {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
  font-weight: 400;
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

.progress-status {
  color: #ea580c !important;
  background: #fff7ed;
  border: 1px solid #fed7aa;
}

.empty-table {
  text-align: center !important;
  color: #64748b !important;
  padding: 34px 16px !important;
  font-weight: 500 !important;
}

@media (max-width: 1200px) {
  .attendance-top-grid {
    grid-template-columns: 1fr;
  }

  .attendance-toolbar-card {
    grid-template-columns: 1fr;
  }

  .toolbar-filters {
    flex-wrap: wrap;
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

  .refresh-button {
    width: 100%;
  }

  .attendance-times,
  .mini-summary-grid {
    grid-template-columns: 1fr;
  }

  .attendance-actions {
    flex-direction: column;
  }

  .checkin-button,
  .checkout-button {
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

  .list-header {
    flex-direction: column;
    align-items: flex-start;
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

  .attendance-action-card,
  .attendance-summary-card,
  .attendance-toolbar-card {
    padding: 15px;
  }

  .list-header {
    padding: 16px;
  }
}
`;