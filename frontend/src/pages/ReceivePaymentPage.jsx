import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CreditCard,
  IndianRupee,
  PlusCircle,
  ReceiptText,
  Search,
  Trash2,
  WalletCards,
  X,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import api from "../api/api";
import { useAuth } from "../context/AuthContext";

const ADMIN_ROLES = [
  "super-admin",
  "company-admin",
  "admin",
  "owner",
];

const PAYMENT_ALLOWED_LEAD_STATUSES = [
  "converted",
  "delivered",
  "completed",
];

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
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

function parsePortalAccess(value) {
  if (Array.isArray(value)) {
    return value
      .map(normalizePortal)
      .filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed
          .map(normalizePortal)
          .filter(Boolean);
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

  const portalAccess = parsePortalAccess(
    user?.portal_access
  );

  const normalizedPortal = normalizePortal(portalKey);

  return (
    portalAccess.includes(normalizedPortal) ||
    portalAccess.includes("sales")
  );
}

function formatCurrency(value) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
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

function getErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map(
        (item) =>
          item?.msg ||
          item?.message ||
          "Validation error"
      )
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

function stopPropagation(event) {
  event.stopPropagation();
}

export default function ReceivePaymentPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [leads, setLeads] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentSummary, setPaymentSummary] =
    useState(null);

  const [form, setForm] = useState(
    getEmptyPaymentForm()
  );

  const [searchText, setSearchText] = useState("");
  const [
    paymentTypeFilter,
    setPaymentTypeFilter,
  ] = useState("");
  const [methodFilter, setMethodFilter] =
    useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [
    deletingPaymentId,
    setDeletingPaymentId,
  ] = useState(null);

  const [deleteModal, setDeleteModal] = useState({
    open: false,
    payment: null,
  });

  const [notification, setNotification] =
    useState({
      type: "",
      message: "",
    });

  const role = normalizeRole(user?.role);
  const isAdminUser =
    ADMIN_ROLES.includes(role);

  const canUsePaymentPage = hasPortalAccess(
    user,
    "receive-payment"
  );

  const showNotification = (type, message) => {
    setNotification({
      type,
      message,
    });
  };

  useEffect(() => {
    if (!notification.message) return undefined;

    const timer = window.setTimeout(() => {
      setNotification({
        type: "",
        message: "",
      });
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [notification.message]);

  useEffect(() => {
    if (!deleteModal.open) return undefined;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleEscape = (event) => {
      if (
        event.key === "Escape" &&
        !deletingPaymentId
      ) {
        setDeleteModal({
          open: false,
          payment: null,
        });
      }
    };

    window.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [deleteModal.open, deletingPaymentId]);

  const convertedLeads = useMemo(() => {
    return leads.filter((lead) =>
      PAYMENT_ALLOWED_LEAD_STATUSES.includes(
        normalizeStatus(lead.status)
      )
    );
  }, [leads]);

  const paymentsByLead = useMemo(() => {
    const map = new Map();

    payments.forEach((payment) => {
      if (
        !payment.lead_id ||
        payment.payment_type !== "lead_payment"
      ) {
        return;
      }

      const existing =
        map.get(Number(payment.lead_id)) || [];

      existing.push(payment);

      map.set(
        Number(payment.lead_id),
        existing
      );
    });

    return map;
  }, [payments]);

  const selectedLead = useMemo(() => {
    if (!form.lead_id) return null;

    return (
      leads.find(
        (lead) =>
          Number(lead.id) ===
          Number(form.lead_id)
      ) || null
    );
  }, [form.lead_id, leads]);

  const selectedLeadPaymentInfo =
    useMemo(() => {
      if (!selectedLead) {
        return {
          finalAmount: 0,
          totalReceived: 0,
          dueAmount: 0,
        };
      }

      const leadPayments =
        paymentsByLead.get(
          Number(selectedLead.id)
        ) || [];

      const totalReceived = leadPayments.reduce(
        (total, payment) =>
          total +
          Number(payment.amount || 0),
        0
      );

      const finalAmount = Number(
        selectedLead.final_sale_amount || 0
      );

      const dueAmount = Math.max(
        finalAmount - totalReceived,
        0
      );

      return {
        finalAmount,
        totalReceived,
        dueAmount,
      };
    }, [selectedLead, paymentsByLead]);

  const localPaymentSummary = useMemo(() => {
    const totalReceived = payments.reduce(
      (total, payment) =>
        total + Number(payment.amount || 0),
      0
    );

    const totalLeadPayments = payments
      .filter(
        (payment) =>
          payment.payment_type ===
          "lead_payment"
      )
      .reduce(
        (total, payment) =>
          total +
          Number(payment.amount || 0),
        0
      );

    const totalOtherPayments = payments
      .filter(
        (payment) =>
          payment.payment_type ===
          "other_payment"
      )
      .reduce(
        (total, payment) =>
          total +
          Number(payment.amount || 0),
        0
      );

    let totalPendingDue = 0;

    convertedLeads.forEach((lead) => {
      const leadPayments =
        paymentsByLead.get(
          Number(lead.id)
        ) || [];

      const received = leadPayments.reduce(
        (total, payment) =>
          total +
          Number(payment.amount || 0),
        0
      );

      const finalAmount = Number(
        lead.final_sale_amount || 0
      );

      if (finalAmount > received) {
        totalPendingDue +=
          finalAmount - received;
      }
    });

    return {
      total_received: totalReceived,
      total_lead_payments:
        totalLeadPayments,
      total_other_payments:
        totalOtherPayments,
      total_pending_due_from_leads:
        totalPendingDue,
      total_payment_count: payments.length,

      lead_payment_count: payments.filter(
        (payment) =>
          payment.payment_type ===
          "lead_payment"
      ).length,

      other_payment_count: payments.filter(
        (payment) =>
          payment.payment_type ===
          "other_payment"
      ).length,
    };
  }, [
    payments,
    convertedLeads,
    paymentsByLead,
  ]);

  const displayPaymentSummary = useMemo(() => {
    return {
      ...localPaymentSummary,
      ...(paymentSummary || {}),
    };
  }, [localPaymentSummary, paymentSummary]);

  const filteredPayments = useMemo(() => {
    const search =
      searchText.trim().toLowerCase();

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
        payment.lead_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchMatch = search
        ? searchTarget.includes(search)
        : true;

      const typeMatch = paymentTypeFilter
        ? payment.payment_type ===
          paymentTypeFilter
        : true;

      const methodMatch = methodFilter
        ? payment.payment_method ===
          methodFilter
        : true;

      return (
        searchMatch &&
        typeMatch &&
        methodMatch
      );
    });
  }, [
    payments,
    searchText,
    paymentTypeFilter,
    methodFilter,
  ]);

  const fetchLeads = async () => {
    try {
      const response = await api.get(
        "/sales/leads"
      );

      setLeads(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (error) {
      showNotification(
        "error",
        getErrorMessage(
          error,
          "Failed to load leads"
        )
      );
    }
  };

  const fetchPayments = async () => {
    try {
      const response = await api.get(
        "/sales/payments"
      );

      setPayments(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (error) {
      showNotification(
        "error",
        getErrorMessage(
          error,
          "Failed to load received payments"
        )
      );
    }
  };

  const fetchPaymentSummary = async () => {
    try {
      const response = await api.get(
        "/sales/payments/summary"
      );

      setPaymentSummary(
        response.data || null
      );
    } catch (error) {
      console.error(
        "Payment summary loading error:",
        error
      );
    }
  };

  const fetchAll = async () => {
    if (!canUsePaymentPage) return;

    try {
      setLoading(true);

      await Promise.all([
        fetchLeads(),
        fetchPayments(),
        fetchPaymentSummary(),
      ]);
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
      if (
        value === "other_payment" &&
        !isAdminUser
      ) {
        showNotification(
          "error",
          "Only admin can add other payment"
        );

        return;
      }

      setForm({
        ...getEmptyPaymentForm(),
        payment_type: value,
      });

      return;
    }

    if (name === "lead_id") {
      const lead = leads.find(
        (item) =>
          Number(item.id) === Number(value)
      );

      setForm((previous) => ({
        ...previous,
        lead_id: value,

        payment_title: lead
          ? `Payment from ${lead.client_name}`
          : "",

        payer_name:
          lead?.client_name || "",

        payer_phone:
          lead?.client_phone ||
          lead?.phone ||
          "",

        payer_email:
          lead?.client_email ||
          lead?.email ||
          "",
      }));

      return;
    }

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setForm(getEmptyPaymentForm());
  };

  const handleSubmitPayment = async (
    event
  ) => {
    event.preventDefault();

    const amount = Number(form.amount);

    if (
      form.payment_type ===
        "lead_payment" &&
      !form.lead_id
    ) {
      showNotification(
        "error",
        "Please choose a converted lead"
      );

      return;
    }

    if (
      form.payment_type ===
        "other_payment" &&
      !isAdminUser
    ) {
      showNotification(
        "error",
        "Only admin can add other payment"
      );

      return;
    }

    if (
      !amount ||
      Number.isNaN(amount) ||
      amount <= 0
    ) {
      showNotification(
        "error",
        "Payment amount must be greater than 0"
      );

      return;
    }

    try {
      setSaving(true);

      const payload = {
        lead_id:
          form.payment_type ===
            "lead_payment" &&
          form.lead_id
            ? Number(form.lead_id)
            : null,

        payment_type: form.payment_type,

        payment_title:
          form.payment_title.trim() ||
          (form.payment_type ===
          "lead_payment"
            ? `Payment from ${
                selectedLead?.client_name ||
                "Client"
              }`
            : "Other payment"),

        payer_name:
          form.payer_name.trim() ||
          (form.payment_type ===
          "lead_payment"
            ? selectedLead?.client_name ||
              "Client"
            : "Other payer"),

        payer_phone:
          form.payer_phone.trim() || null,

        payer_email:
          form.payer_email.trim() || null,

        amount,

        payment_method:
          form.payment_method || "upi",

        payment_date:
          form.payment_date ||
          getTodayDate(),

        reference_number:
          form.reference_number.trim() ||
          null,

        remarks:
          form.remarks.trim() || null,
      };

      await api.post(
        "/sales/payments",
        payload
      );

      resetForm();

      await fetchAll();

      showNotification(
        "success",
        "Received payment saved successfully"
      );
    } catch (error) {
      showNotification(
        "error",
        getErrorMessage(
          error,
          "Failed to save received payment"
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = (payment) => {
    if (!isAdminUser) {
      showNotification(
        "error",
        "Only admin can delete received payment"
      );

      return;
    }

    setDeleteModal({
      open: true,
      payment,
    });
  };

  const closeDeleteModal = () => {
    if (deletingPaymentId) return;

    setDeleteModal({
      open: false,
      payment: null,
    });
  };

  const handleDeletePayment = async () => {
    const payment = deleteModal.payment;

    if (!payment) return;

    try {
      setDeletingPaymentId(payment.id);

      await api.delete(
        `/sales/payments/${payment.id}`
      );

      setDeleteModal({
        open: false,
        payment: null,
      });

      await fetchAll();

      showNotification(
        "success",
        "Payment deleted successfully. You can now delete the wrong sales lead."
      );
    } catch (error) {
      showNotification(
        "error",
        getErrorMessage(
          error,
          "Failed to delete received payment"
        )
      );
    } finally {
      setDeletingPaymentId(null);
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
          <section className="payment-page-header">
            <div className="payment-title-wrap">
              <button
                type="button"
                className="payment-back-button"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft size={18} />
              </button>

              <div className="payment-title-icon">
                <WalletCards size={21} />
              </div>

              <div>
                <h1>
                  Payment Access Required
                </h1>

                <p>
                  You do not have access to the
                  Receive Payment module.
                </p>
              </div>
            </div>
          </section>

          <div className="payment-empty-state access-empty-state">
            <WalletCards size={34} />

            <h3>No Payment Access</h3>

            <p>
              Contact Company Admin to enable
              Receive Payment access.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{receivePaymentStyles}</style>

      <div className="receive-payment-page">
        <section className="payment-page-header">
          <div className="payment-title-wrap">
            <button
              type="button"
              className="payment-back-button"
              onClick={() => navigate(-1)}
              aria-label="Go back"
            >
              <ArrowLeft size={18} />
            </button>

            <div className="payment-title-icon">
              <WalletCards size={21} />
            </div>

            <div>
              <h1>Receive Payment</h1>

              <p>
                Record payments from sales leads
                or other company income.
              </p>
            </div>
          </div>

          <span className="payment-count-pill">
            {loading
              ? "Loading..."
              : `${filteredPayments.length} Payments`}
          </span>
        </section>

        {notification.message && (
          <div
            className={`payment-notification ${
              notification.type === "success"
                ? "success"
                : "error"
            }`}
          >
            {notification.type ===
            "success" ? (
              <CheckCircle2 size={18} />
            ) : (
              <XCircle size={18} />
            )}

            <span>
              {notification.message}
            </span>

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

        <section className="payment-summary-grid">
          <article className="payment-summary-card">
            <div className="summary-icon green">
              <IndianRupee size={20} />
            </div>

            <div>
              <span>Total Received</span>

              <strong>
                {formatCurrency(
                  displayPaymentSummary.total_received ||
                    0
                )}
              </strong>

              <p>
                {displayPaymentSummary.total_payment_count ||
                  0}{" "}
                payment records
              </p>
            </div>
          </article>

          <article className="payment-summary-card">
            <div className="summary-icon blue">
              <ReceiptText size={20} />
            </div>

            <div>
              <span>Lead Payments</span>

              <strong>
                {formatCurrency(
                  displayPaymentSummary.total_lead_payments ||
                    0
                )}
              </strong>

              <p>
                {displayPaymentSummary.lead_payment_count ||
                  0}{" "}
                lead payments
              </p>
            </div>
          </article>

          <article className="payment-summary-card">
            <div className="summary-icon purple">
              <Banknote size={20} />
            </div>

            <div>
              <span>Other Payments</span>

              <strong>
                {formatCurrency(
                  displayPaymentSummary.total_other_payments ||
                    0
                )}
              </strong>

              <p>
                {displayPaymentSummary.other_payment_count ||
                  0}{" "}
                other payments
              </p>
            </div>
          </article>

          <article className="payment-summary-card">
            <div className="summary-icon orange">
              <CreditCard size={20} />
            </div>

            <div>
              <span>Pending Due</span>

              <strong>
                {formatCurrency(
                  displayPaymentSummary.total_pending_due_from_leads ||
                    0
                )}
              </strong>

              <p>From converted leads</p>
            </div>
          </article>
        </section>

        <section className="payment-entry-section">
          <div className="payment-section-header">
            <div className="payment-section-title">
              <div className="payment-section-icon">
                <PlusCircle size={19} />
              </div>

              <div>
                <h2>Add Received Payment</h2>

                <p>
                  Choose a lead payment or other
                  payment.
                </p>
              </div>
            </div>
          </div>

          <form
            className="payment-entry-form"
            onSubmit={handleSubmitPayment}
          >
            <div className="payment-type-switch">
              {PAYMENT_TYPE_OPTIONS.map(
                (option) => {
                  const disabled =
                    option.value ===
                      "other_payment" &&
                    !isAdminUser;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={disabled}
                      className={
                        form.payment_type ===
                        option.value
                          ? "active"
                          : ""
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

                      {disabled
                        ? " Admin Only"
                        : ""}
                    </button>
                  );
                }
              )}
            </div>

            <div className="payment-form-grid">
              {form.payment_type ===
                "lead_payment" && (
                <>
                  <div className="payment-form-group lead-select-field">
                    <label>
                      Choose Converted Lead *
                    </label>

                    <select
                      name="lead_id"
                      value={form.lead_id}
                      onChange={handleFormChange}
                      required
                    >
                      <option value="">
                        Select converted /
                        delivered / completed lead
                      </option>

                      {convertedLeads.map(
                        (lead) => {
                          const leadPayments =
                            paymentsByLead.get(
                              Number(lead.id)
                            ) || [];

                          const received =
                            leadPayments.reduce(
                              (
                                total,
                                payment
                              ) =>
                                total +
                                Number(
                                  payment.amount ||
                                    0
                                ),
                              0
                            );

                          const finalAmount =
                            Number(
                              lead.final_sale_amount ||
                                0
                            );

                          const dueAmount =
                            Math.max(
                              finalAmount -
                                received,
                              0
                            );

                          return (
                            <option
                              key={lead.id}
                              value={lead.id}
                            >
                              {lead.client_name} |{" "}
                              {formatLabel(
                                lead.status
                              )}{" "}
                              | Final{" "}
                              {formatCurrency(
                                finalAmount
                              )}{" "}
                              | Due{" "}
                              {formatCurrency(
                                dueAmount
                              )}
                            </option>
                          );
                        }
                      )}
                    </select>

                    {convertedLeads.length ===
                      0 && (
                      <small>
                        No converted lead found.
                        Convert a lead from Sales
                        first.
                      </small>
                    )}
                  </div>

                  <div className="payment-form-group received-amount-field">
                    <label>
                      Received Amount *
                    </label>

                    <input
                      name="amount"
                      type="number"
                      min="1"
                      value={form.amount}
                      onChange={
                        handleFormChange
                      }
                      placeholder="Example: 25000"
                      required
                    />
                  </div>
                </>
              )}

              {selectedLead &&
                form.payment_type ===
                  "lead_payment" && (
                  <div className="lead-summary-grid full-span">
                    <article>
                      <span>Client</span>

                      <strong>
                        {
                          selectedLead.client_name
                        }
                      </strong>
                    </article>

                    <article>
                      <span>Final Amount</span>

                      <strong>
                        {formatCurrency(
                          selectedLeadPaymentInfo.finalAmount
                        )}
                      </strong>
                    </article>

                    <article>
                      <span>Received</span>

                      <strong>
                        {formatCurrency(
                          selectedLeadPaymentInfo.totalReceived
                        )}
                      </strong>
                    </article>

                    <article>
                      <span>Due</span>

                      <strong>
                        {formatCurrency(
                          selectedLeadPaymentInfo.dueAmount
                        )}
                      </strong>
                    </article>
                  </div>
                )}

              {form.payment_type ===
                "other_payment" && (
                <>
                  <div className="payment-form-group">
                    <label>
                      Payment Title
                    </label>

                    <input
                      name="payment_title"
                      value={
                        form.payment_title
                      }
                      onChange={
                        handleFormChange
                      }
                      placeholder="Example: Maintenance advance"
                    />
                  </div>

                  <div className="payment-form-group">
                    <label>Payer Name</label>

                    <input
                      name="payer_name"
                      value={form.payer_name}
                      onChange={
                        handleFormChange
                      }
                      placeholder="Client or payer name"
                    />
                  </div>

                  <div className="payment-form-group">
                    <label>Payer Phone</label>

                    <input
                      name="payer_phone"
                      value={form.payer_phone}
                      onChange={
                        handleFormChange
                      }
                      placeholder="Phone number"
                    />
                  </div>

                  <div className="payment-form-group">
                    <label>Payer Email</label>

                    <input
                      name="payer_email"
                      type="email"
                      value={form.payer_email}
                      onChange={
                        handleFormChange
                      }
                      placeholder="Email address"
                    />
                  </div>

                  <div className="payment-form-group">
                    <label>
                      Received Amount *
                    </label>

                    <input
                      name="amount"
                      type="number"
                      min="1"
                      value={form.amount}
                      onChange={
                        handleFormChange
                      }
                      placeholder="Example: 25000"
                      required
                    />
                  </div>
                </>
              )}

              <div className="payment-form-group">
                <label>Payment Method</label>

                <select
                  name="payment_method"
                  value={
                    form.payment_method
                  }
                  onChange={handleFormChange}
                >
                  {PAYMENT_METHOD_OPTIONS.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="payment-form-group">
                <label>Payment Date</label>

                <input
                  name="payment_date"
                  type="date"
                  value={form.payment_date}
                  onChange={handleFormChange}
                />
              </div>

              <div className="payment-form-group">
                <label>
                  Reference Number
                </label>

                <input
                  name="reference_number"
                  value={
                    form.reference_number
                  }
                  onChange={handleFormChange}
                  placeholder="UPI reference or transaction ID"
                />
              </div>

              <div className="payment-form-group full-span">
                <label>Remarks</label>

                <textarea
                  name="remarks"
                  value={form.remarks}
                  onChange={handleFormChange}
                  placeholder="Optional payment remarks"
                />
              </div>
            </div>

            <div className="payment-form-actions">
              <button
                type="button"
                className="payment-secondary-button"
                onClick={resetForm}
                disabled={saving}
              >
                Clear
              </button>

              <button
                type="submit"
                className="payment-primary-button"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : "Save Received Payment"}
              </button>
            </div>
          </form>
        </section>

        <section className="payment-history-section">
          <div className="payment-history-header">
            <div>
              <h2>Payment History</h2>

              <p>
                All received payment records
                available to your account.
              </p>
            </div>

            <span>
              {filteredPayments.length} Records
            </span>
          </div>

          <div className="payment-filter-row">
            <div className="payment-search-box">
              <Search size={17} />

              <input
                value={searchText}
                onChange={(event) =>
                  setSearchText(
                    event.target.value
                  )
                }
                placeholder="Search payer, lead, reference or amount..."
              />
            </div>

            <select
              value={paymentTypeFilter}
              onChange={(event) =>
                setPaymentTypeFilter(
                  event.target.value
                )
              }
            >
              <option value="">
                All Types
              </option>

              <option value="lead_payment">
                Lead Payment
              </option>

              <option value="other_payment">
                Other Payment
              </option>
            </select>

            <select
              value={methodFilter}
              onChange={(event) =>
                setMethodFilter(
                  event.target.value
                )
              }
            >
              <option value="">
                All Methods
              </option>

              {PAYMENT_METHOD_OPTIONS.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>

            <button
              type="button"
              onClick={clearFilters}
            >
              Clear
            </button>
          </div>

          {filteredPayments.length === 0 ? (
            <div className="payment-empty-state">
              <ReceiptText size={32} />

              <h3>No payment found</h3>

              <p>
                Add a received payment or change
                the filters.
              </p>
            </div>
          ) : (
            <div className="payment-card-grid">
              {filteredPayments.map(
                (payment) => (
                  <article
                    className="payment-record-card"
                    key={payment.id}
                  >
                    <div className="payment-record-top">
                      <div className="payment-record-icon">
                        <IndianRupee
                          size={17}
                        />
                      </div>

                      <span
                        className={`payment-type-badge ${payment.payment_type}`}
                      >
                        {formatLabel(
                          payment.payment_type
                        )}
                      </span>
                    </div>

                    <div className="payment-record-main">
                      <h3>
                        {payment.payment_title ||
                          payment.payer_name ||
                          formatLabel(
                            payment.payment_type
                          )}
                      </h3>

                      <p>
                        {payment.payer_name ||
                          "-"}
                      </p>
                    </div>

                    <div className="payment-value-box">
                      <span>
                        Received Amount
                      </span>

                      <strong>
                        {formatCurrency(
                          payment.amount
                        )}
                      </strong>
                    </div>

                    <div className="payment-record-details">
                      <div>
                        <span>Method</span>

                        <strong>
                          {formatLabel(
                            payment.payment_method
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Date</span>

                        <strong>
                          {formatDate(
                            payment.payment_date
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Lead</span>

                        <strong>
                          {payment.lead_id
                            ? `#${payment.lead_id}`
                            : "-"}
                        </strong>
                      </div>

                      <div>
                        <span>Reference</span>

                        <strong>
                          {payment.reference_number ||
                            "-"}
                        </strong>
                      </div>
                    </div>

                    {payment.remarks && (
                      <p className="payment-remarks">
                        {payment.remarks}
                      </p>
                    )}

                    {isAdminUser && (
                      <button
                        type="button"
                        className="payment-delete-button"
                        onClick={() =>
                          openDeleteModal(
                            payment
                          )
                        }
                        disabled={
                          deletingPaymentId ===
                          payment.id
                        }
                      >
                        <Trash2 size={15} />

                        Delete Payment
                      </button>
                    )}
                  </article>
                )
              )}
            </div>
          )}
        </section>
      </div>

      {deleteModal.open &&
        deleteModal.payment && (
          <div
            className="payment-modal-backdrop"
            onMouseDown={closeDeleteModal}
          >
            <section
              className="payment-delete-modal"
              onMouseDown={
                stopPropagation
              }
            >
              <button
                type="button"
                className="payment-modal-close"
                onClick={closeDeleteModal}
                disabled={Boolean(
                  deletingPaymentId
                )}
              >
                <X size={17} />
              </button>

              <div className="payment-modal-danger-icon">
                <AlertTriangle size={25} />
              </div>

              <h2>Delete Payment?</h2>

              <p className="payment-modal-message">
                This payment will be
                permanently removed from the
                received payment history.
              </p>

              <div className="payment-modal-details">
                <div>
                  <span>Amount</span>

                  <strong>
                    {formatCurrency(
                      deleteModal.payment
                        .amount
                    )}
                  </strong>
                </div>

                <div>
                  <span>Payer</span>

                  <strong>
                    {deleteModal.payment
                      .payer_name ||
                      deleteModal.payment
                        .payment_title ||
                      "-"}
                  </strong>
                </div>

                <div>
                  <span>Payment Type</span>

                  <strong>
                    {formatLabel(
                      deleteModal.payment
                        .payment_type
                    )}
                  </strong>
                </div>

                <div>
                  <span>Lead</span>

                  <strong>
                    {deleteModal.payment
                      .lead_id
                      ? `Lead #${deleteModal.payment.lead_id}`
                      : "-"}
                  </strong>
                </div>
              </div>

              <div className="payment-modal-warning">
                <AlertTriangle size={16} />

                <span>
                  This action cannot be
                  undone.
                </span>
              </div>

              <div className="payment-modal-actions">
                <button
                  type="button"
                  className="payment-modal-cancel"
                  onClick={closeDeleteModal}
                  disabled={Boolean(
                    deletingPaymentId
                  )}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="payment-modal-delete"
                  onClick={
                    handleDeletePayment
                  }
                  disabled={Boolean(
                    deletingPaymentId
                  )}
                >
                  <Trash2 size={16} />

                  {deletingPaymentId
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

const receivePaymentStyles = `
.receive-payment-page {
  width: 100%;
  min-height: calc(100vh - 58px);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.payment-page-header {
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

.payment-title-wrap {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.payment-back-button {
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

.payment-back-button:hover {
  background: #eff6ff;
}

.payment-title-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: #059669;
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
  flex-shrink: 0;
}

.payment-page-header h1 {
  margin: 0;
  color: #06142b;
  font-size: 25px;
  line-height: 1.1;
}

.payment-page-header p {
  margin: 5px 0 0;
  color: #52677e;
  font-size: 13px;
  font-weight: 650;
}

.payment-count-pill {
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
  white-space: nowrap;
}

.payment-notification {
  min-height: 46px;
  padding: 11px 14px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  gap: 9px;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.035);
}

.payment-notification.success {
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
  color: #059669;
}

.payment-notification.error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
}

.payment-notification span {
  flex: 1;
  font-size: 13px;
  font-weight: 800;
}

.payment-notification button {
  width: 29px;
  height: 29px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: inherit;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.payment-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 11px;
}

.payment-summary-card {
  min-width: 0;
  min-height: 92px;
  padding: 14px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid var(--erp-border, #e2e8f0);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.035);
  display: flex;
  align-items: center;
  gap: 12px;
}

.summary-icon {
  width: 40px;
  height: 40px;
  border-radius: 13px;
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

.payment-summary-card span {
  display: block;
  color: #64748b;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

.payment-summary-card strong {
  display: block;
  margin-top: 5px;
  color: #06142b;
  font-size: 20px;
  font-weight: 900;
}

.payment-summary-card p {
  margin: 5px 0 0;
  color: #64748b;
  font-size: 11px;
  font-weight: 650;
}

.payment-entry-section,
.payment-history-section {
  width: 100%;
  border-radius: 19px;
  background: #ffffff;
  border: 1px solid var(--erp-border, #e2e8f0);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.045);
  overflow: hidden;
}

.payment-section-header,
.payment-history-header {
  min-height: 68px;
  padding: 14px 17px;
  border-bottom: 1px solid #eef2f7;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.payment-section-title {
  display: flex;
  align-items: center;
  gap: 11px;
}

.payment-section-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #bbf7d0;
  display: grid;
  place-items: center;
}

.payment-section-header h2,
.payment-history-header h2 {
  margin: 0;
  color: #06142b;
  font-size: 21px;
  font-weight: 900;
}

.payment-section-header p,
.payment-history-header p {
  margin: 5px 0 0;
  color: #64748b;
  font-size: 12px;
  font-weight: 650;
}

.payment-history-header > span {
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  background: #eef6ff;
  color: #2563eb;
  border: 1px solid #dbeafe;
  font-size: 11px;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
}

.payment-entry-form {
  padding: 14px 17px 17px;
}

.payment-type-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
  margin-bottom: 13px;
}

.payment-type-switch button {
  min-height: 41px;
  border-radius: 12px;
  border: 1px solid #dbe3ef;
  background: #ffffff;
  color: #0f172a;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.payment-type-switch button.active {
  background: #ecfdf5;
  border-color: #86efac;
  color: #059669;
}

.payment-type-switch button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.payment-form-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 13px;
}

.lead-select-field {
  grid-column: span 3;
}

.received-amount-field {
  grid-column: span 1;
}

.payment-form-group {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.payment-form-group label {
  color: #334155;
  font-size: 12px;
  font-weight: 850;
}

.payment-form-group input,
.payment-form-group select,
.payment-form-group textarea {
  width: 100%;
  min-height: 43px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #dbe3ef;
  background: #ffffff;
  color: #0f172a;
  outline: none;
  font-family: inherit;
  font-size: 13px;
  font-weight: 650;
}

.payment-form-group input::placeholder,
.payment-form-group textarea::placeholder {
  color: #94a3b8;
  font-size: 12px;
}

.payment-form-group input:focus,
.payment-form-group select:focus,
.payment-form-group textarea:focus {
  border-color: #93c5fd;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
}

.payment-form-group textarea {
  min-height: 82px;
  resize: vertical;
}

.payment-form-group small {
  color: #ea580c;
  font-size: 11px;
  font-weight: 700;
}

.full-span {
  grid-column: 1 / -1;
}

.lead-summary-grid {
  padding: 10px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.lead-summary-grid article {
  min-height: 64px;
  padding: 10px;
  border-radius: 11px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
}

.lead-summary-grid span {
  color: #64748b;
  font-size: 10px;
  font-weight: 850;
  text-transform: uppercase;
}

.lead-summary-grid strong {
  display: block;
  margin-top: 5px;
  color: #06142b;
  font-size: 13px;
  font-weight: 900;
  overflow-wrap: anywhere;
}

.payment-form-actions {
  margin-top: 13px;
  display: flex;
  justify-content: flex-end;
  gap: 9px;
}

.payment-primary-button,
.payment-secondary-button {
  min-width: 150px;
  min-height: 42px;
  border-radius: 11px;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.payment-primary-button {
  border: none;
  background: #059669;
  color: #ffffff;
}

.payment-secondary-button {
  border: 1px solid #dbe3ef;
  background: #ffffff;
  color: #334155;
}

.payment-primary-button:disabled,
.payment-secondary-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.payment-filter-row {
  padding: 11px 13px;
  background: #f8fafc;
  border-bottom: 1px solid #eef2f7;
  display: grid;
  grid-template-columns: minmax(240px, 1fr) 160px 160px 72px;
  gap: 9px;
}

.payment-search-box {
  min-height: 41px;
  padding: 0 11px;
  border-radius: 11px;
  border: 1px solid #dbe3ef;
  background: #ffffff;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 8px;
}

.payment-search-box input {
  width: 100%;
  height: 40px;
  border: none;
  background: transparent;
  outline: none;
  color: #0f172a;
  font-size: 13px;
  font-weight: 650;
}

.payment-filter-row select,
.payment-filter-row button {
  min-height: 41px;
  padding: 0 11px;
  border-radius: 11px;
  border: 1px solid #dbe3ef;
  background: #ffffff;
  color: #0f172a;
  font-size: 12px;
  font-weight: 800;
}

.payment-filter-row button {
  cursor: pointer;
}

.payment-card-grid {
  padding: 13px;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 11px;
}

.payment-record-card {
  min-width: 0;
  padding: 12px;
  border-radius: 15px;
  background: #ffffff;
  border: 1px solid #dbe3ef;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.035);
  display: flex;
  flex-direction: column;
}

.payment-record-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 7px;
}

.payment-record-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: #ecfdf5;
  color: #059669;
  display: grid;
  place-items: center;
}

.payment-type-badge {
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.payment-type-badge.lead_payment {
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
}

.payment-type-badge.other_payment {
  background: #f5f3ff;
  color: #7c3aed;
  border: 1px solid #ddd6fe;
}

.payment-record-main {
  margin-top: 10px;
  min-width: 0;
}

.payment-record-main h3 {
  margin: 0;
  color: #06142b;
  font-size: 15px;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.payment-record-main p {
  margin: 5px 0 0;
  color: #64748b;
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.payment-value-box {
  margin-top: 10px;
  padding: 10px;
  border-radius: 11px;
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
}

.payment-value-box span {
  display: block;
  color: #047857;
  font-size: 9px;
  font-weight: 850;
  text-transform: uppercase;
}

.payment-value-box strong {
  display: block;
  margin-top: 5px;
  color: #047857;
  font-size: 18px;
  font-weight: 950;
}

.payment-record-details {
  margin-top: 9px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.payment-record-details div {
  min-width: 0;
  padding: 8px;
  border-radius: 9px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.payment-record-details span {
  display: block;
  color: #64748b;
  font-size: 8px;
  font-weight: 850;
  text-transform: uppercase;
}

.payment-record-details strong {
  display: block;
  margin-top: 4px;
  color: #06142b;
  font-size: 11px;
  font-weight: 850;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.payment-remarks {
  margin: 8px 0 0;
  padding: 8px;
  border-radius: 9px;
  background: #fff7ed;
  color: #9a3412;
  font-size: 11px;
  line-height: 1.4;
}

.payment-delete-button {
  width: 100%;
  min-height: 36px;
  margin-top: auto;
  padding: 0 10px;
  border: none;
  border-radius: 10px;
  background: #fef2f2;
  color: #dc2626;
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.payment-delete-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.payment-empty-state,
.access-empty-state {
  min-height: 250px;
  padding: 32px 20px;
  color: #059669;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
}

.access-empty-state {
  border-radius: 18px;
  border: 1px solid #e2e8f0;
}

.payment-empty-state h3,
.access-empty-state h3 {
  margin: 0;
  color: #06142b;
  font-size: 18px;
}

.payment-empty-state p,
.access-empty-state p {
  margin: 0;
  color: #64748b;
  font-size: 12px;
}

.payment-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  padding: 20px;
  background: rgba(15, 23, 42, 0.58);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.payment-delete-modal {
  width: min(440px, 100%);
  position: relative;
  padding: 23px;
  border-radius: 21px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 30px 75px rgba(15, 23, 42, 0.3);
  text-align: center;
}

.payment-modal-close {
  position: absolute;
  top: 13px;
  right: 13px;
  width: 33px;
  height: 33px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #64748b;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.payment-modal-danger-icon {
  width: 54px;
  height: 54px;
  margin: 0 auto 14px;
  border-radius: 17px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  display: grid;
  place-items: center;
}

.payment-delete-modal h2 {
  margin: 0;
  color: #06142b;
  font-size: 21px;
}

.payment-modal-message {
  margin: 8px auto 15px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.55;
}

.payment-modal-details {
  padding: 10px;
  border-radius: 15px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  text-align: left;
}

.payment-modal-details div {
  min-height: 56px;
  padding: 9px;
  border-radius: 11px;
  background: #ffffff;
  border: 1px solid #eef2f7;
}

.payment-modal-details span {
  color: #64748b;
  font-size: 9px;
  font-weight: 850;
  text-transform: uppercase;
}

.payment-modal-details strong {
  display: block;
  margin-top: 5px;
  color: #06142b;
  font-size: 12px;
  font-weight: 900;
  overflow-wrap: anywhere;
}

.payment-modal-warning {
  margin-top: 12px;
  padding: 9px;
  border-radius: 10px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #c2410c;
  font-size: 10px;
  font-weight: 850;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.payment-modal-actions {
  margin-top: 16px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

.payment-modal-cancel,
.payment-modal-delete {
  min-height: 40px;
  border-radius: 11px;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.payment-modal-cancel {
  border: 1px solid #dbe3ef;
  background: #ffffff;
  color: #334155;
}

.payment-modal-delete {
  border: none;
  background: #dc2626;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.payment-modal-cancel:disabled,
.payment-modal-delete:disabled,
.payment-modal-close:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

@media (max-width: 1600px) {
  .payment-card-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 1350px) {
  .payment-form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .lead-select-field,
  .received-amount-field {
    grid-column: span 1;
  }

  .payment-card-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1050px) {
  .payment-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .payment-card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .payment-filter-row {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 760px) {
  .payment-page-header {
    align-items: stretch;
    flex-direction: column;
  }

  .payment-count-pill {
    width: 100%;
    justify-content: center;
  }

  .payment-form-grid,
  .lead-summary-grid,
  .payment-summary-grid {
    grid-template-columns: 1fr;
  }

  .lead-select-field,
  .received-amount-field {
    grid-column: 1 / -1;
  }

  .payment-filter-row {
    grid-template-columns: 1fr;
  }

  .payment-form-actions {
    flex-direction: column;
  }

  .payment-primary-button,
  .payment-secondary-button {
    width: 100%;
  }
}

@media (max-width: 560px) {
  .payment-card-grid,
  .payment-modal-details,
  .payment-modal-actions,
  .payment-type-switch {
    grid-template-columns: 1fr;
  }

  .payment-title-wrap {
    align-items: flex-start;
  }

  .payment-page-header h1 {
    font-size: 21px;
  }
}
`;