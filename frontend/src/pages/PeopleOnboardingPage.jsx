import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Trash2,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import api from "../api/api";
import { useAuth } from "../context/AuthContext";

const PERSON_TYPES = [
  "employee",
  "intern",
  "freelancer",
  "sales-representative",
  "accountant",
  "manager",
  "hr",
];

const SALARY_TYPES = [
  "unpaid",
  "monthly",
  "stipend",
  "commission",
  "project-based",
  "hourly",
];

const STATUS_OPTIONS = ["active", "inactive", "on-leave"];

const PEOPLE_PER_PAGE = 20;

function formatOptionLabel(value) {
  if (!value) return "";

  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function PeopleOnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [people, setPeople] = useState([]);
  const [saving, setSaving] = useState(false);

  const [personTypeFilter, setPersonTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    person_type: "employee",
    department: "",
    designation: "",
    salary_type: "unpaid",
    salary_amount: "",
    joining_date: "",
    status: "active",
    notes: "",
  });

  const visiblePeople = useMemo(() => {
    return people.filter((person) => {
      const typeMatch = personTypeFilter
        ? person.person_type === personTypeFilter
        : true;

      const statusMatch = statusFilter ? person.status === statusFilter : true;

      return typeMatch && statusMatch;
    });
  }, [people, personTypeFilter, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(visiblePeople.length / PEOPLE_PER_PAGE)
  );

  const paginatedPeople = useMemo(() => {
    const startIndex = (currentPage - 1) * PEOPLE_PER_PAGE;
    return visiblePeople.slice(startIndex, startIndex + PEOPLE_PER_PAGE);
  }, [visiblePeople, currentPage]);

  const pageStart = visiblePeople.length
    ? (currentPage - 1) * PEOPLE_PER_PAGE + 1
    : 0;

  const pageEnd = Math.min(currentPage * PEOPLE_PER_PAGE, visiblePeople.length);

  const fetchPeople = async () => {
    try {
      const response = await api.get("/people");

      setPeople(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      alert(error?.response?.data?.detail || "Failed to load people");
    }
  };

  useEffect(() => {
    fetchPeople();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [personTypeFilter, statusFilter, people.length]);

  const updateField = (event) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
      salary_amount:
        name === "salary_type" && value === "unpaid" ? "" : prev.salary_amount,
    }));
  };

  const resetForm = () => {
    setFormData({
      full_name: "",
      email: "",
      phone: "",
      person_type: "employee",
      department: "",
      designation: "",
      salary_type: "unpaid",
      salary_amount: "",
      joining_date: "",
      status: "active",
      notes: "",
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);

      const payload = {
        ...(user?.company_id ? { company_id: user.company_id } : {}),
        full_name: formData.full_name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        person_type: formData.person_type,
        department: formData.department.trim() || null,
        designation: formData.designation.trim() || null,
        salary_type: formData.salary_type || "unpaid",
        salary_amount:
          formData.salary_type === "unpaid"
            ? 0
            : formData.salary_amount
            ? Number(formData.salary_amount)
            : null,
        joining_date: formData.joining_date || null,
        status: formData.status || "active",
        notes: formData.notes.trim() || null,
      };

      await api.post("/people", payload);

      resetForm();
      await fetchPeople();

      alert("Person onboarded successfully");
    } catch (error) {
      alert(error?.response?.data?.detail || "Failed to onboard person");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (personId) => {
    const confirmDeactivate = window.confirm(
      "Are you sure you want to deactivate this person?"
    );

    if (!confirmDeactivate) return;

    try {
      await api.delete(`/people/${personId}`);
      await fetchPeople();
      alert("Person deactivated successfully");
    } catch (error) {
      alert(error?.response?.data?.detail || "Failed to deactivate person");
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
      <style>{peoplePageStyles}</style>

      <div className="people-page">
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
              <UsersRound size={22} />
            </div>

            <div>
              <h1>People Onboarding</h1>
              <p>
                Onboard employees, interns, freelancers, and company people before
                giving software access.
              </p>
            </div>
          </div>

          <div className="header-count-pill">
            {people.length} People
          </div>
        </div>

        <form className="module-form-card" onSubmit={handleSubmit}>
          <div className="card-title-row">
            <div className="card-title-icon">
              <UserPlus size={19} />
            </div>

            <div>
              <h2>Onboard Person</h2>
              <p>
                Company will be selected automatically from the logged-in account.
              </p>
            </div>
          </div>

          <div className="form-content-grid">
            <div className="form-group">
              <label>Full Name</label>
              <input
                name="full_name"
                value={formData.full_name}
                onChange={updateField}
                placeholder="Enter full name"
                required
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={updateField}
                placeholder="person@example.com"
              />
            </div>

            <div className="form-group">
              <label>Phone</label>
              <input
                name="phone"
                value={formData.phone}
                onChange={updateField}
                placeholder="Phone number"
              />
            </div>

            <div className="form-group">
              <label>Person Type</label>
              <select
                name="person_type"
                value={formData.person_type}
                onChange={updateField}
              >
                {PERSON_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {formatOptionLabel(type)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Department</label>
              <input
                name="department"
                value={formData.department}
                onChange={updateField}
                placeholder="Development, Sales..."
              />
            </div>

            <div className="form-group">
              <label>Designation</label>
              <input
                name="designation"
                value={formData.designation}
                onChange={updateField}
                placeholder="Developer, Sales Executive..."
              />
            </div>

            <div className="form-group">
              <label>Salary Type</label>
              <select
                name="salary_type"
                value={formData.salary_type}
                onChange={updateField}
              >
                {SALARY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {formatOptionLabel(type)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Salary Amount</label>
              <input
                name="salary_amount"
                type="number"
                value={formData.salary_amount}
                onChange={updateField}
                placeholder="0"
                disabled={formData.salary_type === "unpaid"}
              />
            </div>

            <div className="form-group">
              <label>Joining Date</label>
              <input
                name="joining_date"
                type="date"
                value={formData.joining_date}
                onChange={updateField}
              />
            </div>

            <div className="form-group">
              <label>Status</label>
              <select name="status" value={formData.status} onChange={updateField}>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {formatOptionLabel(status)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group notes-group">
              <label>Notes</label>
              <input
                name="notes"
                value={formData.notes}
                onChange={updateField}
                placeholder="Any onboarding notes"
              />
            </div>
          </div>

          <div className="form-actions-row">
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? "Saving..." : "Onboard Person"}
            </button>
          </div>
        </form>

        <div className="module-list-card">
          <div className="list-header">
            <div>
              <h2>Onboarded People</h2>
              <p>
                Showing {pageStart}-{pageEnd} of {visiblePeople.length} people
              </p>
            </div>

            <div className="list-filters">
              <select
                value={personTypeFilter}
                onChange={(event) => setPersonTypeFilter(event.target.value)}
              >
                <option value="">All Types</option>
                {PERSON_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {formatOptionLabel(type)}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">All Status</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {formatOptionLabel(status)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Person</th>
                  <th>Type</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Salary</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {paginatedPeople.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="empty-table">
                      No onboarded people found
                    </td>
                  </tr>
                ) : (
                  paginatedPeople.map((person) => (
                    <tr key={person.id}>
                      <td>{person.id}</td>

                      <td>
                        <strong>{person.full_name}</strong>
                        <span>{person.email || person.phone || "-"}</span>
                      </td>

                      <td>
                        <span className="type-pill">
                          {formatOptionLabel(person.person_type)}
                        </span>
                      </td>

                      <td>{person.department || "-"}</td>

                      <td>{person.designation || "-"}</td>

                      <td>
                        ₹{person.salary_amount || 0}
                        <span>{formatOptionLabel(person.salary_type || "-")}</span>
                      </td>

                      <td>
                        <span
                          className={
                            person.is_active && person.status === "active"
                              ? "status-pill active-status"
                              : "status-pill inactive-status"
                          }
                        >
                          {formatOptionLabel(person.status || "inactive")}
                        </span>
                      </td>

                      <td>
                        {person.is_active ? (
                          <button
                            type="button"
                            className="icon-danger-button"
                            onClick={() => handleDeactivate(person.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
    </>
  );
}

const peoplePageStyles = `
.people-page {
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

.header-count-pill {
  min-height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #2563eb;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.module-form-card,
.module-list-card {
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 13px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}

.notes-group {
  grid-column: span 2;
}

.form-group label {
  color: #334155;
  font-size: 12px;
  font-weight: 700;
}

.form-group input,
.form-group select {
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

.form-group input:disabled {
  background: #f8fafc;
  color: #94a3b8;
  cursor: not-allowed;
}

.form-group input:focus,
.form-group select:focus {
  border-color: #bfdbfe;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.10);
}

.form-actions-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.primary-button {
  min-width: 165px;
  height: 42px;
  border: none;
  border-radius: 14px;
  background: #2563eb;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.primary-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
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

.list-filters {
  display: flex;
  align-items: center;
  gap: 10px;
}

.list-header select {
  min-width: 160px;
  height: 40px;
  border-radius: 13px;
  border: 1px solid #dbe5f2;
  background: #ffffff;
  color: #0f172a;
  padding: 0 12px;
  font-size: 13px;
  outline: none;
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

.type-pill,
.status-pill {
  width: fit-content;
  min-height: 26px;
  padding: 5px 10px;
  border-radius: 999px;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  margin-top: 0 !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  white-space: nowrap;
}

.type-pill {
  color: #2563eb !important;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
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
  width: 34px;
  height: 34px;
  border-radius: 12px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #dc2626;
  display: inline-grid;
  place-items: center;
}

.empty-table {
  text-align: center !important;
  color: #64748b !important;
  padding: 34px 16px !important;
  font-weight: 500 !important;
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
}

.pagination-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 1280px) {
  .form-content-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .notes-group {
    grid-column: span 3;
  }
}

@media (max-width: 980px) {
  .form-content-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .notes-group {
    grid-column: span 2;
  }

  .page-header {
    align-items: flex-start;
  }

  .list-header {
    align-items: flex-start;
  }

  .list-filters {
    flex-wrap: wrap;
    justify-content: flex-end;
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

  .header-count-pill {
    width: 100%;
  }

  .form-content-grid {
    grid-template-columns: 1fr;
  }

  .notes-group {
    grid-column: span 1;
  }

  .form-actions-row {
    justify-content: stretch;
  }

  .primary-button {
    width: 100%;
  }

  .list-header {
    flex-direction: column;
    align-items: stretch;
  }

  .list-filters {
    width: 100%;
    flex-direction: column;
  }

  .list-header select {
    width: 100%;
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

  .module-form-card {
    padding: 15px;
  }

  .list-header {
    padding: 16px;
  }
}
`;