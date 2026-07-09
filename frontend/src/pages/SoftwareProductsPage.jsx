import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  IndianRupee,
  PackageCheck,
  PencilLine,
  Plus,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import api from "../api/api";
import { useAuth } from "../context/AuthContext";

const ADMIN_ROLES = ["super-admin", "company-admin", "admin", "owner"];

const SOFTWARE_TYPES = [
  { value: "existing_software", label: "Existing Software" },
  { value: "custom_software", label: "Custom Software" },
  { value: "social_media_management", label: "Social Media Management" },
  { value: "internal_project", label: "Internal Project" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

const RECURRING_CYCLES = [
  { value: "", label: "No Recurring" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "one_time", label: "One Time" },
];

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

const normalizeRole = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replaceAll(" ", "-");
};

const normalizeType = (value) => {
  if (!value) return "existing_software";

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

const getProductTotal = (product) => {
  return Number(product?.base_price || 0) + Number(product?.setup_charge || 0);
};

const getEmptyForm = () => ({
  software_name: "",
  software_type: "existing_software",
  description: "",
  base_price: "",
  setup_charge: "0",
  recurring_amount: "",
  recurring_cycle: "",
  version: "",
  demo_url: "",
  documentation_url: "",
  status: "active",
  notes: "",
  is_active: true,
});

const buildPayload = (form) => ({
  software_name: form.software_name.trim(),
  software_type: normalizeType(form.software_type),
  description: form.description.trim() || null,
  base_price: form.base_price ? Number(form.base_price) : 0,
  setup_charge: form.setup_charge ? Number(form.setup_charge) : 0,
  recurring_amount: form.recurring_amount ? Number(form.recurring_amount) : null,
  recurring_cycle: form.recurring_cycle || null,
  version: form.version.trim() || null,
  demo_url: form.demo_url.trim() || null,
  documentation_url: form.documentation_url.trim() || null,
  status: form.status || "active",
  notes: form.notes.trim() || null,
  is_active: form.status !== "inactive" && form.status !== "archived",
});

export default function SoftwareProductsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(getEmptyForm());

  const [notification, setNotification] = useState({
    type: "",
    message: "",
  });

  const userRole = normalizeRole(user?.role);
  const isAdminUser = ADMIN_ROLES.includes(userRole);

  const summary = useMemo(() => {
    const active = products.filter(
      (product) => product.is_active !== false && product.status === "active"
    ).length;

    const inactive = products.filter(
      (product) => product.status === "inactive" || product.is_active === false
    ).length;

    const totalValue = products.reduce(
      (total, product) => total + getProductTotal(product),
      0
    );

    const recurringValue = products.reduce(
      (total, product) => total + Number(product.recurring_amount || 0),
      0
    );

    return {
      total: products.length,
      active,
      inactive,
      totalValue,
      recurringValue,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return products.filter((product) => {
      const type = normalizeType(product.software_type);
      const status = product.status || "active";

      const searchTarget = [
        product.software_name,
        product.software_type,
        product.description,
        product.version,
        product.demo_url,
        product.documentation_url,
        product.notes,
        product.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchMatch = search ? searchTarget.includes(search) : true;
      const typeMatch = typeFilter ? type === typeFilter : true;
      const statusMatch = statusFilter ? status === statusFilter : true;

      return searchMatch && typeMatch && statusMatch;
    });
  }, [products, searchText, typeFilter, statusFilter]);

  const showNotification = (type, message) => {
    setNotification({
      type,
      message,
    });

    window.setTimeout(() => {
      setNotification({
        type: "",
        message: "",
      });
    }, 4200);
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);

      const response = await api.get("/sales/software-products", {
        params: {
          active_only: false,
        },
      });

      setProducts(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      showNotification(
        "error",
        error?.response?.data?.detail || "Failed to load software products"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const openCreateModal = () => {
    setEditingProduct(null);
    setForm(getEmptyForm());
    setShowModal(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);

    setForm({
      software_name: product.software_name || "",
      software_type: product.software_type || "existing_software",
      description: product.description || "",
      base_price:
        product.base_price !== null && product.base_price !== undefined
          ? String(product.base_price)
          : "",
      setup_charge:
        product.setup_charge !== null && product.setup_charge !== undefined
          ? String(product.setup_charge)
          : "0",
      recurring_amount:
        product.recurring_amount !== null && product.recurring_amount !== undefined
          ? String(product.recurring_amount)
          : "",
      recurring_cycle: product.recurring_cycle || "",
      version: product.version || "",
      demo_url: product.demo_url || "",
      documentation_url: product.documentation_url || "",
      status: product.status || "active",
      notes: product.notes || "",
      is_active: product.is_active !== false,
    });

    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setEditingProduct(null);
    setForm(getEmptyForm());
    setShowModal(false);
  };

  const updateFormField = (event) => {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmitProduct = async (event) => {
    event.preventDefault();

    if (!isAdminUser) {
      showNotification("error", "Only admin can create or update software products");
      return;
    }

    if (!form.software_name.trim()) {
      showNotification("error", "Software name is required");
      return;
    }

    try {
      setSaving(true);

      const payload = buildPayload(form);

      if (editingProduct) {
        await api.put(`/sales/software-products/${editingProduct.id}`, payload);
        showNotification("success", "Software product updated successfully");
      } else {
        await api.post("/sales/software-products", payload);
        showNotification("success", "Software product created successfully");
      }

      closeModal();
      await fetchProducts();
    } catch (error) {
      showNotification(
        "error",
        error?.response?.data?.detail ||
          (editingProduct
            ? "Failed to update software product"
            : "Failed to create software product")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateProduct = async (product) => {
    if (!isAdminUser) {
      showNotification("error", "Only admin can deactivate software products");
      return;
    }

    const confirmed = window.confirm(
      `Deactivate ${product.software_name}? It will not show in Existing Software dropdown.`
    );

    if (!confirmed) return;

    try {
      await api.delete(`/sales/software-products/${product.id}`);
      await fetchProducts();
      showNotification("success", "Software product deactivated successfully");
    } catch (error) {
      showNotification(
        "error",
        error?.response?.data?.detail || "Failed to deactivate software product"
      );
    }
  };

  const clearFilters = () => {
    setSearchText("");
    setStatusFilter("");
    setTypeFilter("");
  };

  return (
    <>
      <style>{softwareProductsPageStyles}</style>

      <div className="software-products-page">
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
              <PackageCheck size={22} />
            </div>

            <div>
              <h1>Software Products</h1>
              <p>
                Manage reusable software products that can be selected in Existing
                Software leads.
              </p>
            </div>
          </div>

          <div className="header-actions">
            <span className="count-pill">
              {loading ? "Loading..." : `${filteredProducts.length} Products`}
            </span>

            {isAdminUser && (
              <button
                type="button"
                className="create-button"
                onClick={openCreateModal}
              >
                <Plus size={17} />
                Add Software
              </button>
            )}
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
              onClick={() => setNotification({ type: "", message: "" })}
            >
              <X size={15} />
            </button>
          </div>
        )}

        <section className="summary-grid">
          <div className="summary-card">
            <span>Total Software</span>
            <strong>{summary.total}</strong>
            <small>All listed products</small>
          </div>

          <div className="summary-card">
            <span>Active</span>
            <strong>{summary.active}</strong>
            <small>Available in CRM dropdown</small>
          </div>

          <div className="summary-card">
            <span>Inactive</span>
            <strong>{summary.inactive}</strong>
            <small>Hidden from new sales</small>
          </div>

          <div className="summary-card">
            <span>Total Product Value</span>
            <strong>{formatCurrency(summary.totalValue)}</strong>
            <small>Base + setup value</small>
          </div>

          <div className="summary-card">
            <span>Recurring Value</span>
            <strong>{formatCurrency(summary.recurringValue)}</strong>
            <small>Total recurring amount</small>
          </div>
        </section>

        <section className="toolbar-card">
          <div className="search-box">
            <Search size={18} />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search software name, type, version, notes..."
            />
          </div>

          <div className="toolbar-filters">
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="">All Types</option>
              {SOFTWARE_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All Status</option>
              {STATUS_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <button type="button" className="clear-button" onClick={clearFilters}>
              Clear
            </button>
          </div>
        </section>

        <section className="products-card">
          <div className="list-header">
            <div>
              <h2>Software List</h2>
              <p>
                {loading
                  ? "Loading software products..."
                  : `${filteredProducts.length} software products found`}
              </p>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="empty-state-card">
              <PackageCheck size={34} />
              <h3>No software products found</h3>
              <p>
                Add software manually here, or complete a project and add it as
                software from Projects page.
              </p>
            </div>
          ) : (
            <div className="products-grid">
              {filteredProducts.map((product) => {
                const totalPrice = getProductTotal(product);

                return (
                  <article className="product-card" key={product.id}>
                    <div className="product-top-row">
                      <div className="product-icon">
                        <PackageCheck size={20} />
                      </div>

                      <span className={`status-pill status-${product.status || "active"}`}>
                        {formatLabel(product.status || "active")}
                      </span>
                    </div>

                    <h3>{product.software_name}</h3>

                    <p className="product-description">
                      {product.description || "No description added"}
                    </p>

                    <div className="product-info-grid">
                      <div>
                        <span>Type</span>
                        <strong>{formatLabel(product.software_type)}</strong>
                      </div>

                      <div>
                        <span>Version</span>
                        <strong>{product.version || "-"}</strong>
                      </div>

                      <div>
                        <span>Base Price</span>
                        <strong>{formatCurrency(product.base_price)}</strong>
                      </div>

                      <div>
                        <span>Setup Charge</span>
                        <strong>{formatCurrency(product.setup_charge)}</strong>
                      </div>

                      <div>
                        <span>Total Price</span>
                        <strong>{formatCurrency(totalPrice)}</strong>
                      </div>

                      <div>
                        <span>Recurring</span>
                        <strong>
                          {product.recurring_amount
                            ? `${formatCurrency(product.recurring_amount)} / ${formatLabel(
                                product.recurring_cycle
                              )}`
                            : "-"}
                        </strong>
                      </div>
                    </div>

                    {(product.demo_url || product.documentation_url) && (
                      <div className="link-row">
                        {product.demo_url && (
                          <a
                            href={product.demo_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink size={14} />
                            Demo
                          </a>
                        )}

                        {product.documentation_url && (
                          <a
                            href={product.documentation_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink size={14} />
                            Docs
                          </a>
                        )}
                      </div>
                    )}

                    {product.notes && (
                      <div className="notes-box">
                        <span>Notes</span>
                        <p>{product.notes}</p>
                      </div>
                    )}

                    {isAdminUser && (
                      <div className="product-actions">
                        <button
                          type="button"
                          className="edit-button"
                          onClick={() => openEditModal(product)}
                        >
                          <PencilLine size={15} />
                          Edit
                        </button>

                        <button
                          type="button"
                          className="delete-button"
                          onClick={() => handleDeactivateProduct(product)}
                        >
                          <Trash2 size={15} />
                          Deactivate
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {showModal && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeModal();
            }}
          >
            <form className="modal-card" onSubmit={handleSubmitProduct}>
              <div className="modal-header">
                <div className="modal-title-row">
                  <div className="modal-title-icon">
                    <PackageCheck size={20} />
                  </div>

                  <div>
                    <h2>{editingProduct ? "Edit Software" : "Add Software"}</h2>
                    <p>
                      Add pricing, recurring charge, demo links, and status for
                      CRM sales.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="modal-close-button"
                  onClick={closeModal}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Software Name *</label>
                  <input
                    name="software_name"
                    value={form.software_name}
                    onChange={updateFormField}
                    placeholder="Example: Loyalty Reward Management System"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Software Type</label>
                  <select
                    name="software_type"
                    value={form.software_type}
                    onChange={updateFormField}
                  >
                    {SOFTWARE_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={updateFormField}
                  >
                    {STATUS_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Base Price</label>
                  <input
                    name="base_price"
                    type="number"
                    min="0"
                    value={form.base_price}
                    onChange={updateFormField}
                    placeholder="Example: 50000"
                  />
                </div>

                <div className="form-group">
                  <label>Setup Charge</label>
                  <input
                    name="setup_charge"
                    type="number"
                    min="0"
                    value={form.setup_charge}
                    onChange={updateFormField}
                    placeholder="Example: 10000"
                  />
                </div>

                <div className="form-group">
                  <label>Recurring Amount</label>
                  <input
                    name="recurring_amount"
                    type="number"
                    min="0"
                    value={form.recurring_amount}
                    onChange={updateFormField}
                    placeholder="Example: 2000"
                  />
                </div>

                <div className="form-group">
                  <label>Recurring Cycle</label>
                  <select
                    name="recurring_cycle"
                    value={form.recurring_cycle}
                    onChange={updateFormField}
                  >
                    {RECURRING_CYCLES.map((item) => (
                      <option key={item.value || "none"} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Version</label>
                  <input
                    name="version"
                    value={form.version}
                    onChange={updateFormField}
                    placeholder="Example: v1.0"
                  />
                </div>

                <div className="form-group">
                  <label>Demo URL</label>
                  <input
                    name="demo_url"
                    value={form.demo_url}
                    onChange={updateFormField}
                    placeholder="https://..."
                  />
                </div>

                <div className="form-group">
                  <label>Documentation URL</label>
                  <input
                    name="documentation_url"
                    value={form.documentation_url}
                    onChange={updateFormField}
                    placeholder="https://..."
                  />
                </div>

                <div className="form-group full-span">
                  <label>Description</label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={updateFormField}
                    placeholder="Software details, target customer, features..."
                  />
                </div>

                <div className="form-group full-span">
                  <label>Notes</label>
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={updateFormField}
                    placeholder="Internal notes"
                  />
                </div>
              </div>

              <div className="form-total-box">
                <IndianRupee size={18} />
                <div>
                  <span>Total One-time Price</span>
                  <strong>
                    {formatCurrency(
                      Number(form.base_price || 0) + Number(form.setup_charge || 0)
                    )}
                  </strong>
                </div>
              </div>

              <div className="form-actions-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button type="submit" className="primary-button" disabled={saving}>
                  {saving
                    ? editingProduct
                      ? "Saving..."
                      : "Creating..."
                    : editingProduct
                      ? "Save Changes"
                      : "Create Software"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </>
  );
}

const softwareProductsPageStyles = `
.software-products-page {
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

.create-button {
  min-width: 132px;
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
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 13px;
}

.summary-card {
  min-height: 106px;
  padding: 16px;
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.045);
}

.summary-card span {
  color: #64748b;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

.summary-card strong {
  display: block;
  margin-top: 10px;
  color: #06142b;
  font-size: 22px;
  font-weight: 900;
}

.summary-card small {
  display: block;
  margin-top: 6px;
  color: #52677e;
  font-size: 12px;
  font-weight: 600;
}

.toolbar-card,
.products-card {
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.055);
}

.toolbar-card {
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
  min-width: 160px;
}

.clear-button {
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

.products-card {
  min-height: 560px;
  overflow: hidden;
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

.products-grid {
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.product-card {
  min-height: 330px;
  padding: 16px;
  border-radius: 19px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.product-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.product-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: #059669;
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
}

.status-pill {
  height: 27px;
  padding: 0 10px;
  border-radius: 999px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #334155;
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 900;
}

.status-active {
  color: #059669;
  background: #ecfdf5;
  border-color: #bbf7d0;
}

.status-inactive,
.status-archived {
  color: #dc2626;
  background: #fef2f2;
  border-color: #fecaca;
}

.product-card h3 {
  margin: 0;
  color: #06142b;
  font-size: 17px;
  font-weight: 900;
}

.product-description {
  min-height: 38px;
  margin: 0;
  color: #52677e;
  font-size: 12px;
  line-height: 1.5;
  font-weight: 600;
}

.product-info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}

.product-info-grid div {
  min-height: 58px;
  padding: 10px;
  border-radius: 13px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
}

.product-info-grid span {
  display: block;
  color: #64748b;
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
}

.product-info-grid strong {
  display: block;
  margin-top: 6px;
  color: #0f172a;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.link-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.link-row a {
  height: 32px;
  padding: 0 10px;
  border-radius: 11px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #2563eb;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 900;
  text-decoration: none;
}

.notes-box {
  padding: 10px;
  border-radius: 13px;
  background: #fffbeb;
  border: 1px solid #fde68a;
}

.notes-box span {
  display: block;
  color: #92400e;
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
}

.notes-box p {
  margin: 5px 0 0;
  color: #78350f;
  font-size: 12px;
  font-weight: 700;
}

.product-actions {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 9px;
}

.edit-button,
.delete-button {
  height: 38px;
  padding: 0 12px;
  border-radius: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.edit-button {
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #2563eb;
}

.delete-button {
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #dc2626;
}

.empty-state-card {
  min-height: 360px;
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

.modal-backdrop {
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

.modal-card {
  width: min(1040px, 100%);
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

.modal-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.modal-title-icon {
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

.modal-title-row h2 {
  margin: 0;
  color: #06142b;
  font-size: 21px;
  font-weight: 800;
}

.modal-title-row p {
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
  flex-shrink: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
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

.full-span {
  grid-column: span 3;
}

.form-total-box {
  min-height: 58px;
  margin-top: 15px;
  padding: 12px;
  border-radius: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #2563eb;
}

.form-total-box span {
  display: block;
  color: #64748b;
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
}

.form-total-box strong {
  display: block;
  margin-top: 4px;
  color: #06142b;
  font-size: 16px;
  font-weight: 900;
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

.primary-button:disabled,
.secondary-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

@media (max-width: 1280px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .toolbar-card {
    grid-template-columns: 1fr;
  }

  .toolbar-filters {
    flex-wrap: wrap;
  }

  .products-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .full-span {
    grid-column: span 2;
  }
}

@media (max-width: 760px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .count-pill,
  .create-button {
    width: 100%;
    justify-content: center;
  }

  .summary-grid,
  .products-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }

  .toolbar-filters {
    flex-direction: column;
  }

  .toolbar-filters select,
  .clear-button {
    width: 100%;
  }

  .full-span {
    grid-column: span 1;
  }

  .product-actions,
  .form-actions-row {
    flex-direction: column;
  }

  .edit-button,
  .delete-button,
  .primary-button,
  .secondary-button {
    width: 100%;
  }

  .modal-backdrop {
    align-items: flex-start;
    padding: 14px;
  }

  .modal-card {
    max-height: calc(100vh - 28px);
  }
}
`;