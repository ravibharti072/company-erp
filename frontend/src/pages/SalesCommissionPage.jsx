import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  IndianRupee,
  Mail,
  Percent,
  Phone,
  Save,
  Search,
  Trash2,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

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
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function formatDate(value) {
  if (!value) return "-";

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return String(value);
  }

  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "-";

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return String(value);
  }

  return parsedDate.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusLabel(status) {
  const value = String(status || "pending").toLowerCase();

  if (value === "paid") return "Paid";
  if (value === "partial") return "Partial Paid";
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

function getPaymentMethodLabel(value) {
  const method = PAYMENT_METHODS.find(
    (item) => item.value === String(value || "").toLowerCase()
  );

  if (method) return method.label;

  return String(value || "cash")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function stopPropagation(event) {
  event.stopPropagation();
}

export default function SalesCommissionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [commissions, setCommissions] = useState([]);
  const [summary, setSummary] = useState({});
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);

  const [statusFilter, setStatusFilter] = useState("all");
  const [searchText, setSearchText] = useState("");

  const [percentageInputs, setPercentageInputs] = useState({});
  const [paymentInputs, setPaymentInputs] = useState({});

  const [selectedCommissionId, setSelectedCommissionId] = useState(null);

  const [commissionToDelete, setCommissionToDelete] = useState(null);
  const [paymentToDelete, setPaymentToDelete] = useState(null);

  const [loading, setLoading] = useState(true);
  const [savingPercentageId, setSavingPercentageId] = useState(null);
  const [payingId, setPayingId] = useState(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState(null);
  const [deletingCommissionId, setDeletingCommissionId] = useState(null);

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

  const selectedCommission = useMemo(() => {
    if (!selectedCommissionId) return null;

    return (
      commissions.find(
        (commission) =>
          Number(commission.id) === Number(selectedCommissionId)
      ) || null
    );
  }, [commissions, selectedCommissionId]);

  const loadData = async () => {
    setLoading(true);
    setError("");

    const commissionParams = {};

    if (statusFilter !== "all") {
      commissionParams.status_filter = statusFilter;
    }

    try {
      const commissionResponse = await api.get("/commissions", {
        params: commissionParams,
      });

      const commissionItems = normalizeList(commissionResponse?.data);

      setCommissions(commissionItems);

      setPercentageInputs((previous) => {
        const next = { ...previous };

        commissionItems.forEach((commission) => {
          next[commission.id] = String(
            Number(commission.commission_percentage || 0)
          );
        });

        return next;
      });

      if (selectedCommissionId) {
        const selectedStillExists = commissionItems.some(
          (commission) =>
            Number(commission.id) === Number(selectedCommissionId)
        );

        if (!selectedStillExists) {
          setSelectedCommissionId(null);
        }
      }

      setLoading(false);

      const [summaryResult, leadsResult, usersResult] =
        await Promise.allSettled([
          api.get("/commissions/summary"),
          api.get("/sales/leads", {
            params: {
              active_only: false,
            },
          }),
          api.get("/users"),
        ]);

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value?.data || {});
      } else {
        setSummary({});
        console.error(
          "Commission summary loading error:",
          summaryResult.reason
        );
      }

      if (leadsResult.status === "fulfilled") {
        setLeads(normalizeList(leadsResult.value?.data));
      } else {
        setLeads([]);
        console.error("Sales leads loading error:", leadsResult.reason);
      }

      if (usersResult.status === "fulfilled") {
        setUsers(normalizeList(usersResult.value?.data));
      } else {
        setUsers([]);
        console.error("Users loading error:", usersResult.reason);
      }
    } catch (loadError) {
      console.error("Commission data loading error:", loadError);

      setCommissions([]);
      setSummary({});

      setError(
        loadError?.response?.data?.detail ||
          "Unable to load sales commission data."
      );

      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    const modalOpen =
      Boolean(selectedCommission) ||
      Boolean(commissionToDelete) ||
      Boolean(paymentToDelete);

    if (!modalOpen) return undefined;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleEscape = (event) => {
      if (event.key !== "Escape") return;

      if (paymentToDelete) {
        setPaymentToDelete(null);
        return;
      }

      if (commissionToDelete) {
        setCommissionToDelete(null);
        return;
      }

      setSelectedCommissionId(null);
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [selectedCommission, commissionToDelete, paymentToDelete]);

  const filteredCommissions = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    if (!search) return commissions;

    return commissions.filter((commission) => {
      const lead = leadMap.get(Number(commission.lead_id));

      const salesUser = userMap.get(
        Number(
          commission.sales_rep_user_id || lead?.sales_rep_user_id
        )
      );

      const searchableText = [
        commission.id,
        commission.lead_id,
        commission.status,
        lead?.client_name,
        lead?.company_name,
        lead?.client_company_name,
        lead?.business_name,
        lead?.phone,
        lead?.client_phone,
        lead?.email,
        lead?.client_email,
        lead?.service_type,
        lead?.software_type,
        salesUser?.full_name,
        salesUser?.name,
        salesUser?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(search);
    });
  }, [commissions, leadMap, searchText, userMap]);

  const calculatedSummary = useMemo(() => {
    if (summary && Object.keys(summary).length > 0) {
      return summary;
    }

    const totalCommissionAmount = commissions.reduce(
      (total, commission) =>
        total + Number(commission.commission_amount || 0),
      0
    );

    const totalPaidAmount = commissions.reduce(
      (total, commission) =>
        total + Number(commission.paid_amount || 0),
      0
    );

    return {
      total_commissions: commissions.length,

      pending_count: commissions.filter(
        (commission) =>
          String(commission.status).toLowerCase() === "pending"
      ).length,

      partial_count: commissions.filter(
        (commission) =>
          String(commission.status).toLowerCase() === "partial"
      ).length,

      paid_count: commissions.filter(
        (commission) =>
          String(commission.status).toLowerCase() === "paid"
      ).length,

      total_commission_amount: totalCommissionAmount,
      total_paid_amount: totalPaidAmount,
      total_due_amount: Math.max(
        totalCommissionAmount - totalPaidAmount,
        0
      ),
    };
  }, [commissions, summary]);

  const getLead = (commission) => {
    return leadMap.get(Number(commission?.lead_id));
  };

  const getClientName = (commission) => {
    const lead = getLead(commission);

    return lead?.client_name || `Lead #${commission?.lead_id || "-"}`;
  };

  const getCompanyName = (commission) => {
    const lead = getLead(commission);

    return (
      lead?.company_name ||
      lead?.client_company_name ||
      lead?.business_name ||
      "-"
    );
  };

  const getClientPhone = (commission) => {
    const lead = getLead(commission);

    return lead?.phone || lead?.client_phone || "-";
  };

  const getClientEmail = (commission) => {
    const lead = getLead(commission);

    return lead?.email || lead?.client_email || "-";
  };

  const getServiceType = (commission) => {
    const lead = getLead(commission);

    return (
      lead?.service_type ||
      lead?.software_type ||
      lead?.product_name ||
      "Not specified"
    );
  };

  const getClientSubtitle = (commission) => {
    const companyName = getCompanyName(commission);

    if (companyName !== "-") return companyName;

    const phone = getClientPhone(commission);

    if (phone !== "-") return phone;

    const email = getClientEmail(commission);

    if (email !== "-") return email;

    return "No contact details";
  };

  const getSalesRepName = (commission) => {
    const lead = getLead(commission);

    const salesRepId =
      commission?.sales_rep_user_id || lead?.sales_rep_user_id;

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

  const showError = (message) => {
    setSuccess("");
    setError(message);
  };

  const showSuccess = (message) => {
    setError("");
    setSuccess(message);
  };

  const handleUpdatePercentage = async (commission) => {
    if (!isAdminUser) return;

    setError("");
    setSuccess("");

    const commissionPercentage = Number(
      percentageInputs[commission.id] || 0
    );

    if (
      !Number.isFinite(commissionPercentage) ||
      commissionPercentage < 0
    ) {
      showError("Commission percentage cannot be negative.");
      return;
    }

    if (commissionPercentage > 100) {
      showError("Commission percentage cannot be greater than 100%.");
      return;
    }

    setSavingPercentageId(commission.id);

    try {
      await api.put(`/commissions/${commission.id}/percentage`, {
        commission_percentage: commissionPercentage,
      });

      showSuccess("Commission percentage updated successfully.");

      await loadData();
    } catch (updateError) {
      console.error("Commission percentage update error:", updateError);

      showError(
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

    const paymentAmount = Number(paymentForm.amount || 0);
    const dueAmount = Number(commission.due_amount || 0);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      showError("Enter a valid payment amount.");
      return;
    }

    if (paymentAmount > dueAmount) {
      showError(
        `Payment amount cannot be greater than due amount ${formatCurrency(
          dueAmount
        )}.`
      );

      return;
    }

    setPayingId(commission.id);

    try {
      const payload = {
        amount: paymentAmount,
        payment_method: paymentForm.payment_method || "cash",
        remarks: paymentForm.remarks?.trim() || null,
      };

      if (paymentForm.payment_date) {
        payload.payment_date = paymentForm.payment_date;
      }

      await api.post(
        `/commissions/${commission.id}/payments`,
        payload
      );

      setPaymentInputs((previous) => ({
        ...previous,
        [commission.id]: {
          amount: "",
          payment_method: "cash",
          payment_date: "",
          remarks: "",
        },
      }));

      showSuccess("Commission payment added successfully.");

      await loadData();
    } catch (paymentError) {
      console.error("Commission payment error:", paymentError);

      showError(
        paymentError?.response?.data?.detail ||
          "Unable to add commission payment."
      );
    } finally {
      setPayingId(null);
    }
  };

  const handleDeletePayment = async () => {
    if (!isAdminUser || !paymentToDelete?.id) return;

    setError("");
    setSuccess("");
    setDeletingPaymentId(paymentToDelete.id);

    try {
      await api.delete(
        `/commissions/payments/${paymentToDelete.id}`
      );

      setPaymentToDelete(null);

      showSuccess("Commission payment deleted successfully.");

      await loadData();
    } catch (deleteError) {
      console.error("Commission payment deletion error:", deleteError);

      showError(
        deleteError?.response?.data?.detail ||
          "Unable to delete commission payment."
      );
    } finally {
      setDeletingPaymentId(null);
    }
  };

  const handleDeleteCommission = async () => {
    if (!isAdminUser || !commissionToDelete?.id) return;

    setError("");
    setSuccess("");
    setDeletingCommissionId(commissionToDelete.id);

    try {
      await api.delete(`/commissions/${commissionToDelete.id}`);

      if (
        Number(selectedCommissionId) ===
        Number(commissionToDelete.id)
      ) {
        setSelectedCommissionId(null);
      }

      setCommissionToDelete(null);

      showSuccess("Commission record deleted successfully.");

      await loadData();
    } catch (deleteError) {
      console.error("Commission deletion error:", deleteError);

      showError(
        deleteError?.response?.data?.detail ||
          "Unable to delete commission record."
      );
    } finally {
      setDeletingCommissionId(null);
    }
  };

  const closeCommissionDetails = () => {
    if (
      savingPercentageId ||
      payingId ||
      deletingPaymentId ||
      deletingCommissionId
    ) {
      return;
    }

    setSelectedCommissionId(null);
  };

  const renderCommissionDetails = (commission) => {
    if (!commission) return null;

    const paymentForm = getPaymentInput(commission.id);

    const payments = Array.isArray(commission.payments)
      ? [...commission.payments].sort((first, second) => {
          const firstDate = new Date(
            first.payment_date || first.created_at || 0
          ).getTime();

          const secondDate = new Date(
            second.payment_date || second.created_at || 0
          ).getTime();

          return secondDate - firstDate;
        })
      : [];

    const currentPercentage = Number(
      percentageInputs[commission.id] || 0
    );

    const previewCommissionAmount =
      (Number(commission.sale_amount || 0) * currentPercentage) / 100;

    const dueAmount = Number(commission.due_amount || 0);

    const isPaid =
      String(commission.status).toLowerCase() === "paid";

    const disablePayment =
      !isAdminUser || dueAmount <= 0 || isPaid;

    return (
      <div
        className="commission-modal-backdrop"
        onMouseDown={closeCommissionDetails}
      >
        <section
          className="commission-detail-modal"
          onMouseDown={stopPropagation}
        >
          <header className="commission-modal-header">
            <div className="commission-modal-heading">
              <div className="commission-modal-icon">
                <Percent size={21} />
              </div>

              <div>
                <div className="modal-heading-line">
                  <h2>{getClientName(commission)}</h2>

                  <span
                    className={`commission-status ${getStatusClass(
                      commission.status
                    )}`}
                  >
                    {getStatusLabel(commission.status)}
                  </span>
                </div>

                <p>
                  Commission #{commission.id} · Lead #
                  {commission.lead_id}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="modal-close-btn"
              onClick={closeCommissionDetails}
              aria-label="Close commission details"
            >
              <X size={18} />
            </button>
          </header>

          <div className="commission-modal-body">
            <section className="detail-section">
              <div className="detail-section-header">
                <div>
                  <h3>Lead and customer details</h3>
                  <p>
                    Complete information connected to this commission.
                  </p>
                </div>
              </div>

              <div className="client-detail-grid">
                <div className="client-detail-item">
                  <UserRound size={17} />

                  <div>
                    <span>Client name</span>
                    <strong>{getClientName(commission)}</strong>
                  </div>
                </div>

                <div className="client-detail-item">
                  <Building2 size={17} />

                  <div>
                    <span>Company</span>
                    <strong>{getCompanyName(commission)}</strong>
                  </div>
                </div>

                <div className="client-detail-item">
                  <Phone size={17} />

                  <div>
                    <span>Phone</span>
                    <strong>{getClientPhone(commission)}</strong>
                  </div>
                </div>

                <div className="client-detail-item">
                  <Mail size={17} />

                  <div>
                    <span>Email</span>
                    <strong>{getClientEmail(commission)}</strong>
                  </div>
                </div>

                <div className="client-detail-item">
                  <WalletCards size={17} />

                  <div>
                    <span>Software / service</span>
                    <strong>{getServiceType(commission)}</strong>
                  </div>
                </div>

                <div className="client-detail-item">
                  <UserRound size={17} />

                  <div>
                    <span>Sales user</span>
                    <strong>{getSalesRepName(commission)}</strong>
                  </div>
                </div>

                <div className="client-detail-item">
                  <CalendarDays size={17} />

                  <div>
                    <span>Created</span>
                    <strong>
                      {formatDateTime(commission.created_at)}
                    </strong>
                  </div>
                </div>

                <div className="client-detail-item">
                  <Clock3 size={17} />

                  <div>
                    <span>Last updated</span>
                    <strong>
                      {formatDateTime(
                        commission.updated_at ||
                          commission.created_at
                      )}
                    </strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="detail-section">
              <div className="detail-section-header">
                <div>
                  <h3>Commission summary</h3>
                  <p>
                    Sale value, commission, paid amount and pending
                    amount.
                  </p>
                </div>
              </div>

              <div className="modal-value-grid">
                <article>
                  <span>Sale amount</span>
                  <strong>
                    {formatCurrency(commission.sale_amount)}
                  </strong>
                </article>

                <article>
                  <span>Commission percentage</span>
                  <strong>
                    {Number(
                      commission.commission_percentage || 0
                    )}
                    %
                  </strong>
                </article>

                <article>
                  <span>Total commission</span>
                  <strong>
                    {formatCurrency(commission.commission_amount)}
                  </strong>
                </article>

                <article className="paid-value-card">
                  <span>Commission paid</span>
                  <strong>
                    {formatCurrency(commission.paid_amount)}
                  </strong>
                </article>

                <article className="due-value-card">
                  <span>Commission due</span>
                  <strong>
                    {formatCurrency(commission.due_amount)}
                  </strong>
                </article>
              </div>
            </section>

            {isAdminUser && (
              <section className="detail-section">
                <div className="detail-section-header">
                  <div>
                    <h3>Set commission percentage</h3>
                    <p>
                      Changing the percentage recalculates the
                      commission amount.
                    </p>
                  </div>
                </div>

                <div className="modal-percentage-row">
                  <div className="modal-input-group">
                    <label
                      htmlFor={`percentage-${commission.id}`}
                    >
                      Commission percentage
                    </label>

                    <div className="input-with-symbol">
                      <Percent size={16} />

                      <input
                        id={`percentage-${commission.id}`}
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={
                          percentageInputs[commission.id] ?? "0"
                        }
                        onChange={(event) =>
                          updatePercentageInput(
                            commission.id,
                            event.target.value
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="commission-preview-box">
                    <span>Calculated commission</span>

                    <strong>
                      {formatCurrency(previewCommissionAmount)}
                    </strong>
                  </div>

                  <button
                    type="button"
                    className="primary-modal-btn"
                    onClick={() =>
                      handleUpdatePercentage(commission)
                    }
                    disabled={
                      savingPercentageId === commission.id
                    }
                  >
                    <Save size={16} />

                    {savingPercentageId === commission.id
                      ? "Saving..."
                      : "Save Percentage"}
                  </button>
                </div>
              </section>
            )}

            {isAdminUser && (
              <section className="detail-section">
                <div className="detail-section-header">
                  <div>
                    <h3>Pay commission</h3>
                    <p>
                      Add full or partial commission payments for the
                      sales user.
                    </p>
                  </div>

                  <span className="section-due-label">
                    Due: {formatCurrency(dueAmount)}
                  </span>
                </div>

                {isPaid ? (
                  <div className="commission-paid-message">
                    <CheckCircle2 size={20} />

                    <div>
                      <strong>Commission fully paid</strong>

                      <span>
                        No additional payment is required.
                      </span>
                    </div>
                  </div>
                ) : dueAmount <= 0 ? (
                  <div className="commission-paid-message">
                    <CheckCircle2 size={20} />

                    <div>
                      <strong>No commission amount is due</strong>

                      <span>
                        Set a commission percentage before adding
                        payment.
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="modal-payment-grid">
                      <div className="modal-input-group">
                        <label
                          htmlFor={`payment-amount-${commission.id}`}
                        >
                          Payment amount
                        </label>

                        <div className="input-with-symbol">
                          <IndianRupee size={16} />

                          <input
                            id={`payment-amount-${commission.id}`}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Enter amount"
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
                        </div>
                      </div>

                      <div className="modal-input-group">
                        <label
                          htmlFor={`payment-method-${commission.id}`}
                        >
                          Payment method
                        </label>

                        <select
                          id={`payment-method-${commission.id}`}
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
                            <option
                              key={method.value}
                              value={method.value}
                            >
                              {method.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="modal-input-group">
                        <label
                          htmlFor={`payment-date-${commission.id}`}
                        >
                          Payment date
                        </label>

                        <input
                          id={`payment-date-${commission.id}`}
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
                      </div>

                      <div className="modal-input-group modal-remarks-field">
                        <label
                          htmlFor={`payment-remarks-${commission.id}`}
                        >
                          Remarks
                        </label>

                        <input
                          id={`payment-remarks-${commission.id}`}
                          type="text"
                          placeholder="Optional payment remarks"
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
                    </div>

                    <div className="payment-action-row">
                      <button
                        type="button"
                        className="payment-submit-btn"
                        onClick={() =>
                          handleAddPayment(commission)
                        }
                        disabled={
                          disablePayment ||
                          payingId === commission.id
                        }
                      >
                        <IndianRupee size={16} />

                        {payingId === commission.id
                          ? "Adding Payment..."
                          : "Add Commission Payment"}
                      </button>
                    </div>
                  </>
                )}
              </section>
            )}

            <section className="detail-section">
              <div className="detail-section-header">
                <div>
                  <h3>Payment history</h3>
                  <p>
                    All full and partial payments made for this
                    commission.
                  </p>
                </div>

                <span className="payment-count-badge">
                  {payments.length}{" "}
                  {payments.length === 1 ? "Payment" : "Payments"}
                </span>
              </div>

              {payments.length === 0 ? (
                <div className="modal-empty-state">
                  <WalletCards size={23} />

                  <strong>No payment added</strong>

                  <span>
                    Commission payment history will appear here.
                  </span>
                </div>
              ) : (
                <div className="modal-payment-history">
                  {payments.map((payment) => (
                    <article
                      className="modal-payment-history-item"
                      key={payment.id}
                    >
                      <div className="payment-history-main">
                        <div className="payment-history-icon">
                          <IndianRupee size={17} />
                        </div>

                        <div>
                          <strong>
                            {formatCurrency(payment.amount)}
                          </strong>

                          <span>
                            {formatDate(
                              payment.payment_date ||
                                payment.created_at
                            )}{" "}
                            ·{" "}
                            {getPaymentMethodLabel(
                              payment.payment_method
                            )}
                          </span>

                          {payment.remarks && (
                            <p>{payment.remarks}</p>
                          )}
                        </div>
                      </div>

                      {isAdminUser && (
                        <button
                          type="button"
                          className="payment-delete-btn"
                          onClick={() =>
                            setPaymentToDelete({
                              ...payment,
                              commission_id: commission.id,
                              client_name:
                                getClientName(commission),
                            })
                          }
                          disabled={
                            deletingPaymentId === payment.id
                          }
                        >
                          <Trash2 size={15} />
                          Delete
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            {isAdminUser && (
              <section className="commission-danger-section">
                <div>
                  <h3>Delete commission record</h3>

                  <p>
                    This removes the commission and its payment
                    history.
                  </p>
                </div>

                <button
                  type="button"
                  className="danger-delete-btn"
                  onClick={() =>
                    setCommissionToDelete(commission)
                  }
                >
                  <Trash2 size={16} />
                  Delete Commission
                </button>
              </section>
            )}
          </div>
        </section>
      </div>
    );
  };

  return (
    <>
      <style>{commissionStyles}</style>

      <div className="commission-page">
        <section className="commission-header-card">
          <div className="commission-header-left">
            <button
              type="button"
              className="commission-back-button"
              onClick={() => navigate(-1)}
              aria-label="Go back"
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>

            <div className="commission-header-icon">
              <Percent size={21} />
            </div>

            <div>
              <h1>Sales Commission</h1>

              <p>
                Manage commission percentages, payments and payment
                history.
              </p>
            </div>
          </div>

          <span className="record-count">
            {formatNumber(
              calculatedSummary.total_commissions || 0
            )}{" "}
            Records
          </span>
        </section>

        {error && (
          <div className="commission-alert error-alert">
            <AlertCircle size={17} />

            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Close error"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {success && (
          <div className="commission-alert success-alert">
            <CheckCircle2 size={17} />

            <span>{success}</span>

            <button
              type="button"
              onClick={() => setSuccess("")}
              aria-label="Close success message"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <section className="commission-summary-grid">
          <article className="commission-summary-card">
            <p>Pending</p>

            <strong>
              {formatNumber(calculatedSummary.pending_count)}
            </strong>

            <span>Waiting for payment</span>
          </article>

          <article className="commission-summary-card">
            <p>Partial paid</p>

            <strong>
              {formatNumber(calculatedSummary.partial_count)}
            </strong>

            <span>Some amount paid</span>
          </article>

          <article className="commission-summary-card">
            <p>Paid</p>

            <strong>
              {formatNumber(calculatedSummary.paid_count)}
            </strong>

            <span>Fully settled</span>
          </article>

          <article className="commission-summary-card">
            <p>Total commission</p>

            <strong>
              {formatCurrency(
                calculatedSummary.total_commission_amount
              )}
            </strong>

            <span>Complete commission value</span>
          </article>

          <article className="commission-summary-card">
            <p>Total paid</p>

            <strong>
              {formatCurrency(
                calculatedSummary.total_paid_amount
              )}
            </strong>

            <span>Commission already paid</span>
          </article>

          <article className="commission-summary-card">
            <p>Total due</p>

            <strong>
              {formatCurrency(
                calculatedSummary.total_due_amount
              )}
            </strong>

            <span>Pending commission payout</span>
          </article>
        </section>

        <section className="commission-filter-card">
          <div className="search-box">
            <Search size={17} />

            <input
              type="text"
              placeholder="Search client, lead, company or sales user..."
              value={searchText}
              onChange={(event) =>
                setSearchText(event.target.value)
              }
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial Paid</option>
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
            <div className="commission-empty">
              <Clock3 size={25} />

              <strong>Loading commission records...</strong>
            </div>
          ) : filteredCommissions.length === 0 ? (
            <div className="commission-empty">
              <Percent size={25} />

              <strong>No commission records found</strong>

              <span>
                Convert a software sale to automatically create
                commission.
              </span>
            </div>
          ) : (
            <div className="commission-grid">
              {filteredCommissions.map((commission) => (
                <article
                  className="commission-card"
                  key={commission.id}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setSelectedCommissionId(commission.id)
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" ||
                      event.key === " "
                    ) {
                      event.preventDefault();
                      setSelectedCommissionId(commission.id);
                    }
                  }}
                >
                  <div className="commission-card-top">
                    <div className="commission-card-id">
                      <div className="commission-icon">
                        <Percent size={16} />
                      </div>

                      <span>#{commission.id}</span>
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

                  <div className="compact-meta-row">
                    <span>Lead #{commission.lead_id}</span>
                    <span>{getSalesRepName(commission)}</span>
                  </div>

                  <div className="compact-value-grid">
                    <div>
                      <span>Sale</span>

                      <strong>
                        {formatCurrency(commission.sale_amount)}
                      </strong>
                    </div>

                    <div>
                      <span>Commission</span>

                      <strong>
                        {formatCurrency(
                          commission.commission_amount
                        )}
                      </strong>
                    </div>

                    <div className="compact-paid-value">
                      <span>Paid</span>

                      <strong>
                        {formatCurrency(commission.paid_amount)}
                      </strong>
                    </div>

                    <div className="compact-due-value">
                      <span>Due</span>

                      <strong>
                        {formatCurrency(commission.due_amount)}
                      </strong>
                    </div>
                  </div>

                  <div className="commission-card-footer">
                    <span>
                      {Number(
                        commission.commission_percentage || 0
                      )}
                      % commission
                    </span>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedCommissionId(commission.id);
                      }}
                    >
                      <Eye size={15} />
                      View Details
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {selectedCommission &&
        renderCommissionDetails(selectedCommission)}

      {commissionToDelete && (
        <div
          className="confirmation-backdrop"
          onMouseDown={() => {
            if (!deletingCommissionId) {
              setCommissionToDelete(null);
            }
          }}
        >
          <section
            className="confirmation-modal"
            onMouseDown={stopPropagation}
          >
            <div className="confirmation-danger-icon">
              <Trash2 size={24} />
            </div>

            <h3>Delete Commission?</h3>

            <p>
              You are deleting the commission for{" "}
              <strong>
                {getClientName(commissionToDelete)}
              </strong>
              . Its connected commission payment history will also be
              deleted.
            </p>

            <div className="confirmation-warning">
              <AlertCircle size={17} />
              <span>This action cannot be undone.</span>
            </div>

            <div className="confirmation-actions">
              <button
                type="button"
                className="confirmation-cancel-btn"
                onClick={() => setCommissionToDelete(null)}
                disabled={Boolean(deletingCommissionId)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="confirmation-delete-btn"
                onClick={handleDeleteCommission}
                disabled={
                  deletingCommissionId === commissionToDelete.id
                }
              >
                <Trash2 size={16} />

                {deletingCommissionId === commissionToDelete.id
                  ? "Deleting..."
                  : "Delete Commission"}
              </button>
            </div>
          </section>
        </div>
      )}

      {paymentToDelete && (
        <div
          className="confirmation-backdrop"
          onMouseDown={() => {
            if (!deletingPaymentId) {
              setPaymentToDelete(null);
            }
          }}
        >
          <section
            className="confirmation-modal"
            onMouseDown={stopPropagation}
          >
            <div className="confirmation-danger-icon">
              <Trash2 size={24} />
            </div>

            <h3>Delete Commission Payment?</h3>

            <p>
              Delete the payment of{" "}
              <strong>
                {formatCurrency(paymentToDelete.amount)}
              </strong>{" "}
              from{" "}
              <strong>{paymentToDelete.client_name}</strong>?
            </p>

            <div className="confirmation-warning">
              <AlertCircle size={17} />

              <span>
                Paid and due commission values will be recalculated.
              </span>
            </div>

            <div className="confirmation-actions">
              <button
                type="button"
                className="confirmation-cancel-btn"
                onClick={() => setPaymentToDelete(null)}
                disabled={Boolean(deletingPaymentId)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="confirmation-delete-btn"
                onClick={handleDeletePayment}
                disabled={
                  deletingPaymentId === paymentToDelete.id
                }
              >
                <Trash2 size={16} />

                {deletingPaymentId === paymentToDelete.id
                  ? "Deleting..."
                  : "Delete Payment"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

const commissionStyles = `
.commission-page {
  width: 100%;
  min-height: calc(100vh - 58px);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.commission-header-card {
  width: 100%;
  min-height: 82px;
  padding: 16px 18px;
  border-radius: 19px;
  background: #ffffff;
  border: 1px solid var(--erp-border, #e2e8f0);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.commission-header-left {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.commission-back-button {
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
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    transform 0.18s ease;
}

.commission-back-button:hover {
  background: #eff6ff;
  border-color: #bfdbfe;
  transform: translateX(-1px);
}

.commission-back-button:focus-visible {
  outline: 3px solid rgba(37, 99, 235, 0.18);
  outline-offset: 2px;
}

.commission-header-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
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
  font-size: 25px;
  line-height: 1.1;
  letter-spacing: -0.035em;
}

.commission-header-card p {
  margin: 5px 0 0;
  color: #52677e;
  font-size: 12px;
  font-weight: 650;
}

.record-count {
  min-height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  background: #f8fafc;
  border: 1px solid #dbe3ef;
  color: #06142b;
  font-size: 12px;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

.commission-alert {
  min-height: 44px;
  padding: 11px 14px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 13px;
  font-weight: 800;
}

.commission-alert > span {
  flex: 1;
}

.commission-alert button {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: currentColor;
  cursor: pointer;
  display: grid;
  place-items: center;
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
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 11px;
}

.commission-summary-card {
  min-height: 91px;
  padding: 14px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid var(--erp-border, #e2e8f0);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.035);
}

.commission-summary-card p {
  margin: 0 0 8px;
  color: #64748b;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.035em;
  text-transform: uppercase;
}

.commission-summary-card strong {
  display: block;
  color: #06142b;
  font-size: 20px;
  line-height: 1;
  font-weight: 950;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.commission-summary-card span {
  display: block;
  margin-top: 9px;
  color: #64748b;
  font-size: 10px;
  font-weight: 700;
}

.commission-filter-card {
  padding: 11px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid var(--erp-border, #e2e8f0);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.035);
  display: grid;
  grid-template-columns: minmax(0, 1fr) 170px 72px;
  gap: 10px;
}

.search-box {
  height: 40px;
  padding: 0 12px;
  border: 1px solid #dbe3ef;
  border-radius: 12px;
  background: #ffffff;
  display: flex;
  align-items: center;
  gap: 9px;
  color: #64748b;
}

.search-box input,
.commission-filter-card select {
  width: 100%;
  height: 40px;
  border: none;
  outline: none;
  background: transparent;
  color: #06142b;
  font-size: 12px;
  font-weight: 700;
}

.commission-filter-card select {
  padding: 0 11px;
  border: 1px solid #dbe3ef;
  border-radius: 12px;
  background: #ffffff;
}

.clear-btn {
  height: 40px;
  border: 1px solid #dbe3ef;
  border-radius: 12px;
  background: #ffffff;
  color: #06142b;
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
}

.commission-list-section {
  width: 100%;
  min-height: 380px;
  border-radius: 19px;
  background: #ffffff;
  border: 1px solid var(--erp-border, #e2e8f0);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.045);
  overflow: hidden;
}

.commission-list-header {
  min-height: 66px;
  padding: 15px 17px;
  border-bottom: 1px solid #eef2f7;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.commission-list-header h2 {
  margin: 0;
  color: #06142b;
  font-size: 19px;
  letter-spacing: -0.025em;
}

.commission-list-header p {
  margin: 5px 0 0;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
}

.commission-empty {
  min-height: 280px;
  padding: 24px;
  color: #64748b;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9px;
  text-align: center;
}

.commission-empty strong {
  color: #334155;
  font-size: 14px;
}

.commission-empty span {
  font-size: 12px;
}

.commission-grid {
  padding: 13px;
  display: grid;
  grid-template-columns: repeat(4, minmax(245px, 1fr));
  gap: 12px;
  align-items: stretch;
}

.commission-card {
  min-width: 0;
  padding: 13px;
  border-radius: 16px;
  border: 1px solid #dbe3ef;
  background: #ffffff;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.035);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.commission-card:hover {
  transform: translateY(-2px);
  border-color: #bfdbfe;
  box-shadow: 0 13px 27px rgba(37, 99, 235, 0.09);
}

.commission-card:focus-visible {
  outline: 3px solid rgba(37, 99, 235, 0.2);
  outline-offset: 2px;
}

.commission-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 9px;
}

.commission-card-id {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #64748b;
  font-size: 10px;
  font-weight: 850;
}

.commission-icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: #eef6ff;
  border: 1px solid #dbeafe;
  color: #2563eb;
}

.commission-status {
  padding: 5px 8px;
  border-radius: 999px;
  font-size: 9px;
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
  margin-top: 11px;
  min-width: 0;
}

.commission-main-info h3 {
  margin: 0;
  color: #06142b;
  font-size: 15px;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.commission-main-info p {
  min-height: 16px;
  margin: 5px 0 0;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.compact-meta-row {
  margin-top: 9px;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.compact-meta-row span {
  min-width: 0;
  padding: 4px 7px;
  border-radius: 999px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #64748b;
  font-size: 9px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.compact-meta-row span:last-child {
  flex: 1;
}

.compact-value-grid {
  margin-top: 11px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.compact-value-grid > div {
  min-width: 0;
  padding: 8px 9px;
  border-radius: 11px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.compact-value-grid span {
  display: block;
  color: #64748b;
  font-size: 9px;
  font-weight: 850;
  text-transform: uppercase;
}

.compact-value-grid strong {
  display: block;
  margin-top: 4px;
  color: #06142b;
  font-size: 12px;
  font-weight: 950;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.compact-paid-value {
  background: #f0fdf4 !important;
  border-color: #bbf7d0 !important;
}

.compact-paid-value strong {
  color: #047857;
}

.compact-due-value {
  background: #fff7ed !important;
  border-color: #fed7aa !important;
}

.compact-due-value strong {
  color: #c2410c;
}

.commission-card-footer {
  margin-top: auto;
  padding-top: 11px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.commission-card-footer > span {
  color: #64748b;
  font-size: 10px;
  font-weight: 750;
}

.commission-card-footer button {
  min-height: 31px;
  padding: 0 10px;
  border: none;
  border-radius: 9px;
  background: #eef6ff;
  color: #2563eb;
  font-size: 10px;
  font-weight: 900;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.commission-modal-backdrop,
.confirmation-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  padding: 22px;
  background: rgba(15, 23, 42, 0.58);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.commission-detail-modal {
  width: min(1050px, 100%);
  max-height: calc(100vh - 44px);
  border-radius: 22px;
  background: #f8fafc;
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: 0 32px 75px rgba(15, 23, 42, 0.27);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.commission-modal-header {
  min-height: 78px;
  padding: 16px 18px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.commission-modal-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.commission-modal-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: #2563eb;
  background: #eef6ff;
  border: 1px solid #dbeafe;
  flex-shrink: 0;
}

.modal-heading-line {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.modal-heading-line h2 {
  margin: 0;
  color: #06142b;
  font-size: 21px;
  letter-spacing: -0.025em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.commission-modal-heading p {
  margin: 5px 0 0;
  color: #64748b;
  font-size: 11px;
  font-weight: 750;
}

.modal-close-btn {
  width: 37px;
  height: 37px;
  border: 1px solid #dbe3ef;
  border-radius: 11px;
  background: #ffffff;
  color: #475569;
  cursor: pointer;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.commission-modal-body {
  padding: 15px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.detail-section {
  padding: 15px;
  border-radius: 17px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
}

.detail-section-header {
  margin-bottom: 13px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.detail-section-header h3 {
  margin: 0;
  color: #06142b;
  font-size: 16px;
}

.detail-section-header p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 11px;
  font-weight: 650;
}

.client-detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
}

.client-detail-item {
  min-width: 0;
  min-height: 68px;
  padding: 11px;
  border-radius: 13px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #2563eb;
  display: flex;
  align-items: flex-start;
  gap: 9px;
}

.client-detail-item > div {
  min-width: 0;
}

.client-detail-item span {
  display: block;
  color: #64748b;
  font-size: 9px;
  font-weight: 850;
  text-transform: uppercase;
}

.client-detail-item strong {
  display: block;
  margin-top: 5px;
  color: #06142b;
  font-size: 11px;
  font-weight: 850;
  word-break: break-word;
}

.modal-value-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 9px;
}

.modal-value-grid article {
  min-width: 0;
  min-height: 77px;
  padding: 12px;
  border-radius: 13px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.modal-value-grid span {
  color: #64748b;
  font-size: 9px;
  font-weight: 850;
  text-transform: uppercase;
}

.modal-value-grid strong {
  display: block;
  margin-top: 7px;
  color: #06142b;
  font-size: 15px;
  font-weight: 950;
  word-break: break-word;
}

.paid-value-card {
  background: #f0fdf4 !important;
  border-color: #bbf7d0 !important;
}

.paid-value-card strong {
  color: #047857;
}

.due-value-card {
  background: #fff7ed !important;
  border-color: #fed7aa !important;
}

.due-value-card strong {
  color: #c2410c;
}

.modal-percentage-row {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr) auto;
  gap: 10px;
  align-items: end;
}

.modal-input-group {
  min-width: 0;
}

.modal-input-group label {
  display: block;
  margin-bottom: 6px;
  color: #334155;
  font-size: 10px;
  font-weight: 850;
}

.modal-input-group input,
.modal-input-group select {
  width: 100%;
  height: 40px;
  padding: 0 11px;
  border: 1px solid #dbe3ef;
  border-radius: 11px;
  background: #ffffff;
  color: #06142b;
  outline: none;
  font-size: 12px;
  font-weight: 750;
}

.input-with-symbol {
  height: 40px;
  padding: 0 10px;
  border: 1px solid #dbe3ef;
  border-radius: 11px;
  background: #ffffff;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 7px;
}

.input-with-symbol:focus-within {
  border-color: #93c5fd;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.09);
}

.input-with-symbol input {
  height: 38px;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.commission-preview-box {
  min-height: 40px;
  padding: 7px 11px;
  border-radius: 11px;
  background: #eef6ff;
  border: 1px solid #bfdbfe;
}

.commission-preview-box span {
  display: block;
  color: #64748b;
  font-size: 9px;
  font-weight: 800;
}

.commission-preview-box strong {
  display: block;
  margin-top: 2px;
  color: #1d4ed8;
  font-size: 13px;
  font-weight: 950;
}

.primary-modal-btn,
.payment-submit-btn {
  min-height: 40px;
  padding: 0 15px;
  border: none;
  border-radius: 11px;
  background: #2563eb;
  color: #ffffff;
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  white-space: nowrap;
}

.primary-modal-btn:disabled,
.payment-submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-payment-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.modal-remarks-field {
  grid-column: span 3;
}

.payment-action-row {
  margin-top: 11px;
  display: flex;
  justify-content: flex-end;
}

.payment-submit-btn {
  background: #059669;
}

.section-due-label,
.payment-count-badge {
  min-height: 29px;
  padding: 0 10px;
  border-radius: 999px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #c2410c;
  font-size: 10px;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.payment-count-badge {
  background: #f8fafc;
  border-color: #e2e8f0;
  color: #475569;
}

.commission-paid-message {
  padding: 13px;
  border-radius: 13px;
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
  color: #059669;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.commission-paid-message strong {
  display: block;
  color: #047857;
  font-size: 12px;
}

.commission-paid-message span {
  display: block;
  margin-top: 3px;
  color: #047857;
  font-size: 10px;
}

.modal-empty-state {
  min-height: 130px;
  border-radius: 13px;
  border: 1px dashed #cbd5e1;
  color: #64748b;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.modal-empty-state strong {
  color: #334155;
  font-size: 12px;
}

.modal-empty-state span {
  font-size: 10px;
}

.modal-payment-history {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.modal-payment-history-item {
  padding: 10px 11px;
  border-radius: 13px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.payment-history-main {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 9px;
}

.payment-history-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
  color: #059669;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.payment-history-main strong {
  display: block;
  color: #06142b;
  font-size: 13px;
  font-weight: 950;
}

.payment-history-main span {
  display: block;
  margin-top: 3px;
  color: #64748b;
  font-size: 10px;
  font-weight: 750;
}

.payment-history-main p {
  margin: 4px 0 0;
  color: #475569;
  font-size: 10px;
}

.payment-delete-btn {
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid #fecaca;
  border-radius: 9px;
  background: #fef2f2;
  color: #dc2626;
  font-size: 10px;
  font-weight: 900;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.payment-delete-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.commission-danger-section {
  padding: 14px;
  border-radius: 16px;
  background: #fff7f7;
  border: 1px solid #fecaca;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.commission-danger-section h3 {
  margin: 0;
  color: #991b1b;
  font-size: 14px;
}

.commission-danger-section p {
  margin: 4px 0 0;
  color: #b91c1c;
  font-size: 10px;
  font-weight: 650;
}

.danger-delete-btn {
  min-height: 37px;
  padding: 0 13px;
  border: none;
  border-radius: 10px;
  background: #dc2626;
  color: #ffffff;
  font-size: 10px;
  font-weight: 900;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.confirmation-modal {
  width: min(430px, 100%);
  padding: 22px;
  border-radius: 21px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 30px 70px rgba(15, 23, 42, 0.28);
  text-align: center;
}

.confirmation-danger-icon {
  width: 52px;
  height: 52px;
  margin: 0 auto;
  border-radius: 16px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  display: grid;
  place-items: center;
}

.confirmation-modal h3 {
  margin: 15px 0 0;
  color: #06142b;
  font-size: 19px;
}

.confirmation-modal > p {
  margin: 9px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.65;
}

.confirmation-modal > p strong {
  color: #06142b;
}

.confirmation-warning {
  margin-top: 14px;
  padding: 10px 11px;
  border-radius: 11px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #c2410c;
  font-size: 10px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
}

.confirmation-actions {
  margin-top: 18px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

.confirmation-cancel-btn,
.confirmation-delete-btn {
  min-height: 40px;
  border-radius: 11px;
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.confirmation-cancel-btn {
  border: 1px solid #dbe3ef;
  background: #ffffff;
  color: #334155;
}

.confirmation-delete-btn {
  border: none;
  background: #dc2626;
  color: #ffffff;
}

.confirmation-cancel-btn:disabled,
.confirmation-delete-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 1550px) {
  .commission-summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .commission-grid {
    grid-template-columns: repeat(3, minmax(245px, 1fr));
  }
}

@media (max-width: 1200px) {
  .commission-grid {
    grid-template-columns: repeat(2, minmax(245px, 1fr));
  }

  .client-detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .modal-value-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 850px) {
  .commission-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .commission-filter-card {
    grid-template-columns: 1fr;
  }

  .commission-modal-backdrop,
  .confirmation-backdrop {
    padding: 10px;
  }

  .commission-detail-modal {
    max-height: calc(100vh - 20px);
    border-radius: 18px;
  }

  .modal-percentage-row,
  .modal-payment-grid {
    grid-template-columns: 1fr;
  }

  .modal-remarks-field {
    grid-column: span 1;
  }

  .primary-modal-btn,
  .payment-submit-btn {
    width: 100%;
  }

  .modal-value-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 620px) {
  .commission-header-card {
    align-items: stretch;
    flex-direction: column;
  }

  .commission-header-left {
    align-items: flex-start;
  }

  .commission-header-card h1 {
    font-size: 21px;
  }

  .record-count {
    width: 100%;
  }

  .commission-summary-grid,
  .commission-grid,
  .client-detail-grid,
  .modal-value-grid {
    grid-template-columns: 1fr;
  }

  .commission-card-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .commission-card-footer button {
    width: 100%;
    justify-content: center;
  }

  .commission-modal-header {
    align-items: flex-start;
  }

  .modal-heading-line {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }

  .commission-danger-section {
    align-items: stretch;
    flex-direction: column;
  }

  .danger-delete-btn {
    width: 100%;
    justify-content: center;
  }

  .detail-section-header {
    flex-direction: column;
  }

  .modal-payment-history-item {
    align-items: stretch;
    flex-direction: column;
  }

  .payment-delete-btn {
    width: 100%;
    justify-content: center;
  }

  .confirmation-actions {
    grid-template-columns: 1fr;
  }
}
`;