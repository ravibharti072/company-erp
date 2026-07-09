import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  IndianRupee,
  Percent,
  RefreshCw,
  Save,
  Search,
  Trash2,
  WalletCards,
} from "lucide-react";

import api from "../api/api";
import { useAuth } from "../context/AuthContext";

const ADMIN_ROLES = ["super-admin", "company-admin", "admin", "owner"];

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replaceAll(" ", "-");
}

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function formatCurrency(value) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function formatDate(value) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatusLabel(status) {
  const value = String(status || "pending").toLowerCase();

  if (value === "paid") return "Paid";
  if (value === "partial") return "Partial";
  if (value === "cancelled") return "Cancelled";

  return "Pending";
}

function getStatusClass(status) {
  const value = String(status || "pending").toLowerCase();

  if (value === "paid") return "status-paid";
  if (value === "partial") return "status-partial";
  if (value === "cancelled") return "status-cancelled";

  return "status-pending";
}

export default function SalesCommissionPage() {
  const { user } = useAuth();

  const [commissions, setCommissions] = useState([]);
  const [summary, setSummary] = useState({});
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);

  const [statusFilter, setStatusFilter] = useState("all");
  const [searchText, setSearchText] = useState("");

  const [percentageInputs, setPercentageInputs] = useState({});
  const [paymentInputs, setPaymentInputs] = useState({});

  const [loading, setLoading] = useState(true);
  const [savingPercentageId, setSavingPercentageId] = useState(null);
  const [payingId, setPayingId] = useState(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const userRole = normalizeRole(user?.role);
  const isAdminUser = ADMIN_ROLES.includes(userRole);

  const leadMap = useMemo(() => {
    const map = new Map();

    leads.forEach((lead) => {
      map.set(Number(lead.id), lead);
    });

    return map;
  }, [leads]);

  const userMap = useMemo(() => {
    const map = new Map();

    users.forEach((item) => {
      map.set(Number(item.id), item);
    });

    return map;
  }, [users]);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const commissionParams = {};

      if (statusFilter !== "all") {
        commissionParams.status_filter = statusFilter;
      }

      const [commissionResult, summaryResult, leadsResult, usersResult] =
        await Promise.allSettled([
          api.get("/commissions", {
            params: commissionParams,
          }),
          api.get("/commissions/summary"),
          api.get("/sales/leads", {
            params: {
              active_only: false,
            },
          }),
          api.get("/users"),
        ]);

      if (commissionResult.status === "fulfilled") {
        const items = normalizeList(commissionResult.value?.data);
        setCommissions(items);

        setPercentageInputs((previous) => {
          const next = { ...previous };

          items.forEach((commission) => {
            next[commission.id] = String(
              Number(commission.commission_percentage || 0)
            );
          });

          return next;
        });
      } else {
        throw commissionResult.reason;
      }

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value?.data || {});
      }

      if (leadsResult.status === "fulfilled") {
        setLeads(normalizeList(leadsResult.value?.data));
      }

      if (usersResult.status === "fulfilled") {
        setUsers(normalizeList(usersResult.value?.data));
      }
    } catch (loadError) {
      console.error("Commission data load error:", loadError);
      setError(
        loadError?.response?.data?.detail ||
          "Unable to load sales commission data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const filteredCommissions = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    if (!search) return commissions;

    return commissions.filter((commission) => {
      const lead = leadMap.get(Number(commission.lead_id));
      const salesUser = userMap.get(
        Number(commission.sales_rep_user_id || lead?.sales_rep_user_id)
      );

      const searchSource = [
        commission.id,
        commission.lead_id,
        lead?.client_name,
        lead?.client_company_name,
        lead?.client_phone,
        lead?.client_email,
        salesUser?.full_name,
        salesUser?.name,
        salesUser?.email,
        commission.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchSource.includes(search);
    });
  }, [commissions, leadMap, searchText, userMap]);

  const calculatedSummary = useMemo(() => {
    if (summary && Object.keys(summary).length > 0) {
      return summary;
    }

    const totalCommissionAmount = commissions.reduce(
      (sum, item) => sum + Number(item.commission_amount || 0),
      0
    );

    const totalPaidAmount = commissions.reduce(
      (sum, item) => sum + Number(item.paid_amount || 0),
      0
    );

    return {
      total_commissions: commissions.length,
      pending_count: commissions.filter((item) => item.status === "pending")
        .length,
      partial_count: commissions.filter((item) => item.status === "partial")
        .length,
      paid_count: commissions.filter((item) => item.status === "paid").length,
      total_commission_amount: totalCommissionAmount,
      total_paid_amount: totalPaidAmount,
      total_due_amount: Math.max(totalCommissionAmount - totalPaidAmount, 0),
    };
  }, [commissions, summary]);

  const getLead = (commission) => {
    return leadMap.get(Number(commission.lead_id));
  };

  const getClientName = (commission) => {
    const lead = getLead(commission);
    return lead?.client_name || `Lead #${commission.lead_id}`;
  };

  const getClientSubtitle = (commission) => {
    const lead = getLead(commission);

    if (!lead) return "No contact details";

    return (
      lead.client_company_name ||
      lead.client_phone ||
      lead.client_email ||
      "No contact details"
    );
  };

  const getSalesRepName = (commission) => {
    const lead = getLead(commission);
    const salesRepId = commission.sales_rep_user_id || lead?.sales_rep_user_id;
    const salesUser = userMap.get(Number(salesRepId));

    return (
      salesUser?.full_name ||
      salesUser?.name ||
      salesUser?.username ||
      salesUser?.email ||
      (salesRepId ? `User #${salesRepId}` : "Not assigned")
    );
  };

  const updatePercentageInput = (commissionId, value) => {
    setPercentageInputs((previous) => ({
      ...previous,
      [commissionId]: value,
    }));
  };

  const updatePaymentInput = (commissionId, field, value) => {
    setPaymentInputs((previous) => ({
      ...previous,
      [commissionId]: {
        amount: "",
        payment_method: "cash",
        payment_date: "",
        remarks: "",
        ...(previous[commissionId] || {}),
        [field]: value,
      },
    }));
  };

  const getPaymentInput = (commissionId) => {
    return (
      paymentInputs[commissionId] || {
        amount: "",
        payment_method: "cash",
        payment_date: "",
        remarks: "",
      }
    );
  };

  const handleUpdatePercentage = async (commission) => {
    if (!isAdminUser) return;

    setError("");
    setSuccess("");

    const rawValue = percentageInputs[commission.id];
    const commissionPercentage = Number(rawValue || 0);

    if (!Number.isFinite(commissionPercentage) || commissionPercentage < 0) {
      setError("Commission percentage cannot be negative.");
      return;
    }

    setSavingPercentageId(commission.id);

    try {
      await api.put(`/commissions/${commission.id}/percentage`, {
        commission_percentage: commissionPercentage,
      });

      setSuccess("Commission percentage updated successfully.");
      await loadData();
    } catch (updateError) {
      console.error("Commission percentage update error:", updateError);
      setError(
        updateError?.response?.data?.detail ||
          "Unable to update commission percentage."
      );
    } finally {
      setSavingPercentageId(null);
    }
  };

  const handleAddPayment = async (commission) => {
    if (!isAdminUser) return;

    setError("");
    setSuccess("");

    const paymentForm = getPaymentInput(commission.id);
    const amount = Number(paymentForm.amount || 0);
    const dueAmount = Number(commission.due_amount || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    if (amount > dueAmount) {
      setError(
        `Payment amount cannot be greater than due amount ${formatCurrency(
          dueAmount
        )}.`
      );
      return;
    }

    setPayingId(commission.id);

    try {
      const payload = {
        amount,
        payment_method: paymentForm.payment_method || "cash",
        remarks: paymentForm.remarks || null,
      };

      if (paymentForm.payment_date) {
        payload.payment_date = paymentForm.payment_date;
      }

      await api.post(`/commissions/${commission.id}/payments`, payload);

      setPaymentInputs((previous) => ({
        ...previous,
        [commission.id]: {
          amount: "",
          payment_method: "cash",
          payment_date: "",
          remarks: "",
        },
      }));

      setSuccess("Commission payment added successfully.");
      await loadData();
    } catch (paymentError) {
      console.error("Commission payment error:", paymentError);
      setError(
        paymentError?.response?.data?.detail ||
          "Unable to add commission payment."
      );
    } finally {
      setPayingId(null);
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!isAdminUser) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this commission payment?"
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setDeletingPaymentId(paymentId);

    try {
      await api.delete(`/commissions/payments/${paymentId}`);

      setSuccess("Commission payment deleted successfully.");
      await loadData();
    } catch (deleteError) {
      console.error("Commission payment delete error:", deleteError);
      setError(
        deleteError?.response?.data?.detail ||
          "Unable to delete commission payment."
      );
    } finally {
      setDeletingPaymentId(null);
    }
  };

  return (
    <>
      <style>{commissionStyles}</style>

      <div className="commission-page">
        <section className="commission-header-card">
          <div className="commission-header-left">
            <div className="commission-header-icon">
              <Percent size={22} />
            </div>

            <div>
              <h1>Sales Commission</h1>
              <p>
                Manage auto-created commission records from converted software
                sales.
              </p>
            </div>
          </div>

          <div className="commission-header-actions">
            <span className="record-count">
              {formatNumber(calculatedSummary.total_commissions || 0)} Records
            </span>

            <button
              type="button"
              className="refresh-btn"
              onClick={loadData}
              disabled={loading}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </section>

        {error && (
          <div className="commission-alert error-alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="commission-alert success-alert">
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}

        <section className="commission-summary-grid">
          <article className="commission-summary-card">
            <p>PENDING</p>
            <strong>{formatNumber(calculatedSummary.pending_count)}</strong>
            <span>Waiting for payment</span>
          </article>

          <article className="commission-summary-card">
            <p>PARTIAL PAID</p>
            <strong>{formatNumber(calculatedSummary.partial_count)}</strong>
            <span>Some amount paid</span>
          </article>

          <article className="commission-summary-card">
            <p>PAID</p>
            <strong>{formatNumber(calculatedSummary.paid_count)}</strong>
            <span>Fully settled</span>
          </article>

          <article className="commission-summary-card">
            <p>TOTAL COMMISSION</p>
            <strong>
              {formatCurrency(calculatedSummary.total_commission_amount)}
            </strong>
            <span>Total commission value</span>
          </article>

          <article className="commission-summary-card">
            <p>TOTAL DUE</p>
            <strong>{formatCurrency(calculatedSummary.total_due_amount)}</strong>
            <span>Pending payout</span>
          </article>
        </section>

        <section className="commission-filter-card">
          <div className="search-box">
            <Search size={17} />
            <input
              type="text"
              placeholder="Search client, lead, sales user..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>

          <button
            type="button"
            className="clear-btn"
            onClick={() => {
              setSearchText("");
              setStatusFilter("all");
            }}
          >
            Clear
          </button>
        </section>

        <section className="commission-list-section">
          <div className="commission-list-header">
            <div>
              <h2>Commission List</h2>
              <p>
                {filteredCommissions.length}{" "}
                {filteredCommissions.length === 1
                  ? "commission record found"
                  : "commission records found"}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="commission-empty">Loading commission records...</div>
          ) : filteredCommissions.length === 0 ? (
            <div className="commission-empty">
              No commission records found. Convert a software sale first.
            </div>
          ) : (
            <div className="commission-grid">
              {filteredCommissions.map((commission) => {
                const paymentForm = getPaymentInput(commission.id);
                const payments = Array.isArray(commission.payments)
                  ? commission.payments
                  : [];

                const currentPercentage = Number(
                  percentageInputs[commission.id] || 0
                );

                const previewCommissionAmount =
                  (Number(commission.sale_amount || 0) *
                    currentPercentage) /
                  100;

                const dueAmount = Number(commission.due_amount || 0);
                const disablePayment = !isAdminUser || dueAmount <= 0;

                return (
                  <article className="commission-card" key={commission.id}>
                    <div className="commission-card-top">
                      <div className="commission-icon">
                        <Percent size={18} />
                      </div>

                      <span
                        className={`commission-status ${getStatusClass(
                          commission.status
                        )}`}
                      >
                        {getStatusLabel(commission.status)}
                      </span>
                    </div>

                    <div className="commission-main-info">
                      <h3>{getClientName(commission)}</h3>
                      <p>{getClientSubtitle(commission)}</p>
                    </div>

                    <div className="commission-meta">
                      <span>Lead #{commission.lead_id}</span>
                      <span>Sales: {getSalesRepName(commission)}</span>
                      <span>Created: {formatDate(commission.created_at)}</span>
                    </div>

                    <div className="commission-value-grid">
                      <div>
                        <p>SALE AMOUNT</p>
                        <strong>{formatCurrency(commission.sale_amount)}</strong>
                      </div>

                      <div>
                        <p>COMMISSION %</p>
                        <strong>
                          {Number(commission.commission_percentage || 0)}%
                        </strong>
                      </div>

                      <div>
                        <p>COMMISSION</p>
                        <strong>
                          {formatCurrency(commission.commission_amount)}
                        </strong>
                      </div>

                      <div>
                        <p>PAID</p>
                        <strong>{formatCurrency(commission.paid_amount)}</strong>
                      </div>

                      <div>
                        <p>DUE</p>
                        <strong>{formatCurrency(commission.due_amount)}</strong>
                      </div>
                    </div>

                    <div className="commission-form-box">
                      <div className="box-title">
                        <Percent size={15} />
                        <span>Set Commission Percentage</span>
                      </div>

                      <div className="percentage-row">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={percentageInputs[commission.id] ?? "0"}
                          onChange={(event) =>
                            updatePercentageInput(
                              commission.id,
                              event.target.value
                            )
                          }
                          disabled={!isAdminUser}
                        />

                        <button
                          type="button"
                          onClick={() => handleUpdatePercentage(commission)}
                          disabled={
                            !isAdminUser ||
                            savingPercentageId === commission.id
                          }
                        >
                          <Save size={14} />
                          {savingPercentageId === commission.id
                            ? "Saving..."
                            : "Save"}
                        </button>
                      </div>

                      <p className="preview-text">
                        Preview: {formatCurrency(previewCommissionAmount)}
                      </p>
                    </div>

                    <div className="commission-form-box">
                      <div className="box-title">
                        <WalletCards size={15} />
                        <span>Pay Commission</span>
                      </div>

                      <div className="payment-grid">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Amount"
                          value={paymentForm.amount}
                          onChange={(event) =>
                            updatePaymentInput(
                              commission.id,
                              "amount",
                              event.target.value
                            )
                          }
                          disabled={disablePayment}
                        />

                        <select
                          value={paymentForm.payment_method}
                          onChange={(event) =>
                            updatePaymentInput(
                              commission.id,
                              "payment_method",
                              event.target.value
                            )
                          }
                          disabled={disablePayment}
                        >
                          {PAYMENT_METHODS.map((method) => (
                            <option key={method.value} value={method.value}>
                              {method.label}
                            </option>
                          ))}
                        </select>

                        <input
                          type="date"
                          value={paymentForm.payment_date}
                          onChange={(event) =>
                            updatePaymentInput(
                              commission.id,
                              "payment_date",
                              event.target.value
                            )
                          }
                          disabled={disablePayment}
                        />

                        <input
                          type="text"
                          placeholder="Remarks"
                          value={paymentForm.remarks}
                          onChange={(event) =>
                            updatePaymentInput(
                              commission.id,
                              "remarks",
                              event.target.value
                            )
                          }
                          disabled={disablePayment}
                        />
                      </div>

                      <button
                        type="button"
                        className="pay-btn"
                        onClick={() => handleAddPayment(commission)}
                        disabled={disablePayment || payingId === commission.id}
                      >
                        <IndianRupee size={14} />
                        {payingId === commission.id
                          ? "Adding..."
                          : "Add Payment"}
                      </button>
                    </div>

                    <div className="payment-history">
                      <h4>Payment History</h4>

                      {payments.length === 0 ? (
                        <p className="no-payment-text">
                          No payment added yet.
                        </p>
                      ) : (
                        <div className="payment-history-list">
                          {payments.map((payment) => (
                            <div className="payment-row" key={payment.id}>
                              <div>
                                <strong>{formatCurrency(payment.amount)}</strong>
                                <span>
                                  {formatDate(payment.payment_date)} ·{" "}
                                  {String(payment.payment_method || "cash")
                                    .replaceAll("_", " ")
                                    .toUpperCase()}
                                </span>
                                {payment.remarks && <p>{payment.remarks}</p>}
                              </div>

                              {isAdminUser && (
                                <button
                                  type="button"
                                  onClick={() => handleDeletePayment(payment.id)}
                                  disabled={deletingPaymentId === payment.id}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

const commissionStyles = `
.commission-page {
  width: 100%;
  min-height: calc(100vh - 58px);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.commission-header-card {
  width: 100%;
  min-height: 96px;
  padding: 20px 22px;
  border-radius: 22px;
  background: #ffffff;
  border: 1px solid var(--erp-border);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.045);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.commission-header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.commission-header-icon {
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

.commission-header-card h1 {
  margin: 0;
  color: #06142b;
  font-size: 28px;
  line-height: 1.1;
  letter-spacing: -0.04em;
}

.commission-header-card p {
  margin: 7px 0 0;
  color: #334155;
  font-size: 13px;
  font-weight: 650;
}

.commission-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.record-count {
  min-height: 38px;
  padding: 0 16px;
  border-radius: 999px;
  background: #f8fafc;
  border: 1px solid #dbe3ef;
  color: #06142b;
  font-size: 13px;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

.refresh-btn {
  min-height: 42px;
  padding: 0 16px;
  border: none;
  border-radius: 13px;
  background: #2563eb;
  color: #ffffff;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 12px 22px rgba(37, 99, 235, 0.16);
}

.refresh-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.commission-alert {
  min-height: 46px;
  padding: 12px 15px;
  border-radius: 15px;
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 13px;
  font-weight: 850;
}

.error-alert {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
}

.success-alert {
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
  color: #059669;
}

.commission-summary-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}

.commission-summary-card {
  min-height: 112px;
  padding: 18px;
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid var(--erp-border);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.04);
}

.commission-summary-card p {
  margin: 0 0 12px;
  color: #64748b;
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.04em;
}

.commission-summary-card strong {
  display: block;
  color: #06142b;
  font-size: 24px;
  line-height: 1;
  font-weight: 950;
  white-space: nowrap;
}

.commission-summary-card span {
  display: block;
  margin-top: 12px;
  color: #52677e;
  font-size: 12px;
  font-weight: 700;
}

.commission-filter-card {
  padding: 14px;
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid var(--erp-border);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.04);
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px 78px;
  gap: 12px;
}

.search-box {
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid #dbe3ef;
  border-radius: 13px;
  background: #ffffff;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #64748b;
}

.search-box input,
.commission-filter-card select {
  width: 100%;
  height: 44px;
  border: none;
  outline: none;
  background: transparent;
  color: #06142b;
  font-size: 13px;
  font-weight: 750;
}

.commission-filter-card select {
  padding: 0 12px;
  border: 1px solid #dbe3ef;
  border-radius: 13px;
  background: #ffffff;
}

.clear-btn {
  height: 44px;
  border: 1px solid #dbe3ef;
  border-radius: 13px;
  background: #ffffff;
  color: #06142b;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.commission-list-section {
  width: 100%;
  min-height: 430px;
  border-radius: 22px;
  background: #ffffff;
  border: 1px solid var(--erp-border);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.05);
  overflow: hidden;
}

.commission-list-header {
  min-height: 78px;
  padding: 19px 20px;
  border-bottom: 1px solid var(--erp-border-soft);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.commission-list-header h2 {
  margin: 0;
  color: #06142b;
  font-size: 22px;
  letter-spacing: -0.03em;
}

.commission-list-header p {
  margin: 7px 0 0;
  color: #52677e;
  font-size: 13px;
  font-weight: 750;
}

.commission-empty {
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  font-size: 14px;
  font-weight: 850;
  text-align: center;
  padding: 24px;
}

.commission-grid {
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(3, minmax(360px, 1fr));
  gap: 16px;
  align-items: start;
}

.commission-card {
  padding: 16px;
  border-radius: 18px;
  border: 1px solid #dbe3ef;
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.045);
}

.commission-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.commission-icon {
  width: 42px;
  height: 42px;
  border-radius: 15px;
  display: grid;
  place-items: center;
  background: #eef6ff;
  border: 1px solid #dbeafe;
  color: #2563eb;
}

.commission-status {
  padding: 7px 11px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
  white-space: nowrap;
}

.status-pending {
  background: #fff7ed;
  color: #ea580c;
  border: 1px solid #fed7aa;
}

.status-partial {
  background: #eef6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
}

.status-paid {
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #bbf7d0;
}

.status-cancelled {
  background: #f1f5f9;
  color: #64748b;
  border: 1px solid #cbd5e1;
}

.commission-main-info {
  margin-top: 14px;
}

.commission-main-info h3 {
  margin: 0;
  color: #06142b;
  font-size: 18px;
  font-weight: 950;
}

.commission-main-info p {
  margin: 8px 0 0;
  color: #52677e;
  font-size: 13px;
  font-weight: 750;
}

.commission-meta {
  margin-top: 13px;
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.commission-meta span {
  padding: 6px 9px;
  border-radius: 999px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #64748b;
  font-size: 11px;
  font-weight: 850;
}

.commission-value-grid {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}

.commission-value-grid div {
  min-height: 62px;
  padding: 11px;
  border-radius: 13px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.commission-value-grid p {
  margin: 0 0 7px;
  color: #64748b;
  font-size: 10px;
  font-weight: 950;
  letter-spacing: 0.03em;
}

.commission-value-grid strong {
  display: block;
  color: #06142b;
  font-size: 15px;
  font-weight: 950;
  white-space: nowrap;
}

.commission-form-box {
  margin-top: 13px;
  padding: 12px;
  border-radius: 15px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
}

.box-title {
  margin-bottom: 10px;
  color: #06142b;
  font-size: 13px;
  font-weight: 950;
  display: flex;
  align-items: center;
  gap: 7px;
}

.percentage-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 95px;
  gap: 8px;
}

.percentage-row input,
.payment-grid input,
.payment-grid select {
  width: 100%;
  min-height: 40px;
  padding: 0 11px;
  border: 1px solid #dbe3ef;
  border-radius: 12px;
  background: #f8fafc;
  color: #06142b;
  outline: none;
  font-size: 13px;
  font-weight: 800;
}

.percentage-row input:disabled,
.payment-grid input:disabled,
.payment-grid select:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.percentage-row button,
.pay-btn {
  min-height: 40px;
  border: none;
  border-radius: 12px;
  background: #2563eb;
  color: #ffffff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 950;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
}

.percentage-row button:disabled,
.pay-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.preview-text {
  margin: 9px 0 0;
  color: #64748b;
  font-size: 12px;
  font-weight: 850;
}

.payment-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.pay-btn {
  margin-top: 9px;
  width: 100%;
  background: #059669;
}

.payment-history {
  margin-top: 14px;
  padding-top: 13px;
  border-top: 1px dashed #cbd5e1;
}

.payment-history h4 {
  margin: 0 0 10px;
  color: #06142b;
  font-size: 14px;
  font-weight: 950;
}

.no-payment-text {
  margin: 0;
  color: #64748b;
  font-size: 13px;
  font-weight: 750;
}

.payment-history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.payment-row {
  padding: 10px 12px;
  border-radius: 13px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.payment-row strong {
  display: block;
  color: #06142b;
  font-size: 14px;
  font-weight: 950;
}

.payment-row span {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-size: 11px;
  font-weight: 850;
}

.payment-row p {
  margin: 6px 0 0;
  color: #52677e;
  font-size: 12px;
  font-weight: 700;
}

.payment-row button {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 11px;
  background: #fee2e2;
  color: #dc2626;
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
}

.payment-row button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 1650px) {
  .commission-grid {
    grid-template-columns: repeat(2, minmax(360px, 1fr));
  }
}

@media (max-width: 1250px) {
  .commission-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .commission-filter-card {
    grid-template-columns: 1fr;
  }

  .commission-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .commission-header-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .commission-header-actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .record-count,
  .refresh-btn {
    width: 100%;
  }

  .commission-summary-grid {
    grid-template-columns: 1fr;
  }

  .commission-value-grid {
    grid-template-columns: 1fr;
  }
}
`;