import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  Filter,
  IndianRupee,
  Mail,
  PencilLine,
  Phone,
  Plus,
  PlusCircle,
  Search,
  Target,
  Trash2,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import api from "../api/api";
import { useAuth } from "../context/AuthContext";

const ADMIN_ROLES = ["super-admin", "company-admin", "admin", "owner"];

const LEAD_PROGRESS_STATUSES = ["new", "contacted", "interested", "proposal-sent"];

const WORKFLOW_STATUS_OPTIONS = [
  "new",
  "contacted",
  "interested",
  "proposal-sent",
  "converted",
  "delivered",
  "completed",
  "lost",
];

const SERVICE_OPTIONS = [
  { value: "custom_software", label: "Custom Software" },
  { value: "existing_software", label: "Existing Software" },
  { value: "website", label: "Website" },
  { value: "mobile_app", label: "Mobile App" },
  { value: "social_media_management", label: "Social Media Management" },
  { value: "other", label: "Other" },
];

const LEAD_SOURCE_OPTIONS = [
  { value: "website", label: "Website" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "referral", label: "Referral" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "cold_call", label: "Cold Call" },
  { value: "email", label: "Email" },
  { value: "other", label: "Other" },
];

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

const normalizeRole = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replaceAll(" ", "-");
};

const normalizePortal = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replaceAll(" ", "-");
};

const normalizeStatus = (value, fallback = "new") => {
  if (!value) return fallback;

  const cleaned = String(value).trim().toLowerCase().replaceAll("_", "-");

  if (cleaned === "proposal sent") return "proposal-sent";
  if (cleaned === "not interested") return "not-interested";

  return cleaned;
};

const normalizeServiceType = (value) => {
  if (!value) return "custom_software";

  return String(value)
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");
};

const parsePortalAccess = (value) => {
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
};

const hasPortalAccess = (user, portalKey) => {
  const role = normalizeRole(user?.role);

  if (ADMIN_ROLES.includes(role)) {
    return true;
  }

  const portalAccess = parsePortalAccess(user?.portal_access);

  return portalAccess.includes(normalizePortal(portalKey));
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const getLeadTabStatus = (status) => {
  const value = normalizeStatus(status);

  if (["new", "contacted", "interested", "proposal-sent"].includes(value)) {
    return "ongoing";
  }

  if (value === "converted") return "converted";
  if (value === "delivered") return "delivered";
  if (value === "completed") return "completed";

  return "lost";
};

const getErrorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item?.msg || item?.message || "Validation error")
      .join(", ");
  }

  return fallback;
};

const getSoftwareProductPrice = (product) => {
  if (!product) return 0;

  return Number(product.base_price || 0) + Number(product.setup_charge || 0);
};

const getEmptyLeadForm = () => ({
  client_name: "",
  client_phone: "",
  client_email: "",
  client_company_name: "",
  client_address: "",
  service_type: "custom_software",
  software_product_id: "",
  lead_source: "website",
  expected_value: "",
  follow_up_date: "",
  notes: "",
});

const getEmptyConvertForm = (lead = null) => ({
  software_product_id: lead?.software_product_id ? String(lead.software_product_id) : "",
  final_sale_amount:
    lead?.final_sale_amount ||
    lead?.proposal_amount ||
    lead?.expected_value ||
    "",
  commission_percentage: "0",
  remarks: "Converted from Sales CRM",
});

export default function SalesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [softwareProducts, setSoftwareProducts] = useState([]);
  const [summary, setSummary] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState("");

  const [searchText, setSearchText] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);

  const [selectedLead, setSelectedLead] = useState(null);
  const [leadForm, setLeadForm] = useState(getEmptyLeadForm());
  const [editForm, setEditForm] = useState(getEmptyLeadForm());
  const [convertForm, setConvertForm] = useState(getEmptyConvertForm());

  const [notification, setNotification] = useState({
    type: "",
    message: "",
  });

  const [confirmModal, setConfirmModal] = useState({
    open: false,
    action: "",
    lead: null,
    loading: false,
  });

  const userRole = normalizeRole(user?.role);
  const isAdminUser = ADMIN_ROLES.includes(userRole);
  const canUseCRM = hasPortalAccess(user, "sales");

  const currentUserName =
    user?.full_name || user?.name || user?.username || user?.email || "Me";

  const activeSoftwareProducts = useMemo(() => {
    return softwareProducts.filter((product) => {
      return product.is_active !== false && product.status !== "inactive";
    });
  }, [softwareProducts]);

  const softwareProductMap = useMemo(() => {
    const map = new Map();

    softwareProducts.forEach((product) => {
      map.set(Number(product.id), product);
    });

    return map;
  }, [softwareProducts]);

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

  const usersMap = useMemo(() => {
    const map = new Map();

    users.forEach((item) => {
      map.set(item.id, item);
    });

    return map;
  }, [users]);

  const localSummary = useMemo(() => {
    const totalLeads = leads.length;

    const ongoingLeads = leads.filter(
      (lead) => getLeadTabStatus(lead.status) === "ongoing"
    ).length;

    const convertedLeads = leads.filter(
      (lead) => normalizeStatus(lead.status) === "converted"
    ).length;

    const deliveredLeads = leads.filter(
      (lead) => normalizeStatus(lead.status) === "delivered"
    ).length;

    const completedLeads = leads.filter(
      (lead) => normalizeStatus(lead.status) === "completed"
    ).length;

    const lostLeads = leads.filter(
      (lead) => getLeadTabStatus(lead.status) === "lost"
    ).length;

    const finalSales = leads.reduce(
      (total, lead) => total + Number(lead.final_sale_amount || 0),
      0
    );

    return {
      total_leads: totalLeads,
      ongoing_leads: ongoingLeads,
      converted_leads: convertedLeads,
      delivered_leads: deliveredLeads,
      completed_leads: completedLeads,
      lost_leads: lostLeads,
      final_sales: finalSales,
    };
  }, [leads]);

  const displaySummary = useMemo(() => {
    return {
      ...localSummary,
      ...(summary || {}),
    };
  }, [localSummary, summary]);

  const pipelineModules = useMemo(() => {
    return [
      {
        key: "ongoing",
        title: "Ongoing CRM",
        description: "New, contacted, interested, and proposal leads.",
        count: displaySummary.ongoing_leads || 0,
        icon: Filter,
        tone: "blue",
      },
      {
        key: "converted",
        title: "Converted Sales",
        description: "Confirmed sales after final amount is added.",
        count: displaySummary.converted_leads || 0,
        icon: IndianRupee,
        tone: "orange",
      },
      {
        key: "delivered",
        title: "Delivered",
        description: "Converted work delivered to the client.",
        count: displaySummary.delivered_leads || 0,
        icon: CheckCircle2,
        tone: "green",
      },
      {
        key: "completed",
        title: "Completed",
        description: "Delivered leads closed and completed.",
        count: displaySummary.completed_leads || 0,
        icon: ClipboardList,
        tone: "purple",
      },
      {
        key: "lost",
        title: "Lost Leads",
        description: "Leads that did not convert into sales.",
        count: displaySummary.lost_leads || 0,
        icon: X,
        tone: "red",
      },
    ];
  }, [displaySummary]);

  const activeModule = useMemo(() => {
    return pipelineModules.find((module) => module.key === activeTab) || null;
  }, [pipelineModules, activeTab]);

  const availableStatusFilters = useMemo(() => {
    if (activeTab === "ongoing") {
      return ["new", "contacted", "interested", "proposal-sent"];
    }

    if (activeTab === "converted") return ["converted"];
    if (activeTab === "delivered") return ["delivered"];
    if (activeTab === "completed") return ["completed"];
    if (activeTab === "lost") return ["lost", "not-interested"];

    return WORKFLOW_STATUS_OPTIONS;
  }, [activeTab]);

  const getSoftwareProductName = (softwareProductId) => {
    if (!softwareProductId) return "";

    const product = softwareProductMap.get(Number(softwareProductId));

    return product?.software_name || "";
  };

  const filteredLeads = useMemo(() => {
    if (!activeTab) return [];

    const search = searchText.trim().toLowerCase();

    return leads.filter((lead) => {
      const leadStatus = normalizeStatus(lead.status);
      const serviceType = normalizeServiceType(
        lead.service_type || lead.service_interest
      );
      const softwareName = getSoftwareProductName(lead.software_product_id);

      const tabMatch = getLeadTabStatus(leadStatus) === activeTab;

      const searchTarget = [
        lead.client_name,
        lead.client_phone,
        lead.client_email,
        lead.client_company_name,
        lead.client_address,
        lead.service_interest,
        lead.service_type,
        softwareName,
        lead.lead_source,
        lead.status,
        lead.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchMatch = search ? searchTarget.includes(search) : true;
      const serviceMatch = serviceFilter ? serviceType === serviceFilter : true;
      const sourceMatch = sourceFilter ? lead.lead_source === sourceFilter : true;
      const statusMatch = statusFilter ? leadStatus === statusFilter : true;

      return tabMatch && searchMatch && serviceMatch && sourceMatch && statusMatch;
    });
  }, [
    leads,
    activeTab,
    searchText,
    serviceFilter,
    sourceFilter,
    statusFilter,
    softwareProductMap,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / ITEMS_PER_PAGE));

  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLeads.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredLeads, currentPage]);

  const pageStart = filteredLeads.length
    ? (currentPage - 1) * ITEMS_PER_PAGE + 1
    : 0;

  const pageEnd = Math.min(currentPage * ITEMS_PER_PAGE, filteredLeads.length);

  const fetchUsers = async () => {
    if (!isAdminUser) return;

    try {
      const response = await api.get("/users");
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Users loading error:", error);
    }
  };

  const fetchLeads = async () => {
    try {
      const response = await api.get("/sales/leads");
      setLeads(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      showNotification("error", getErrorMessage(error, "Failed to load CRM leads"));
    }
  };

  const fetchSoftwareProducts = async () => {
    try {
      const response = await api.get("/sales/software-products");
      setSoftwareProducts(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Software products loading error:", error);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await api.get("/sales/summary");
      setSummary(response.data || null);
    } catch (error) {
      console.error("CRM summary loading error:", error);
    }
  };

  const fetchAll = async () => {
    if (!canUseCRM) return;

    try {
      setLoading(true);
      await Promise.all([
        fetchUsers(),
        fetchLeads(),
        fetchSoftwareProducts(),
        fetchSummary(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseCRM]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchText, serviceFilter, sourceFilter, statusFilter]);

  const getUserName = (userId) => {
    if (!userId) return "Owner / Direct";

    if (Number(userId) === Number(user?.id)) {
      return currentUserName;
    }

    const foundUser = usersMap.get(userId);

    if (!foundUser) return `User ID: ${userId}`;

    return foundUser.full_name || foundUser.person?.full_name || foundUser.email;
  };

  const getSelectedProductFromForm = (form) => {
    if (!form?.software_product_id) return null;

    return softwareProductMap.get(Number(form.software_product_id)) || null;
  };

  const clearFilters = () => {
    setSearchText("");
    setServiceFilter("");
    setSourceFilter("");
    setStatusFilter("");
    setCurrentPage(1);
  };

  const openPipelineModule = (moduleKey) => {
    setActiveTab(moduleKey);
    clearFilters();
  };

  const backToModules = () => {
    setActiveTab("");
    clearFilters();
  };

  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const updateLeadField = (event) => {
    const { name, value } = event.target;

    setLeadForm((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      if (name === "service_type") {
        const serviceType = normalizeServiceType(value);

        if (serviceType !== "existing_software") {
          return {
            ...next,
            software_product_id: "",
          };
        }

        return next;
      }

      if (name === "software_product_id") {
        const product = softwareProductMap.get(Number(value));
        const productPrice = getSoftwareProductPrice(product);

        return {
          ...next,
          expected_value: productPrice > 0 ? String(productPrice) : next.expected_value,
        };
      }

      return next;
    });
  };

  const updateEditField = (event) => {
    const { name, value } = event.target;

    setEditForm((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      if (name === "service_type") {
        const serviceType = normalizeServiceType(value);

        if (serviceType !== "existing_software") {
          return {
            ...next,
            software_product_id: "",
          };
        }

        return next;
      }

      if (name === "software_product_id") {
        const product = softwareProductMap.get(Number(value));
        const productPrice = getSoftwareProductPrice(product);

        return {
          ...next,
          expected_value: productPrice > 0 ? String(productPrice) : next.expected_value,
        };
      }

      return next;
    });
  };

  const updateConvertField = (event) => {
    const { name, value } = event.target;

    setConvertForm((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      if (name === "software_product_id") {
        const product = softwareProductMap.get(Number(value));
        const productPrice = getSoftwareProductPrice(product);

        return {
          ...next,
          final_sale_amount: productPrice > 0 ? String(productPrice) : next.final_sale_amount,
        };
      }

      return next;
    });
  };

  const closeLeadModal = () => {
    setLeadForm(getEmptyLeadForm());
    setShowLeadModal(false);
  };

  const closeViewModal = () => {
    setSelectedLead(null);
    setShowViewModal(false);
  };

  const closeEditModal = () => {
    setSelectedLead(null);
    setEditForm(getEmptyLeadForm());
    setShowEditModal(false);
  };

  const closeConvertModal = () => {
    setSelectedLead(null);
    setConvertForm(getEmptyConvertForm());
    setShowConvertModal(false);
  };

  const openViewModal = (lead) => {
    setSelectedLead(lead);
    setShowViewModal(true);
  };

  const openEditModal = (lead) => {
    setSelectedLead(lead);

    setEditForm({
      client_name: lead.client_name || "",
      client_phone: lead.client_phone || "",
      client_email: lead.client_email || "",
      client_company_name: lead.client_company_name || "",
      client_address: lead.client_address || "",
      service_type: normalizeServiceType(lead.service_type || lead.service_interest),
      software_product_id: lead.software_product_id
        ? String(lead.software_product_id)
        : "",
      lead_source: lead.lead_source || "website",
      expected_value:
        lead.expected_value !== null && lead.expected_value !== undefined
          ? String(lead.expected_value)
          : "",
      follow_up_date: lead.follow_up_date || "",
      notes: lead.notes || "",
    });

    setShowEditModal(true);
  };

  const openConvertModal = (lead) => {
    const product = lead.software_product_id
      ? softwareProductMap.get(Number(lead.software_product_id))
      : null;

    const productPrice = getSoftwareProductPrice(product);

    setSelectedLead(lead);
    setConvertForm({
      ...getEmptyConvertForm(lead),
      software_product_id: lead.software_product_id
        ? String(lead.software_product_id)
        : "",
      final_sale_amount:
        lead.final_sale_amount ||
        lead.proposal_amount ||
        lead.expected_value ||
        productPrice ||
        "",
    });
    setShowConvertModal(true);
  };

  const openLostConfirm = (lead) => {
    setConfirmModal({
      open: true,
      action: "lost",
      lead,
      loading: false,
    });
  };

  const openDeleteConfirm = (lead) => {
    setConfirmModal({
      open: true,
      action: "delete",
      lead,
      loading: false,
    });
  };

  const closeConfirmModal = () => {
    if (confirmModal.loading) return;

    setConfirmModal({
      open: false,
      action: "",
      lead: null,
      loading: false,
    });
  };

  const buildLeadPayload = (form, status = "new") => {
    const serviceType = normalizeServiceType(form.service_type);
    const selectedProduct = getSelectedProductFromForm(form);
    const selectedProductPrice = getSoftwareProductPrice(selectedProduct);

    const expectedValue = form.expected_value ? Number(form.expected_value) : null;

    return {
      client_name: form.client_name.trim(),
      client_phone: form.client_phone.trim() || null,
      client_email: form.client_email.trim() || null,
      client_company_name: form.client_company_name.trim() || null,
      client_address: form.client_address.trim() || null,
      software_product_id:
        serviceType === "existing_software" && form.software_product_id
          ? Number(form.software_product_id)
          : null,
      service_interest: serviceType,
      service_type: serviceType,
      lead_source: form.lead_source || "website",
      status,
      priority: "medium",
      expected_value:
        expectedValue && !Number.isNaN(expectedValue) && expectedValue > 0
          ? expectedValue
          : serviceType === "existing_software" && selectedProductPrice > 0
            ? selectedProductPrice
            : null,
      proposal_amount:
        serviceType === "existing_software" && selectedProductPrice > 0
          ? selectedProductPrice
          : null,
      recurring_amount:
        serviceType === "existing_software" && selectedProduct?.recurring_amount
          ? Number(selectedProduct.recurring_amount)
          : null,
      recurring_cycle:
        serviceType === "existing_software" && selectedProduct?.recurring_cycle
          ? selectedProduct.recurring_cycle
          : null,
      follow_up_date: form.follow_up_date || null,
      notes: form.notes.trim() || null,
    };
  };

  const handleCreateLead = async (event) => {
    event.preventDefault();

    if (!canUseCRM) {
      showNotification("error", "You do not have permission to create CRM leads");
      return;
    }

    if (!leadForm.client_name.trim()) {
      showNotification("error", "Client name is required");
      return;
    }

    try {
      setSaving(true);

      const payload = buildLeadPayload(leadForm, "new");

      await api.post("/sales/leads", payload);

      closeLeadModal();
      setActiveTab("ongoing");
      await fetchAll();

      showNotification("success", "Lead created successfully");
    } catch (error) {
      showNotification("error", getErrorMessage(error, "Failed to create lead"));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLead = async (event) => {
    event.preventDefault();

    if (!selectedLead) return;

    if (!editForm.client_name.trim()) {
      showNotification("error", "Client name is required");
      return;
    }

    try {
      setSaving(true);

      const payload = buildLeadPayload(
        editForm,
        normalizeStatus(selectedLead.status)
      );

      await api.put(`/sales/leads/${selectedLead.id}`, payload);

      closeEditModal();
      await fetchAll();

      showNotification("success", "Lead updated successfully");
    } catch (error) {
      showNotification("error", getErrorMessage(error, "Failed to update lead"));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitConvertLead = async (event) => {
    event.preventDefault();

    if (!selectedLead) return;

    const serviceType = normalizeServiceType(
      selectedLead.service_type || selectedLead.service_interest
    );

    const isExistingSoftware = serviceType === "existing_software";

    const softwareProductId =
      convertForm.software_product_id || selectedLead.software_product_id || "";

    if (isExistingSoftware && !softwareProductId) {
      showNotification("error", "Select software before converting this lead");
      return;
    }

    const selectedProduct = softwareProductId
      ? softwareProductMap.get(Number(softwareProductId))
      : null;

    const productPrice = getSoftwareProductPrice(selectedProduct);

    let amount = convertForm.final_sale_amount
      ? Number(convertForm.final_sale_amount)
      : 0;

    if ((!amount || Number.isNaN(amount) || amount <= 0) && isExistingSoftware) {
      amount = productPrice;
    }

    const commission = convertForm.commission_percentage
      ? Number(convertForm.commission_percentage)
      : 0;

    if (!amount || Number.isNaN(amount) || amount <= 0) {
      showNotification("error", "Final sale amount is required");
      return;
    }

    if (Number.isNaN(commission) || commission < 0) {
      showNotification("error", "Enter a valid commission percentage");
      return;
    }

    try {
      setSaving(true);

      await api.post(`/sales/leads/${selectedLead.id}/convert`, {
        software_product_id: softwareProductId ? Number(softwareProductId) : null,
        final_sale_amount: amount,
        commission_percentage: commission,
        remarks: convertForm.remarks?.trim() || "Converted from Sales CRM",
      });

      closeConvertModal();
      setActiveTab("converted");
      await fetchAll();

      showNotification("success", "Lead converted successfully");
    } catch (error) {
      showNotification("error", getErrorMessage(error, "Failed to convert lead"));
    } finally {
      setSaving(false);
    }
  };

  const handleLeadProgressUpdate = async (leadId, status, successMessage = "") => {
    try {
      await api.put(`/sales/leads/${leadId}/status`, {
        status,
      });

      await fetchAll();

      if (successMessage) {
        showNotification("success", successMessage);
      }

      return true;
    } catch (firstError) {
      try {
        await api.put(`/sales/leads/${leadId}`, {
          status,
        });

        await fetchAll();

        if (successMessage) {
          showNotification("success", successMessage);
        }

        return true;
      } catch (error) {
        showNotification(
          "error",
          getErrorMessage(error, "Failed to update lead status")
        );

        return false;
      }
    }
  };

  const handleDeliverLead = async (leadId) => {
    try {
      await api.post(`/sales/leads/${leadId}/deliver`, {
        delivery_notes: "Marked delivered from Sales CRM",
      });

      setActiveTab("delivered");
      await fetchAll();

      showNotification("success", "Lead marked as delivered");
    } catch (error) {
      showNotification("error", getErrorMessage(error, "Failed to mark delivered"));
    }
  };

  const handleCompleteLead = async (leadId) => {
    try {
      await api.post(`/sales/leads/${leadId}/complete`, {
        completion_notes: "Marked completed from Sales CRM",
      });

      setActiveTab("completed");
      await fetchAll();

      showNotification("success", "Lead marked as completed");
    } catch (error) {
      showNotification("error", getErrorMessage(error, "Failed to complete lead"));
    }
  };

  const handleWorkflowStatusChange = async (lead, nextStatus) => {
    const currentStatus = normalizeStatus(lead.status);
    const next = normalizeStatus(nextStatus);

    if (currentStatus === next) return;

    if (LEAD_PROGRESS_STATUSES.includes(next)) {
      await handleLeadProgressUpdate(
        lead.id,
        next,
        `Lead status updated to ${formatLabel(next)}`
      );
      setActiveTab("ongoing");
      return;
    }

    if (next === "converted") {
      openConvertModal(lead);
      return;
    }

    if (next === "delivered") {
      if (currentStatus !== "converted") {
        showNotification("error", "First convert the lead, then mark it delivered");
        return;
      }

      await handleDeliverLead(lead.id);
      return;
    }

    if (next === "completed") {
      if (currentStatus !== "delivered") {
        showNotification("error", "First mark the lead delivered, then complete it");
        return;
      }

      await handleCompleteLead(lead.id);
      return;
    }

    if (next === "lost") {
      openLostConfirm(lead);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmModal.lead || !confirmModal.action) return;

    try {
      setConfirmModal((prev) => ({
        ...prev,
        loading: true,
      }));

      if (confirmModal.action === "lost") {
        const updated = await handleLeadProgressUpdate(
          confirmModal.lead.id,
          "lost",
          "Lead marked as lost"
        );

        if (updated) {
          setActiveTab("lost");
        }
      }

      if (confirmModal.action === "delete") {
        await api.delete(`/sales/leads/${confirmModal.lead.id}`);
        await fetchAll();
        showNotification("success", "Lead deleted successfully");
      }

      setConfirmModal({
        open: false,
        action: "",
        lead: null,
        loading: false,
      });
    } catch (error) {
      setConfirmModal((prev) => ({
        ...prev,
        loading: false,
      }));

      showNotification(
        "error",
        getErrorMessage(
          error,
          confirmModal.action === "delete"
            ? "Failed to delete lead"
            : "Failed to update lead"
        )
      );
    }
  };

  const renderLeadRow = (lead) => {
    const status = normalizeStatus(lead.status);
    const serviceType = normalizeServiceType(lead.service_type || lead.service_interest);
    const softwareName = getSoftwareProductName(lead.software_product_id);

    return (
      <article className="lead-list-row" key={lead.id}>
        <div className="lead-main-cell">
          <div className="lead-avatar">
            {(lead.client_name || "L").charAt(0).toUpperCase()}
          </div>

          <div className="lead-title-wrap">
            <h3>{lead.client_name}</h3>
            <p>{lead.client_company_name || "No business name"}</p>

            <div className="lead-meta-line">
              <span>
                <UserRound size={13} />
                {getUserName(lead.sales_rep_user_id)}
              </span>
            </div>
          </div>
        </div>

        <div className="lead-contact-cell">
          <span>
            <Phone size={13} />
            {lead.client_phone || "-"}
          </span>

          <span>
            <Mail size={13} />
            {lead.client_email || "-"}
          </span>
        </div>

        <div className="lead-detail-cell">
          <span className="cell-label">Software Type</span>
          <strong>{softwareName || formatLabel(serviceType)}</strong>
          <small>
            {softwareName ? `${formatLabel(serviceType)} • ` : ""}
            {formatLabel(lead.lead_source || "No Source")}
            {lead.expected_value
              ? ` • Expected: ${formatCurrency(lead.expected_value)}`
              : ""}
          </small>
        </div>

        <div className="lead-detail-cell address-cell">
          <span className="cell-label">Address</span>
          <strong>{lead.client_address || "-"}</strong>
          <small>Follow-up: {lead.follow_up_date || "-"}</small>
        </div>

        <div className="lead-status-cell">
          <span className={`status-pill status-${status}`}>
            {formatLabel(status)}
          </span>

          <select
            value={status}
            onChange={(event) =>
              handleWorkflowStatusChange(lead, event.target.value)
            }
          >
            {WORKFLOW_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {formatLabel(option)}
              </option>
            ))}
          </select>
        </div>

        <div className="lead-action-cell">
          <button
            type="button"
            className="view-button"
            onClick={() => openViewModal(lead)}
          >
            <Eye size={15} />
            View
          </button>

          <button
            type="button"
            className="edit-button"
            onClick={() => openEditModal(lead)}
          >
            <PencilLine size={15} />
            Edit
          </button>

          {isAdminUser && (
            <button
              type="button"
              className="icon-danger-button"
              onClick={() => openDeleteConfirm(lead)}
              title="Delete lead"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </article>
    );
  };

  const renderSoftwareProductField = (form, onChange) => {
    const serviceType = normalizeServiceType(form.service_type);

    if (serviceType !== "existing_software") return null;

    const selectedProduct = getSelectedProductFromForm(form);
    const selectedPrice = getSoftwareProductPrice(selectedProduct);

    return (
      <div className="form-group">
        <label>Select Software</label>
        <select
          name="software_product_id"
          value={form.software_product_id || ""}
          onChange={onChange}
        >
          <option value="">Select existing software</option>
          {activeSoftwareProducts.map((product) => (
            <option key={product.id} value={product.id}>
              {product.software_name} - {formatCurrency(getSoftwareProductPrice(product))}
            </option>
          ))}
        </select>

        {activeSoftwareProducts.length === 0 ? (
          <small className="field-help error-help">
            No software product found. First complete a project and add it as software product.
          </small>
        ) : selectedProduct ? (
          <small className="field-help">
            Price: {formatCurrency(selectedPrice)}
            {selectedProduct.recurring_amount
              ? ` • Recurring: ${formatCurrency(selectedProduct.recurring_amount)} / ${formatLabel(selectedProduct.recurring_cycle)}`
              : ""}
          </small>
        ) : (
          <small className="field-help">
            Select product to auto-fill amount.
          </small>
        )}
      </div>
    );
  };

  const renderLeadFormFields = (form, onChange) => {
    const serviceType = normalizeServiceType(form.service_type);

    return (
      <div className="form-content-grid compact-form-grid">
        <div className="form-group">
          <label>Client Name</label>
          <input
            name="client_name"
            value={form.client_name}
            onChange={onChange}
            placeholder="Client name"
            required
          />
        </div>

        <div className="form-group">
          <label>Business Name</label>
          <input
            name="client_company_name"
            value={form.client_company_name}
            onChange={onChange}
            placeholder="Business / company name"
          />
        </div>

        <div className="form-group">
          <label>Phone Number</label>
          <input
            name="client_phone"
            value={form.client_phone}
            onChange={onChange}
            placeholder="Phone number"
          />
        </div>

        <div className="form-group">
          <label>Email</label>
          <input
            name="client_email"
            type="email"
            value={form.client_email}
            onChange={onChange}
            placeholder="Email address"
          />
        </div>

        <div className="form-group">
          <label>Software Type</label>
          <select
            name="service_type"
            value={form.service_type}
            onChange={onChange}
          >
            {SERVICE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {renderSoftwareProductField(form, onChange)}

        <div className="form-group">
          <label>Source</label>
          <select
            name="lead_source"
            value={form.lead_source}
            onChange={onChange}
          >
            {LEAD_SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>
            {serviceType === "existing_software"
              ? "Expected Amount Auto-filled"
              : "Expected Amount Optional"}
          </label>
          <input
            name="expected_value"
            type="number"
            min="0"
            value={form.expected_value}
            onChange={onChange}
            placeholder={
              serviceType === "existing_software"
                ? "Auto-filled from software"
                : "Example: 50000"
            }
          />
        </div>

        <div className="form-group">
          <label>Follow-up Date</label>
          <input
            name="follow_up_date"
            type="date"
            value={form.follow_up_date}
            onChange={onChange}
          />
        </div>

        <div className="form-group full-span">
          <label>Address</label>
          <input
            name="client_address"
            value={form.client_address}
            onChange={onChange}
            placeholder="Client / business address"
          />
        </div>

        <div className="form-group full-span">
          <label>Notes</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={onChange}
            placeholder="Lead notes"
          />
        </div>
      </div>
    );
  };

  if (!canUseCRM) {
    return (
      <>
        <style>{salesPageStyles}</style>

        <div className="sales-page">
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
                <Target size={22} />
              </div>

              <div>
                <h1>Sales Access Required</h1>
                <p>You do not have access to Sales portal.</p>
              </div>
            </div>
          </div>

          <div className="empty-state-card">
            <Target size={32} />
            <h3>No Sales Access</h3>
            <p>Please contact Company Admin to enable Sales portal access.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{salesPageStyles}</style>

      <div className="sales-page">
        <div className="page-header">
          <div className="page-title-wrap">
            <button
              type="button"
              className="back-button"
              onClick={() => (activeTab ? backToModules() : navigate(-1))}
            >
              <ArrowLeft size={18} />
            </button>

            <div className="page-title-icon">
              <Target size={22} />
            </div>

            <div>
              <h1>{activeModule ? activeModule.title : "CRM & Sales"}</h1>
              <p>
                {activeModule
                  ? activeModule.description
                  : isAdminUser
                    ? "Admin can manage all sales leads, delivery, and completed records."
                    : "Create leads and continuously update only your own CRM records."}
              </p>
            </div>
          </div>

          <div className="header-actions">
            <span className="count-pill">
              {loading
                ? "Loading..."
                : activeModule
                  ? `${filteredLeads.length} Records`
                  : `${leads.length} Leads`}
            </span>

            <button
              type="button"
              className="create-lead-button"
              onClick={() => setShowLeadModal(true)}
            >
              <Plus size={17} />
              Create Lead
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
              onClick={() => setNotification({ type: "", message: "" })}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {!activeTab && (
          <section className="pipeline-card">
            <div className="section-title-row">
              <div>
                <h2>Sales Pipeline</h2>
                <p>
                  {isAdminUser
                    ? "Click any module to open full company lead list."
                    : "Click any module to open your own lead list."}
                </p>
              </div>

              <span>{pipelineModules.length} modules</span>
            </div>

            <div className="pipeline-module-grid">
              {pipelineModules.map((module) => {
                const Icon = module.icon;

                return (
                  <button
                    key={module.key}
                    type="button"
                    className={`pipeline-module tone-${module.tone}`}
                    onClick={() => openPipelineModule(module.key)}
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

        {activeTab && (
          <>
            <section className="module-toolbar-card">
              <button type="button" className="back-to-modules" onClick={backToModules}>
                <ArrowLeft size={16} />
                Back to CRM Modules
              </button>

              <div className="search-box">
                <Search size={18} />
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search client, phone, email, business, address, software type, source..."
                />
              </div>

              <div className="toolbar-filters">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="">All Status</option>
                  {availableStatusFilters.map((option) => (
                    <option key={option} value={option}>
                      {formatLabel(option)}
                    </option>
                  ))}
                </select>

                <select
                  value={serviceFilter}
                  onChange={(event) => setServiceFilter(event.target.value)}
                >
                  <option value="">All Software Types</option>
                  {SERVICE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value)}
                >
                  <option value="">All Sources</option>
                  {LEAD_SOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
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

            <div className="crm-list-card">
              <div className="list-header">
                <div>
                  <h2>{activeModule?.title}</h2>
                  <p>
                    {loading
                      ? "Loading CRM data..."
                      : `Showing ${pageStart}-${pageEnd} of ${filteredLeads.length} records`}
                  </p>
                </div>
              </div>

              <div className="lead-table-head">
                <span>Client</span>
                <span>Contact</span>
                <span>Software</span>
                <span>Address / Follow-up</span>
                <span>Status</span>
                <span>Actions</span>
              </div>

              {filteredLeads.length === 0 ? (
                <div className="empty-state-card">
                  <Target size={32} />
                  <h3>No records found</h3>
                  <p>Create a lead or change filters to see CRM records.</p>
                </div>
              ) : (
                <>
                  <div className="lead-list">
                    {paginatedLeads.map((lead) => renderLeadRow(lead))}
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
                </>
              )}
            </div>
          </>
        )}

        {showLeadModal && (
          <div
            className="crm-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeLeadModal();
            }}
          >
            <form className="crm-modal-card compact-modal" onSubmit={handleCreateLead}>
              <div className="modal-header">
                <div className="card-title-row">
                  <div className="card-title-icon">
                    <PlusCircle size={19} />
                  </div>

                  <div>
                    <h2>Create CRM Lead</h2>
                    <p>
                      For existing software, select software product and amount will auto-fill.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="modal-close-button"
                  onClick={closeLeadModal}
                >
                  <X size={18} />
                </button>
              </div>

              {renderLeadFormFields(leadForm, updateLeadField)}

              <div className="form-actions-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeLeadModal}
                >
                  Cancel
                </button>

                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? "Creating..." : "Create Lead"}
                </button>
              </div>
            </form>
          </div>
        )}

        {showEditModal && selectedLead && (
          <div
            className="crm-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeEditModal();
            }}
          >
            <form className="crm-modal-card compact-modal" onSubmit={handleUpdateLead}>
              <div className="modal-header">
                <div className="card-title-row">
                  <div className="card-title-icon">
                    <PencilLine size={19} />
                  </div>

                  <div>
                    <h2>Edit Lead</h2>
                    <p>Update client, software product, expected amount, follow-up, and notes.</p>
                  </div>
                </div>

                <button
                  type="button"
                  className="modal-close-button"
                  onClick={closeEditModal}
                >
                  <X size={18} />
                </button>
              </div>

              {renderLeadFormFields(editForm, updateEditField)}

              <div className="form-actions-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeEditModal}
                >
                  Cancel
                </button>

                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        )}

        {showConvertModal && selectedLead && (
          <div
            className="crm-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeConvertModal();
            }}
          >
            <form className="crm-modal-card convert-modal" onSubmit={handleSubmitConvertLead}>
              <div className="modal-header">
                <div className="card-title-row">
                  <div className="card-title-icon convert-icon">
                    <IndianRupee size={19} />
                  </div>

                  <div>
                    <h2>Convert Lead</h2>
                    <p>
                      {normalizeServiceType(selectedLead.service_type || selectedLead.service_interest) === "existing_software"
                        ? "Select software product. Sale amount will auto-fill from software price."
                        : "Enter final sale amount before moving this lead to Converted Sales."}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="modal-close-button"
                  onClick={closeConvertModal}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="convert-summary-card">
                <div>
                  <span>Client</span>
                  <strong>{selectedLead.client_name}</strong>
                </div>

                <div>
                  <span>Business</span>
                  <strong>{selectedLead.client_company_name || "-"}</strong>
                </div>

                <div>
                  <span>Expected Amount</span>
                  <strong>{formatCurrency(selectedLead.expected_value || 0)}</strong>
                </div>
              </div>

              <div className="form-content-grid compact-form-grid">
                {normalizeServiceType(selectedLead.service_type || selectedLead.service_interest) === "existing_software" && (
                  <div className="form-group full-span">
                    <label>Select Software *</label>
                    <select
                      name="software_product_id"
                      value={convertForm.software_product_id || ""}
                      onChange={updateConvertField}
                      required
                    >
                      <option value="">Select existing software</option>
                      {activeSoftwareProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.software_name} - {formatCurrency(getSoftwareProductPrice(product))}
                        </option>
                      ))}
                    </select>

                    {activeSoftwareProducts.length === 0 ? (
                      <small className="field-help error-help">
                        No software product found. First complete a project and add it as software product.
                      </small>
                    ) : (
                      <small className="field-help">
                        Software amount will be used as default final sale amount.
                      </small>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label>Final Sale Amount *</label>
                  <input
                    name="final_sale_amount"
                    type="number"
                    min="1"
                    value={convertForm.final_sale_amount}
                    onChange={updateConvertField}
                    placeholder="Enter final deal amount"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Commission Percentage</label>
                  <input
                    name="commission_percentage"
                    type="number"
                    min="0"
                    value={convertForm.commission_percentage}
                    onChange={updateConvertField}
                    placeholder="Example: 10"
                  />
                </div>

                <div className="form-group full-span">
                  <label>Conversion Remarks</label>
                  <textarea
                    name="remarks"
                    value={convertForm.remarks}
                    onChange={updateConvertField}
                    placeholder="Remarks"
                  />
                </div>
              </div>

              <div className="form-actions-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeConvertModal}
                >
                  Cancel
                </button>

                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? "Converting..." : "Convert Lead"}
                </button>
              </div>
            </form>
          </div>
        )}

        {showViewModal && selectedLead && (
          <div
            className="crm-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeViewModal();
            }}
          >
            <div className="crm-modal-card compact-modal">
              <div className="modal-header">
                <div className="card-title-row">
                  <div className="card-title-icon">
                    <Eye size={19} />
                  </div>

                  <div>
                    <h2>{selectedLead.client_name}</h2>
                    <p>{selectedLead.client_company_name || "No business name"}</p>
                  </div>
                </div>

                <button
                  type="button"
                  className="modal-close-button"
                  onClick={closeViewModal}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="details-grid">
                <div>
                  <span>Status</span>
                  <strong>{formatLabel(selectedLead.status)}</strong>
                </div>

                <div>
                  <span>Software Type</span>
                  <strong>
                    {formatLabel(
                      selectedLead.service_type || selectedLead.service_interest
                    )}
                  </strong>
                </div>

                <div>
                  <span>Selected Software</span>
                  <strong>{getSoftwareProductName(selectedLead.software_product_id) || "-"}</strong>
                </div>

                <div>
                  <span>Phone</span>
                  <strong>{selectedLead.client_phone || "-"}</strong>
                </div>

                <div>
                  <span>Email</span>
                  <strong>{selectedLead.client_email || "-"}</strong>
                </div>

                <div>
                  <span>Source</span>
                  <strong>{formatLabel(selectedLead.lead_source)}</strong>
                </div>

                <div>
                  <span>Follow-up Date</span>
                  <strong>{selectedLead.follow_up_date || "-"}</strong>
                </div>

                <div>
                  <span>Expected Amount</span>
                  <strong>{formatCurrency(selectedLead.expected_value || 0)}</strong>
                </div>

                <div>
                  <span>Final Sale</span>
                  <strong>{formatCurrency(selectedLead.final_sale_amount || 0)}</strong>
                </div>

                <div>
                  <span>Assigned / Owner</span>
                  <strong>{getUserName(selectedLead.sales_rep_user_id)}</strong>
                </div>

                <div className="details-full">
                  <span>Address</span>
                  <strong>{selectedLead.client_address || "-"}</strong>
                </div>

                <div className="details-full">
                  <span>Notes</span>
                  <strong>{selectedLead.notes || "-"}</strong>
                </div>
              </div>

              <div className="view-actions-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    closeViewModal();
                    openEditModal(selectedLead);
                  }}
                >
                  Edit Lead
                </button>

                <button type="button" className="primary-button" onClick={closeViewModal}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmModal.open && (
          <div className="crm-modal-backdrop">
            <div className="crm-confirm-card">
              <button
                type="button"
                className="modal-close-button"
                onClick={closeConfirmModal}
                disabled={confirmModal.loading}
              >
                <X size={18} />
              </button>

              <div
                className={
                  confirmModal.action === "delete"
                    ? "confirm-icon danger"
                    : "confirm-icon warning"
                }
              >
                {confirmModal.action === "delete" ? (
                  <Trash2 size={24} />
                ) : (
                  <AlertTriangle size={24} />
                )}
              </div>

              <h2>
                {confirmModal.action === "delete"
                  ? "Delete Lead?"
                  : "Mark Lead as Lost?"}
              </h2>

              <p>
                {confirmModal.action === "delete"
                  ? "This lead will be permanently deleted if it has no commission or project linked."
                  : "This lead will move to Lost Leads."}
              </p>

              <div className="confirm-lead-box">
                <strong>{confirmModal.lead?.client_name || "Lead"}</strong>
                <span>{confirmModal.lead?.client_company_name || "-"}</span>
              </div>

              <div className="confirm-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeConfirmModal}
                  disabled={confirmModal.loading}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className={
                    confirmModal.action === "delete"
                      ? "danger-button"
                      : "warning-button"
                  }
                  onClick={handleConfirmAction}
                  disabled={confirmModal.loading}
                >
                  {confirmModal.loading
                    ? "Processing..."
                    : confirmModal.action === "delete"
                      ? "Delete Lead"
                      : "Mark Lost"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const salesPageStyles = `
.sales-page {
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

.create-lead-button {
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
  background: rgba(255, 255, 255, 0.75);
  color: inherit;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.pipeline-card,
.module-toolbar-card,
.crm-list-card {
  width: 100%;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid var(--erp-border, #e2e8f0);
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

.tone-red .module-icon {
  color: #dc2626;
  background: #fef2f2;
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
  grid-template-columns: auto minmax(260px, 1fr);
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
  padding: 0;
  outline: none;
  font-size: 13px;
  font-family: inherit;
}

.toolbar-filters {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar-filters select,
.lead-status-cell select,
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
  min-width: 165px;
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

.field-help {
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.35;
}

.error-help {
  color: #dc2626;
}

.crm-list-card {
  min-height: 560px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.list-header {
  min-height: 74px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--erp-border-soft, #eef2f7);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
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

.lead-table-head {
  min-height: 44px;
  padding: 0 16px;
  background: #f8fafc;
  border-bottom: 1px solid #eef2f7;
  display: grid;
  grid-template-columns: minmax(230px, 1.25fr) minmax(170px, 0.9fr) minmax(145px, 0.8fr) minmax(180px, 1.05fr) minmax(160px, 0.85fr) minmax(210px, 0.9fr);
  gap: 14px;
  align-items: center;
}

.lead-table-head span {
  color: #64748b;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.lead-list {
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lead-list-row {
  min-height: 112px;
  padding: 14px;
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
  display: grid;
  grid-template-columns: minmax(230px, 1.25fr) minmax(170px, 0.9fr) minmax(145px, 0.8fr) minmax(180px, 1.05fr) minmax(160px, 0.85fr) minmax(210px, 0.9fr);
  gap: 14px;
  align-items: center;
}

.lead-main-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.lead-avatar {
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

.lead-title-wrap {
  min-width: 0;
}

.lead-title-wrap h3 {
  margin: 0;
  color: #06142b;
  font-size: 15px;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lead-title-wrap p {
  margin: 5px 0 0;
  color: #52677e;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lead-meta-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 7px;
}

.lead-meta-line span,
.lead-contact-cell span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #64748b;
  font-size: 11px;
  font-weight: 600;
}

.lead-contact-cell {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.lead-contact-cell span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lead-detail-cell {
  min-width: 0;
}

.cell-label {
  display: block;
  color: #64748b;
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.lead-detail-cell strong {
  display: block;
  margin-top: 5px;
  color: #0f172a;
  font-size: 13px;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lead-detail-cell small {
  display: block;
  margin-top: 5px;
  color: #64748b;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lead-status-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 7px;
  min-width: 0;
}

.status-pill {
  height: 25px;
  padding: 0 10px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #334155;
  border: 1px solid #e2e8f0;
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
  flex-shrink: 0;
}

.status-new,
.status-contacted {
  color: #2563eb;
  background: #eff6ff;
  border-color: #bfdbfe;
}

.status-interested,
.status-proposal-sent,
.status-converted {
  color: #7c3aed;
  background: #f5f3ff;
  border-color: #ddd6fe;
}

.status-delivered,
.status-completed,
.status-paid {
  color: #059669;
  background: #ecfdf5;
  border-color: #bbf7d0;
}

.status-lost,
.status-not-interested,
.status-cancelled {
  color: #dc2626;
  background: #fef2f2;
  border-color: #fecaca;
}

.lead-action-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
}

.view-button,
.edit-button {
  min-height: 38px;
  padding: 0 11px;
  border-radius: 13px;
  border: 1px solid #dbe5f2;
  background: #ffffff;
  color: #0f172a;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.view-button {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #2563eb;
}

.edit-button {
  border-color: #ddd6fe;
  background: #f5f3ff;
  color: #7c3aed;
}

.icon-danger-button {
  width: 38px;
  height: 38px;
  border-radius: 13px;
  display: inline-grid;
  place-items: center;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #dc2626;
  cursor: pointer;
  flex-shrink: 0;
}

.pagination-row {
  min-height: 62px;
  padding: 14px 20px;
  border-top: 1px solid var(--erp-border-soft, #eef2f7);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.pagination-row p {
  color: #52677e;
  font-size: 13px;
  font-weight: 600;
  margin: 0;
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
  font-weight: 800;
  cursor: pointer;
}

.pagination-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
  background: #ffffff;
  border-radius: 20px;
  border: 1px solid var(--erp-border, #e2e8f0);
}

.empty-state-card h3 {
  margin: 0;
  color: #06142b;
  font-size: 18px;
  font-weight: 800;
}

.empty-state-card p {
  max-width: 380px;
  margin: 0;
  color: #52677e;
  font-size: 13px;
  font-weight: 500;
}

.crm-modal-backdrop {
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

.crm-modal-card {
  width: min(1040px, 100%);
  max-height: calc(100vh - 44px);
  overflow-y: auto;
  border-radius: 22px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 30px 80px rgba(15, 23, 42, 0.25);
  padding: 18px;
}

.compact-modal {
  width: min(880px, 100%);
}

.convert-modal {
  width: min(680px, 100%);
}

.crm-confirm-card {
  width: min(440px, 100%);
  position: relative;
  border-radius: 24px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 34px 80px rgba(15, 23, 42, 0.28);
  padding: 28px;
  text-align: center;
}

.confirm-icon {
  width: 58px;
  height: 58px;
  margin: 0 auto 16px;
  border-radius: 20px;
  display: grid;
  place-items: center;
}

.confirm-icon.warning {
  background: #fff7ed;
  color: #ea580c;
  border: 1px solid #fed7aa;
}

.confirm-icon.danger {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.crm-confirm-card h2 {
  margin: 0;
  color: #06142b;
  font-size: 23px;
  font-weight: 900;
}

.crm-confirm-card p {
  margin: 10px auto 18px;
  max-width: 360px;
  color: #52677e;
  font-size: 13px;
  line-height: 1.55;
  font-weight: 600;
}

.confirm-lead-box {
  min-height: 62px;
  padding: 12px;
  border-radius: 18px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: left;
}

.confirm-lead-box strong {
  color: #06142b;
  font-size: 14px;
  font-weight: 900;
}

.confirm-lead-box span {
  margin-top: 4px;
  color: #52677e;
  font-size: 12px;
  font-weight: 600;
}

.confirm-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 20px;
}

.warning-button,
.danger-button {
  min-width: 135px;
  height: 42px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: none;
  color: #ffffff;
}

.warning-button {
  background: #ea580c;
}

.danger-button {
  background: #dc2626;
}

.warning-button:disabled,
.danger-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--erp-border-soft, #eef2f7);
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

.convert-icon {
  color: #ea580c;
  background: #fff7ed;
  border-color: #fed7aa;
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
  flex-shrink: 0;
  cursor: pointer;
}

.form-content-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 13px;
}

.compact-form-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
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

.form-group textarea {
  min-height: 92px;
  resize: vertical;
}

.full-span {
  grid-column: span 2;
}

.convert-summary-card {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 15px;
}

.convert-summary-card div {
  min-height: 72px;
  padding: 13px;
  border-radius: 15px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
}

.convert-summary-card span {
  display: block;
  color: #64748b;
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.convert-summary-card strong {
  display: block;
  margin-top: 7px;
  color: #0f172a;
  font-size: 13px;
  font-weight: 900;
  word-break: break-word;
}

.form-actions-row,
.view-actions-row {
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

.details-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 13px;
}

.details-grid div {
  padding: 13px;
  border-radius: 15px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
}

.details-grid span {
  display: block;
  color: #64748b;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.details-grid strong {
  display: block;
  margin-top: 7px;
  color: #0f172a;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.45;
  word-break: break-word;
}

.details-full {
  grid-column: span 2;
}

@media (max-width: 1600px) {
  .lead-table-head,
  .lead-list-row {
    grid-template-columns: 1.3fr 1fr 1fr;
  }

  .lead-action-cell {
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

  .lead-table-head {
    display: none;
  }
}

@media (max-width: 980px) {
  .lead-list-row {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .lead-action-cell {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .details-grid,
  .convert-summary-card {
    grid-template-columns: 1fr;
  }

  .details-full {
    grid-column: span 1;
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
  .create-lead-button {
    width: 100%;
    justify-content: center;
  }

  .pipeline-module-grid,
  .form-content-grid,
  .compact-form-grid {
    grid-template-columns: 1fr;
  }

  .toolbar-filters {
    flex-direction: column;
    width: 100%;
  }

  .toolbar-filters select,
  .clear-filter-button,
  .back-to-modules {
    width: 100%;
    justify-content: center;
  }

  .view-button,
  .edit-button,
  .icon-danger-button {
    width: 100%;
    justify-content: center;
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

  .full-span {
    grid-column: span 1;
  }

  .crm-modal-backdrop {
    align-items: flex-start;
    padding: 14px;
  }

  .crm-modal-card {
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

  .module-toolbar-card,
  .pipeline-card {
    padding: 15px;
  }

  .list-header {
    padding: 16px;
  }

  .lead-list {
    padding: 12px;
  }

  .crm-modal-card,
  .crm-confirm-card {
    padding: 15px;
  }
}
`;