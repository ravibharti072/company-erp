import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CreditCard,
  IndianRupee,
  PlusCircle,
  ReceiptText,
  RefreshCw,
  Search,
  WalletCards,
  X,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import api from "../api/api";
import { useAuth } from "../context/AuthContext";

const ADMIN_ROLES = ["super-admin", "company-admin", "admin", "owner"];

const PAYMENT_ALLOWED_LEAD_STATUSES = ["converted", "delivered", "completed"];

const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

const PAYMENT_TYPE_OPTIONS = [
  { value: "lead_payment", label: "Lead Payment" },
  { value: "other_payment", label: "Other Payment" },
];

function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

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

function normalizeStatus(value) {
  return String(value || "")
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

function formatCurrency(value) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
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

function getEmptyPaymentForm() {
  return {
    payment_type: "lead_payment",
    lead_id: "",
    payment_title: "",
    payer_name: "",
    payer_phone: "",
    payer_email: "",
    amount: "",
    payment_method: "upi",
    payment_date: getTodayDate(),
    reference_number: "",
    remarks: "",
  };
}

export default function ReceivePaymentPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [leads, setLeads] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentSummary, setPaymentSummary] = useState(null);

  const [form, setForm] = useState(getEmptyPaymentForm());

  const [searchText, setSearchText] = useState("");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [notification, setNotification] = useState({
    type: "",
    message: "",
  });

  const role = normalizeRole(user?.role);
  const isAdminUser = ADMIN_ROLES.includes(role);
  const canUsePaymentPage = hasPortalAccess(user, "sales");

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

  const convertedLeads = useMemo(() => {
    return leads.filter((lead) =>
      PAYMENT_ALLOWED_LEAD_STATUSES.includes(normalizeStatus(lead.status))
    );
  }, [leads]);

  const paymentsByLead = useMemo(() => {
    const map = new Map();

    payments.forEach((payment) => {
      if (!payment.lead_id || payment.payment_type !== "lead_payment") return;

      const existing = map.get(Number(payment.lead_id)) || [];
      existing.push(payment);
      map.set(Number(payment.lead_id), existing);
    });

    return map;
  }, [payments]);

  const selectedLead = useMemo(() => {
    if (!form.lead_id) return null;

    return leads.find((lead) => Number(lead.id) === Number(form.lead_id)) || null;
  }, [form.lead_id, leads]);

  const selectedLeadPaymentInfo = useMemo(() => {
    if (!selectedLead) {
      return {
        finalAmount: 0,
        totalReceived: 0,
        dueAmount: 0,
        paymentStatus: "unpaid",
      };
    }

    const leadPayments = paymentsByLead.get(Number(selectedLead.id)) || [];

    const totalReceived = leadPayments.reduce(
      (total, payment) => total + Number(payment.amount || 0),
      0
    );

    const finalAmount = Number(selectedLead.final_sale_amount || 0);
    const dueAmount = Math.max(finalAmount - totalReceived, 0);

    let paymentStatus = "unpaid";

    if (finalAmount <= 0 && totalReceived > 0) {
      paymentStatus = "advance_received";
    } else if (totalReceived <= 0) {
      paymentStatus = "unpaid";
    } else if (finalAmount > 0 && totalReceived >= finalAmount) {
      paymentStatus = "paid";
    } else {
      paymentStatus = "partial";
    }

    return {
      finalAmount,
      totalReceived,
      dueAmount,
      paymentStatus,
    };
  }, [selectedLead, paymentsByLead]);

  const localPaymentSummary = useMemo(() => {
    const totalReceived = payments.reduce(
      (total, payment) => total + Number(payment.amount || 0),
      0
    );

    const totalLeadPayments = payments
      .filter((payment) => payment.payment_type === "lead_payment")
      .reduce((total, payment) => total + Number(payment.amount || 0), 0);

    const totalOtherPayments = payments
      .filter((payment) => payment.payment_type === "other_payment")
      .reduce((total, payment) => total + Number(payment.amount || 0), 0);

    let totalPendingDue = 0;

    convertedLeads.forEach((lead) => {
      const leadPayments = paymentsByLead.get(Number(lead.id)) || [];

      const received = leadPayments.reduce(
        (total, payment) => total + Number(payment.amount || 0),
        0
      );

      const finalAmount = Number(lead.final_sale_amount || 0);

      if (finalAmount > received) {
        totalPendingDue += finalAmount - received;
      }
    });

    return {
      total_received: totalReceived,
      total_lead_payments: totalLeadPayments,
      total_other_payments: totalOtherPayments,
      total_pending_due_from_leads: totalPendingDue,
      total_payment_count: payments.length,
      lead_payment_count: payments.filter(
        (payment) => payment.payment_type === "lead_payment"
      ).length,
      other_payment_count: payments.filter(
        (payment) => payment.payment_type === "other_payment"
      ).length,
    };
  }, [payments, convertedLeads, paymentsByLead]);

  const displayPaymentSummary = useMemo(() => {
    return {
      ...localPaymentSummary,
      ...(paymentSummary || {}),
    };
  }, [localPaymentSummary, paymentSummary]);

  const filteredPayments = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return payments.filter((payment) => {
      const searchTarget = [
        payment.payment_title,
        payment.payer_name,
        payment.payer_phone,
        payment.payer_email,
        payment.payment_method,
        payment.payment_type,
        payment.reference_number,
        payment.remarks,
        payment.amount,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchMatch = search ? searchTarget.includes(search) : true;
      const typeMatch = paymentTypeFilter
        ? payment.payment_type === paymentTypeFilter
        : true;
      const methodMatch = methodFilter
        ? payment.payment_method === methodFilter
        : true;

      return searchMatch && typeMatch && methodMatch;
    });
  }, [payments, searchText, paymentTypeFilter, methodFilter]);

  const fetchLeads = async () => {
    try {
      const response = await api.get("/sales/leads");
      setLeads(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      showNotification("error", getErrorMessage(error, "Failed to load leads"));
    }
  };

  const fetchPayments = async () => {
    try {
      const response = await api.get("/sales/payments");
      setPayments(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      showNotification(
        "error",
        getErrorMessage(error, "Failed to load received payments")
      );
    }
  };

  const fetchPaymentSummary = async () => {
    try {
      const response = await api.get("/sales/payments/summary");
      setPaymentSummary(response.data || null);
    } catch (error) {
      console.error("Payment summary loading error:", error);
    }
  };

  const fetchAll = async () => {
    if (!canUsePaymentPage) return;

    try {
      setLoading(true);
      await Promise.all([fetchLeads(), fetchPayments(), fetchPaymentSummary()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUsePaymentPage]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    if (name === "payment_type") {
      if (value === "other_payment" && !isAdminUser) {
        showNotification("error", "Only admin can add other payment");
        return;
      }

      setForm({
        ...getEmptyPaymentForm(),
        payment_type: value,
      });

      return;
    }

    if (name === "lead_id") {
      const lead = leads.find((item) => Number(item.id) === Number(value));

      setForm((prev) => ({
        ...prev,
        lead_id: value,
        payment_title: lead ? `Payment from ${lead.client_name}` : "",
        payer_name: lead?.client_name || "",
        payer_phone: lead?.client_phone || "",
        payer_email: lead?.client_email || "",
      }));

      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setForm(getEmptyPaymentForm());
  };

  const handleSubmitPayment = async (event) => {
    event.preventDefault();

    const amount = Number(form.amount);

    if (form.payment_type === "lead_payment" && !form.lead_id) {
      showNotification("error", "Please choose a converted lead");
      return;
    }

    if (form.payment_type === "other_payment" && !isAdminUser) {
      showNotification("error", "Only admin can add other payment");
      return;
    }

    if (!amount || Number.isNaN(amount) || amount <= 0) {
      showNotification("error", "Payment amount must be greater than 0");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        lead_id:
          form.payment_type === "lead_payment" && form.lead_id
            ? Number(form.lead_id)
            : null,
        payment_type: form.payment_type,
        payment_title:
          form.payment_title.trim() ||
          (form.payment_type === "lead_payment"
            ? `Payment from ${selectedLead?.client_name || "Client"}`
            : "Other payment"),
        payer_name:
          form.payer_name.trim() ||
          (form.payment_type === "lead_payment"
            ? selectedLead?.client_name || "Client"
            : "Other payer"),
        payer_phone: form.payer_phone.trim() || null,
        payer_email: form.payer_email.trim() || null,
        amount,
        payment_method: form.payment_method || "upi",
        payment_date: form.payment_date || getTodayDate(),
        reference_number: form.reference_number.trim() || null,
        remarks: form.remarks.trim() || null,
      };

      await api.post("/sales/payments", payload);

      resetForm();
      await fetchAll();

      showNotification("success", "Received payment saved successfully");
    } catch (error) {
      showNotification(
        "error",
        getErrorMessage(error, "Failed to save received payment")
      );
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setSearchText("");
    setPaymentTypeFilter("");
    setMethodFilter("");
  };

  if (!canUsePaymentPage) {
    return (
      <>
        <style>{receivePaymentStyles}</style>

        <div className="receive-payment-page">
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
                <WalletCards size={22} />
              </div>

              <div>
                <h1>Payment Access Required</h1>
                <p>You do not have access to Sales / Receive Payment module.</p>
              </div>
            </div>
          </div>

          <div className="empty-state-card">
            <WalletCards size={34} />
            <h3>No Payment Access</h3>
            <p>Please contact Company Admin to enable Sales portal access.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{receivePaymentStyles}</style>

      <div className="receive-payment-page">
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
              <WalletCards size={22} />
            </div>

            <div>
              <h1>Receive Payment</h1>
              <p>
                Receive payment from converted leads or add other received payment
                not linked with any lead.
              </p>
            </div>
          </div>

          <div className="header-actions">
            <span className="count-pill">
              {loading ? "Loading..." : `${filteredPayments.length} Payments`}
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
            <div className="summary-icon green">
              <IndianRupee size={20} />
            </div>

            <div>
              <span>Total Received</span>
              <strong>
                {formatCurrency(displayPaymentSummary.total_received || 0)}
              </strong>
              <p>{displayPaymentSummary.total_payment_count || 0} payment records</p>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-icon blue">
              <ReceiptText size={20} />
            </div>

            <div>
              <span>Lead Payments</span>
              <strong>
                {formatCurrency(displayPaymentSummary.total_lead_payments || 0)}
              </strong>
              <p>{displayPaymentSummary.lead_payment_count || 0} lead payments</p>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-icon purple">
              <Banknote size={20} />
            </div>

            <div>
              <span>Other Payments</span>
              <strong>
                {formatCurrency(displayPaymentSummary.total_other_payments || 0)}
              </strong>
              <p>{displayPaymentSummary.other_payment_count || 0} other payments</p>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-icon orange">
              <CreditCard size={20} />
            </div>

            <div>
              <span>Pending Due</span>
              <strong>
                {formatCurrency(
                  displayPaymentSummary.total_pending_due_from_leads || 0
                )}
              </strong>
              <p>From converted leads</p>
            </div>
          </div>
        </section>

        <section className="payment-layout">
          <form className="payment-form-card" onSubmit={handleSubmitPayment}>
            <div className="card-title-row">
              <div className="card-title-icon">
                <PlusCircle size={19} />
              </div>

              <div>
                <h2>Add Received Payment</h2>
                <p>Choose lead payment or other payment.</p>
              </div>
            </div>

            <div className="payment-type-switch">
              {PAYMENT_TYPE_OPTIONS.map((option) => {
                const disabled = option.value === "other_payment" && !isAdminUser;

                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={disabled}
                    className={
                      form.payment_type === option.value ? "active" : ""
                    }
                    onClick={() =>
                      handleFormChange({
                        target: {
                          name: "payment_type",
                          value: option.value,
                        },
                      })
                    }
                  >
                    {option.label}
                    {disabled ? " Admin Only" : ""}
                  </button>
                );
              })}
            </div>

            <div className="form-grid">
              {form.payment_type === "lead_payment" && (
                <div className="form-group full-span">
                  <label>Choose Converted Lead *</label>
                  <select
                    name="lead_id"
                    value={form.lead_id}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="">Select converted / delivered / completed lead</option>

                    {convertedLeads.map((lead) => {
                      const leadPayments = paymentsByLead.get(Number(lead.id)) || [];

                      const received = leadPayments.reduce(
                        (total, payment) => total + Number(payment.amount || 0),
                        0
                      );

                      const finalAmount = Number(lead.final_sale_amount || 0);
                      const dueAmount = Math.max(finalAmount - received, 0);

                      return (
                        <option key={lead.id} value={lead.id}>
                          {lead.client_name} | {formatLabel(lead.status)} | Final{" "}
                          {formatCurrency(finalAmount)} | Due{" "}
                          {formatCurrency(dueAmount)}
                        </option>
                      );
                    })}
                  </select>

                  {convertedLeads.length === 0 && (
                    <small>
                      No converted lead found. First convert a lead from Sales page.
                    </small>
                  )}
                </div>
              )}

              {selectedLead && form.payment_type === "lead_payment" && (
                <div className="lead-payment-summary full-span">
                  <div>
                    <span>Client</span>
                    <strong>{selectedLead.client_name}</strong>
                  </div>

                  <div>
                    <span>Final Amount</span>
                    <strong>
                      {formatCurrency(selectedLeadPaymentInfo.finalAmount)}
                    </strong>
                  </div>

                  <div>
                    <span>Received</span>
                    <strong>
                      {formatCurrency(selectedLeadPaymentInfo.totalReceived)}
                    </strong>
                  </div>

                  <div>
                    <span>Due</span>
                    <strong>{formatCurrency(selectedLeadPaymentInfo.dueAmount)}</strong>
                  </div>
                </div>
              )}

              {form.payment_type === "other_payment" && (
                <>
                  <div className="form-group">
                    <label>Payment Title</label>
                    <input
                      name="payment_title"
                      value={form.payment_title}
                      onChange={handleFormChange}
                      placeholder="Example: Website maintenance advance"
                    />
                  </div>

                  <div className="form-group">
                    <label>Payer Name</label>
                    <input
                      name="payer_name"
                      value={form.payer_name}
                      onChange={handleFormChange}
                      placeholder="Client / payer name"
                    />
                  </div>

                  <div className="form-group">
                    <label>Payer Phone</label>
                    <input
                      name="payer_phone"
                      value={form.payer_phone}
                      onChange={handleFormChange}
                      placeholder="Phone number"
                    />
                  </div>

                  <div className="form-group">
                    <label>Payer Email</label>
                    <input
                      name="payer_email"
                      type="email"
                      value={form.payer_email}
                      onChange={handleFormChange}
                      placeholder="Email address"
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Received Amount *</label>
                <input
                  name="amount"
                  type="number"
                  min="1"
                  value={form.amount}
                  onChange={handleFormChange}
                  placeholder="Example: 25000"
                  required
                />
              </div>

              <div className="form-group">
                <label>Payment Method</label>
                <select
                  name="payment_method"
                  value={form.payment_method}
                  onChange={handleFormChange}
                >
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Payment Date</label>
                <input
                  name="payment_date"
                  type="date"
                  value={form.payment_date}
                  onChange={handleFormChange}
                />
              </div>

              <div className="form-group">
                <label>Reference Number</label>
                <input
                  name="reference_number"
                  value={form.reference_number}
                  onChange={handleFormChange}
                  placeholder="UPI ref / cheque no / transaction id"
                />
              </div>

              <div className="form-group full-span">
                <label>Remarks</label>
                <textarea
                  name="remarks"
                  value={form.remarks}
                  onChange={handleFormChange}
                  placeholder="Payment remarks"
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
                {saving ? "Saving..." : "Save Received Payment"}
              </button>
            </div>
          </form>

          <div className="payment-history-card">
            <div className="history-header">
              <div>
                <h2>Payment History</h2>
                <p>All received payment records you have access to.</p>
              </div>
            </div>

            <div className="filter-row">
              <div className="search-box">
                <Search size={17} />
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search payer, title, ref no, amount..."
                />
              </div>

              <select
                value={paymentTypeFilter}
                onChange={(event) => setPaymentTypeFilter(event.target.value)}
              >
                <option value="">All Types</option>
                <option value="lead_payment">Lead Payment</option>
                <option value="other_payment">Other Payment</option>
              </select>

              <select
                value={methodFilter}
                onChange={(event) => setMethodFilter(event.target.value)}
              >
                <option value="">All Methods</option>
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <button type="button" onClick={clearFilters}>
                Clear
              </button>
            </div>

            {filteredPayments.length === 0 ? (
              <div className="empty-payment-list">
                <ReceiptText size={32} />
                <h3>No payment found</h3>
                <p>Add received payment or change filters.</p>
              </div>
            ) : (
              <div className="payment-list">
                {filteredPayments.map((payment) => (
                  <article className="payment-row" key={payment.id}>
                    <div className="payment-row-icon">
                      <IndianRupee size={18} />
                    </div>

                    <div className="payment-row-main">
                      <h3>
                        {payment.payment_title ||
                          payment.payer_name ||
                          formatLabel(payment.payment_type)}
                      </h3>

                      <p>
                        {payment.payer_name || "-"} •{" "}
                        {formatLabel(payment.payment_method)} •{" "}
                        {payment.payment_date || "-"}
                      </p>

                      <div className="payment-meta">
                        <span className={`type-badge ${payment.payment_type}`}>
                          {formatLabel(payment.payment_type)}
                        </span>

                        {payment.reference_number && (
                          <span>Ref: {payment.reference_number}</span>
                        )}
                      </div>

                      {payment.remarks && <small>{payment.remarks}</small>}
                    </div>

                    <div className="payment-row-amount">
                      <strong>{formatCurrency(payment.amount)}</strong>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

const receivePaymentStyles = `
.receive-payment-page {
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
  color: #059669;
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
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
  background: #059669;
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

.summary-icon.green {
  color: #059669;
  background: #ecfdf5;
}

.summary-icon.blue {
  color: #2563eb;
  background: #eff6ff;
}

.summary-icon.purple {
  color: #7c3aed;
  background: #f5f3ff;
}

.summary-icon.orange {
  color: #ea580c;
  background: #fff7ed;
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

.payment-layout {
  display: grid;
  grid-template-columns: minmax(380px, 0.82fr) minmax(520px, 1.18fr);
  gap: 18px;
  align-items: start;
}

.payment-form-card,
.payment-history-card {
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid var(--erp-border, #e2e8f0);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.055);
}

.payment-form-card {
  padding: 18px;
}

.payment-history-card {
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
  color: #059669;
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
  flex-shrink: 0;
}

.card-title-row h2,
.history-header h2 {
  margin: 0;
  color: #06142b;
  font-size: 21px;
  font-weight: 800;
}

.card-title-row p,
.history-header p {
  margin: 6px 0 0;
  color: #52677e;
  font-size: 12px;
  font-weight: 500;
}

.payment-type-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 15px;
}

.payment-type-switch button {
  min-height: 42px;
  border-radius: 14px;
  border: 1px solid #dbe5f2;
  background: #ffffff;
  color: #0f172a;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.payment-type-switch button.active {
  border-color: #86efac;
  background: #ecfdf5;
  color: #059669;
}

.payment-type-switch button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
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

.lead-payment-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  padding: 12px;
  border-radius: 17px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
}

.lead-payment-summary div {
  min-height: 66px;
  padding: 11px;
  border-radius: 14px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
}

.lead-payment-summary span {
  display: block;
  color: #64748b;
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.lead-payment-summary strong {
  display: block;
  margin-top: 6px;
  color: #06142b;
  font-size: 13px;
  font-weight: 900;
  word-break: break-word;
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
  background: #059669;
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

.history-header {
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

.payment-list {
  max-height: 650px;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 11px;
}

.payment-row {
  min-height: 96px;
  padding: 14px;
  border-radius: 17px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
  display: flex;
  align-items: center;
  gap: 12px;
}

.payment-row-icon {
  width: 44px;
  height: 44px;
  border-radius: 15px;
  background: #ecfdf5;
  color: #059669;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.payment-row-main {
  flex: 1;
  min-width: 0;
}

.payment-row-main h3 {
  margin: 0;
  color: #06142b;
  font-size: 15px;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.payment-row-main p {
  margin: 6px 0 0;
  color: #52677e;
  font-size: 12px;
  font-weight: 600;
}

.payment-row-main small {
  display: block;
  margin-top: 7px;
  color: #334155;
  font-size: 12px;
  font-weight: 600;
}

.payment-meta {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.payment-meta span {
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

.type-badge.lead_payment {
  color: #2563eb;
  background: #eff6ff;
}

.type-badge.other_payment {
  color: #7c3aed;
  background: #f5f3ff;
}

.payment-row-amount {
  flex-shrink: 0;
  text-align: right;
}

.payment-row-amount strong {
  color: #059669;
  font-size: 17px;
  font-weight: 900;
}

.empty-payment-list,
.empty-state-card {
  min-height: 280px;
  padding: 34px 20px;
  color: #059669;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  text-align: center;
  gap: 10px;
  background: #ffffff;
}

.empty-payment-list h3,
.empty-state-card h3 {
  margin: 0;
  color: #06142b;
  font-size: 18px;
  font-weight: 800;
}

.empty-payment-list p,
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

  .payment-layout {
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

  .lead-payment-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .summary-grid,
  .form-grid,
  .payment-type-switch,
  .lead-payment-summary {
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

  .payment-row {
    align-items: flex-start;
  }

  .payment-row-amount {
    text-align: left;
  }
}
`;