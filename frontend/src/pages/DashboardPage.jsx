import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarCheck,
  ClipboardList,
  Clock3,
  IndianRupee,
  LayoutDashboard,
  PackageCheck,
  Percent,
  Settings,
  Target,
  UserCheck,
  Users,
  UsersRound,
  WalletCards,
  Wrench,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import api from "../api/api";
import { useAuth } from "../context/AuthContext";

const FULL_ACCESS_ROLES = ["super-admin", "company-admin", "admin", "owner"];

const ALL_PORTALS = [
  "dashboard",
  "people-onboarding",
  "users",
  "attendance",
  "tasks",
  "sales",
  "software-products",
  "receive-payment",
  "sales-commission",
  "projects",
  "maintenance",
  "reports",
  "settings",
];

const DEFAULT_PORTAL_ACCESS_BY_ROLE = {
  "super-admin": ALL_PORTALS,
  "company-admin": ALL_PORTALS,
  admin: ALL_PORTALS,
  owner: ALL_PORTALS,
  hr: [
    "people-onboarding",
    "users",
    "attendance",
    "tasks",
    "reports",
    "settings",
  ],
  manager: [
    "people-onboarding",
    "users",
    "attendance",
    "tasks",
    "sales",
    "software-products",
    "receive-payment",
    "sales-commission",
    "projects",
    "maintenance",
    "reports",
    "settings",
  ],
  accountant: ["attendance", "tasks", "reports", "settings"],
  employee: ["attendance", "tasks", "settings"],
  intern: ["attendance", "tasks", "settings"],
  "sales-representative": [
    "attendance",
    "tasks",
    "sales",
    "software-products",
    "receive-payment",
    "sales-commission",
    "maintenance",
    "settings",
  ],
  freelancer: ["attendance", "tasks", "settings"],
};

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

function parsePortalAccess(value, role) {
  const normalizedRole = normalizeRole(role);

  if (FULL_ACCESS_ROLES.includes(normalizedRole)) {
    return ALL_PORTALS;
  }

  if (Array.isArray(value)) {
    return value
      .map(normalizePortal)
      .filter((item) => ALL_PORTALS.includes(item));
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed
          .map(normalizePortal)
          .filter((item) => ALL_PORTALS.includes(item));
      }
    } catch {
      return DEFAULT_PORTAL_ACCESS_BY_ROLE[normalizedRole] || [
        "attendance",
        "tasks",
        "settings",
      ];
    }
  }

  return DEFAULT_PORTAL_ACCESS_BY_ROLE[normalizedRole] || [
    "attendance",
    "tasks",
    "settings",
  ];
}

function canAccessPortal(user, portalKey) {
  const normalizedRole = normalizeRole(user?.role);
  const normalizedPortal = normalizePortal(portalKey);

  if (!normalizedPortal) return false;

  if (normalizedPortal === "dashboard") {
    return true;
  }

  if (FULL_ACCESS_ROLES.includes(normalizedRole)) {
    return true;
  }

  const portalAccess = parsePortalAccess(user?.portal_access, user?.role);

  if (
    normalizedPortal === "receive-payment" ||
    normalizedPortal === "maintenance" ||
    normalizedPortal === "software-products" ||
    normalizedPortal === "sales-commission"
  ) {
    return (
      portalAccess.includes("sales") ||
      portalAccess.includes(normalizedPortal)
    );
  }

  return portalAccess.includes(normalizedPortal);
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [summary, setSummary] = useState({});
  const [crmSummary, setCrmSummary] = useState({});
  const [paymentSummary, setPaymentSummary] = useState({});
  const [now, setNow] = useState(new Date());

  const userRole = normalizeRole(user?.role);
  const isAdminUser = FULL_ACCESS_ROLES.includes(userRole);

  const displayName =
    user?.full_name ||
    user?.name ||
    user?.username ||
    user?.email ||
    "User";

  const canUseSales = canAccessPortal(user, "sales");

  useEffect(() => {
    let isMounted = true;

    const loadDashboardSummary = async () => {
      try {
        const response = await api.get("/dashboard/summary");
        const payload =
          response?.data?.data || response?.data?.summary || response?.data || {};

        if (isMounted) {
          setSummary(payload);
        }
      } catch (error) {
        console.warn("Dashboard summary API not loaded:", error);
      }
    };

    loadDashboardSummary();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!canUseSales) return;

    let isMounted = true;

    const loadSalesDashboardData = async () => {
      try {
        const [crmResult, paymentResult] = await Promise.allSettled([
          api.get("/sales/summary"),
          api.get("/sales/payments/summary"),
        ]);

        if (!isMounted) return;

        if (crmResult.status === "fulfilled") {
          setCrmSummary(crmResult.value?.data || {});
        }

        if (paymentResult.status === "fulfilled") {
          setPaymentSummary(paymentResult.value?.data || {});
        }
      } catch (error) {
        console.warn("Sales dashboard data not loaded:", error);
      }
    };

    loadSalesDashboardData();

    return () => {
      isMounted = false;
    };
  }, [canUseSales]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getValue = (keys, fallback = 0) => {
    for (const key of keys) {
      if (summary?.[key] !== undefined && summary?.[key] !== null) {
        return summary[key];
      }
    }

    return fallback;
  };

  const getCrmValue = (keys, fallback = 0) => {
    for (const key of keys) {
      if (crmSummary?.[key] !== undefined && crmSummary?.[key] !== null) {
        return crmSummary[key];
      }
    }

    return fallback;
  };

  const getPaymentValue = (keys, fallback = 0) => {
    for (const key of keys) {
      if (paymentSummary?.[key] !== undefined && paymentSummary?.[key] !== null) {
        return paymentSummary[key];
      }
    }

    return fallback;
  };

  const formatNumber = (value) => {
    const number = Number(value || 0);
    return number.toLocaleString("en-IN");
  };

  const formatCurrency = (value) => {
    const amount = Number(value || 0);

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const dateText = useMemo(() => {
    return now.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, [now]);

  const timeText = useMemo(() => {
    return now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }, [now]);

  const allOverviewCards = [
    {
      key: "tasks",
      title: "Tasks Pending",
      value: formatNumber(
        getValue(["tasks_pending", "pending_tasks", "pendingTasks"], 0)
      ),
      subtitle: `In progress: ${formatNumber(
        getValue(["tasks_in_progress", "in_progress_tasks", "inProgressTasks"], 0)
      )}`,
      icon: ClipboardList,
      colorClass: "overview-purple",
    },
    {
      key: "sales",
      title: "Final Sales",
      value: formatCurrency(
        getValue(
          ["final_sales", "total_final_sales", "sales_amount"],
          getCrmValue(["final_sales"], 0)
        )
      ),
      subtitle: `Converted: ${formatNumber(
        getValue(
          ["converted_sales", "sales_converted", "convertedSales"],
          getCrmValue(["converted_leads"], 0)
        )
      )}`,
      icon: Target,
      colorClass: "overview-orange",
    },
    {
      key: "receive-payment",
      title: "Received Payment",
      value: formatCurrency(
        getPaymentValue(["total_received"], getValue(["total_received"], 0))
      ),
      subtitle: `Due: ${formatCurrency(
        getPaymentValue(
          ["total_pending_due_from_leads"],
          getValue(["total_pending_due_from_leads", "pending_due"], 0)
        )
      )}`,
      icon: IndianRupee,
      colorClass: "overview-emerald",
    },
    {
      key: "projects",
      title: "Projects Running",
      value: formatNumber(
        getValue(
          ["projects_running", "running_projects", "active_projects"],
          getCrmValue(["ongoing_projects"], 0)
        )
      ),
      subtitle: `Completed: ${formatNumber(
        getValue(
          ["completed_projects", "projects_completed"],
          getCrmValue(["completed_projects"], 0)
        )
      )}`,
      icon: BriefcaseBusiness,
      colorClass: "overview-green",
    },
    {
      key: "attendance",
      title: "Team Overview",
      value: formatNumber(
        getValue(["team_overview", "team_members", "total_users", "users_count"], 0)
      ),
      subtitle: `Present today: ${formatNumber(
        getValue(["present_today", "today_present", "presentToday"], 0)
      )}`,
      icon: Users,
      colorClass: "overview-blue",
    },
  ];

  const allDashboardModules = [
    {
      key: "people-onboarding",
      title: "People Onboarding",
      path: "/people-onboarding",
      icon: UsersRound,
      colorClass: "module-blue",
    },
    {
      key: "users",
      title: "Software Users",
      path: "/users",
      icon: UserCheck,
      colorClass: "module-cyan",
    },
    {
      key: "attendance",
      title: "Attendance",
      path: "/attendance",
      icon: CalendarCheck,
      colorClass: "module-green",
    },
    {
      key: "tasks",
      title: "Tasks",
      path: "/tasks",
      icon: ClipboardList,
      colorClass: "module-purple",
    },
    {
      key: "sales",
      title: "Sales",
      path: "/sales",
      icon: Target,
      colorClass: "module-orange",
    },
    {
      key: "software-products",
      title: "Software Products",
      path: "/software-products",
      icon: PackageCheck,
      colorClass: "module-cyan",
    },
    {
      key: "receive-payment",
      title: "Receive Payment",
      path: "/receive-payment",
      icon: WalletCards,
      colorClass: "module-money",
    },
    {
      key: "sales-commission",
      title: "Sales Commission",
      path: "/sales-commission",
      icon: Percent,
      colorClass: "module-violet",
    },
    {
      key: "projects",
      title: "Projects",
      path: "/projects",
      icon: BriefcaseBusiness,
      colorClass: "module-teal",
    },
    {
      key: "maintenance",
      title: "Maintenance",
      path: "/maintenance",
      icon: Wrench,
      colorClass: "module-maintenance",
    },
    {
      key: "reports",
      title: "Reports",
      path: "/reports",
      icon: BarChart3,
      colorClass: "module-indigo",
    },
    {
      key: "settings",
      title: "Settings",
      path: "/settings",
      icon: Settings,
      colorClass: "module-violet",
    },
  ];

  const dashboardModules = useMemo(() => {
    return allDashboardModules.filter((module) =>
      canAccessPortal(user, module.key)
    );
  }, [user]);

  const overviewCards = useMemo(() => {
    const filteredCards = allOverviewCards.filter((card) =>
      canAccessPortal(user, card.key)
    );

    return filteredCards.length > 0 ? filteredCards : [allOverviewCards[0]];
  }, [user, summary, crmSummary, paymentSummary]);

  return (
    <>
      <style>{dashboardStyles}</style>

      <div className="erp-dashboard-page">
        <section className="dashboard-header-card">
          <div className="dashboard-title-wrap">
            <div className="dashboard-title-icon">
              <LayoutDashboard size={22} />
            </div>

            <div>
              <h1>Dashboard</h1>
              {!isAdminUser && (
                <p>
                  Your dashboard shows only the modules assigned to your software
                  account.
                </p>
              )}
            </div>
          </div>

          <div className="dashboard-clock-card">
            <Clock3 size={18} />
            <div>
              <span>{dateText}</span>
              <strong>{timeText}</strong>
            </div>
          </div>
        </section>

        <section className="welcome-card">
          <div>
            <p className="welcome-kicker">WELCOME BACK</p>
            <h2>{displayName}</h2>

            {!isAdminUser && (
              <p>
                Here is your workspace for today. Manage your assigned tasks,
                update leads, receive payments, and track company work from one
                place.
              </p>
            )}
          </div>

          <div className="login-card">
            <div className="login-avatar">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <span>Logged in as</span>
              <strong>{displayName}</strong>
            </div>
          </div>
        </section>

        <section className="overview-grid">
          {overviewCards.map((card) => {
            const Icon = card.icon;

            return (
              <article className="overview-card" key={card.title}>
                <div className={`overview-icon ${card.colorClass}`}>
                  <Icon size={18} />
                </div>

                <div>
                  <p>{card.title}</p>
                  <strong>{card.value}</strong>
                  <span>{card.subtitle}</span>
                </div>
              </article>
            );
          })}
        </section>

        <section className="modules-section">
          <div className="modules-section-header">
            <div>
              <h2>{isAdminUser ? "Modules" : "Allowed Modules"}</h2>
              {!isAdminUser && (
                <p>Open any module assigned to your current account.</p>
              )}
            </div>

            <span>
              {dashboardModules.length}{" "}
              {dashboardModules.length === 1 ? "module" : "modules"}
            </span>
          </div>

          {dashboardModules.length === 0 ? (
            <div className="empty-modules-card">
              <Settings size={32} />
              <h3>No modules assigned</h3>
              <p>
                Please contact Company Admin to update your software access.
              </p>
            </div>
          ) : (
            <div className="modules-grid">
              {dashboardModules.map((module) => {
                const Icon = module.icon;

                return (
                  <button
                    type="button"
                    className="module-card"
                    key={module.title}
                    onClick={() => navigate(module.path)}
                  >
                    <div className={`module-icon ${module.colorClass}`}>
                      <Icon size={18} />
                    </div>

                    <div className="module-text">
                      <h3>{module.title}</h3>
                    </div>

                    <ArrowRight className="module-arrow" size={16} />
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

const dashboardStyles = `
.erp-dashboard-page {
  width: 100%;
  min-height: calc(100vh - 58px);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dashboard-header-card {
  min-height: 86px;
  width: 100%;
  padding: 17px 22px;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid var(--erp-border);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.045);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.dashboard-title-wrap {
  display: flex;
  align-items: center;
  gap: 14px;
}

.dashboard-title-icon {
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

.dashboard-header-card h1 {
  margin: 0;
  font-size: 26px;
  line-height: 1.1;
  color: #06142b;
}

.dashboard-header-card p {
  margin: 6px 0 0;
  font-size: 13px;
  color: #334155;
}

.dashboard-clock-card {
  min-width: 205px;
  height: 54px;
  padding: 9px 15px;
  border-radius: 16px;
  border: 1px solid #bfdbfe;
  background: linear-gradient(135deg, #eff6ff, #f8fbff);
  color: #2563eb;
  display: flex;
  align-items: center;
  gap: 11px;
}

.dashboard-clock-card span {
  display: block;
  font-size: 11px;
  color: #2563eb;
}

.dashboard-clock-card strong {
  display: block;
  margin-top: 4px;
  font-size: 17px;
  color: #06142b;
  white-space: nowrap;
}

.welcome-card {
  min-height: 92px;
  width: 100%;
  padding: 19px 22px;
  border-radius: 20px;
  background:
    radial-gradient(circle at right center, rgba(20, 184, 166, 0.14), transparent 28%),
    linear-gradient(135deg, #f8fbff 0%, #eef6ff 58%, #ecfdf5 100%);
  border: 1px solid #dbeafe;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.04);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.welcome-kicker {
  margin: 0 0 5px;
  color: #2563eb;
  font-size: 12px;
  letter-spacing: 0.09em;
}

.welcome-card h2 {
  margin: 0;
  color: #06142b;
  font-size: 26px;
  line-height: 1.1;
  letter-spacing: -0.04em;
}

.welcome-card p {
  margin: 8px 0 0;
  color: #334155;
  font-size: 13px;
}

.login-card {
  min-width: 210px;
  padding: 12px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #dbeafe;
  display: flex;
  align-items: center;
  gap: 12px;
}

.login-avatar {
  width: 44px;
  height: 44px;
  border-radius: 15px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #2563eb, #14b8a6);
  color: #ffffff;
  font-size: 17px;
  flex-shrink: 0;
}

.login-card span {
  display: block;
  font-size: 11px;
  color: #64748b;
}

.login-card strong {
  display: block;
  margin-top: 3px;
  max-width: 130px;
  color: #06142b;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.overview-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}

.overview-card {
  min-height: 72px;
  padding: 13px 16px;
  border-radius: 17px;
  background: #ffffff;
  border: 1px solid var(--erp-border);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.04);
  display: flex;
  align-items: center;
  gap: 13px;
}

.overview-icon {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.overview-purple {
  background: #f1ecff;
  color: #7c3aed;
}

.overview-orange {
  background: #fff3e5;
  color: #ea580c;
}

.overview-green {
  background: #e9fbf2;
  color: #059669;
}

.overview-emerald {
  background: #ecfdf5;
  color: #059669;
}

.overview-blue {
  background: #eef6ff;
  color: #2563eb;
}

.overview-card p {
  margin: 0 0 3px;
  color: #486078;
  font-size: 12px;
}

.overview-card strong {
  display: block;
  color: #06142b;
  font-size: 20px;
  line-height: 1;
  white-space: nowrap;
}

.overview-card div > span {
  display: block;
  margin-top: 6px;
  color: #52677e;
  font-size: 11px;
  white-space: nowrap;
}

.modules-section {
  width: 100%;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid var(--erp-border);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.05);
  overflow: hidden;
}

.modules-section-header {
  min-height: 72px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--erp-border-soft);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.modules-section-header h2 {
  margin: 0;
  color: #06142b;
  font-size: 21px;
}

.modules-section-header p {
  margin: 7px 0 0;
  color: #334155;
  font-size: 13px;
}

.modules-section-header span {
  padding: 7px 12px;
  border-radius: 999px;
  background: #eef6ff;
  color: #2563eb;
  font-size: 12px;
  white-space: nowrap;
}

.modules-grid {
  padding: 15px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 13px;
}

.module-card {
  width: 100%;
  min-height: 78px;
  padding: 14px 13px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid var(--erp-border);
  display: flex;
  align-items: center;
  gap: 11px;
  text-align: left;
  cursor: pointer;
  color: inherit;
  position: relative;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.module-card:hover {
  transform: translateY(-2px);
  border-color: #bfdbfe;
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
}

.module-icon {
  width: 38px;
  height: 38px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.module-blue {
  background: #eef6ff;
  color: #2563eb;
}

.module-cyan {
  background: #ecfeff;
  color: #0891b2;
}

.module-green {
  background: #e9fbf2;
  color: #059669;
}

.module-purple {
  background: #f1ecff;
  color: #7c3aed;
}

.module-orange {
  background: #fff3e5;
  color: #ea580c;
}

.module-money {
  background: #ecfdf5;
  color: #059669;
}

.module-teal {
  background: #f0fdfa;
  color: #0f766e;
}

.module-maintenance {
  background: #fff7ed;
  color: #ea580c;
}

.module-indigo {
  background: #edf2ff;
  color: #4f46e5;
}

.module-violet {
  background: #f1ecff;
  color: #8b5cf6;
}

.module-text {
  min-width: 0;
  padding-right: 18px;
}

.module-text h3 {
  margin: 0;
  color: #06142b;
  font-size: 15px;
  font-weight: 900;
}

.module-arrow {
  position: absolute;
  top: 31px;
  right: 13px;
  color: #94a3b8;
}

.empty-modules-card {
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

.empty-modules-card h3 {
  margin: 0;
  color: #06142b;
  font-size: 18px;
  font-weight: 800;
}

.empty-modules-card p {
  max-width: 420px;
  margin: 0;
  color: #52677e;
  font-size: 13px;
  font-weight: 500;
}

@media (max-width: 1700px) {
  .overview-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

@media (max-width: 1250px) {
  .overview-grid,
  .modules-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .dashboard-header-card,
  .welcome-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .dashboard-clock-card,
  .login-card {
    width: 100%;
    min-width: 0;
  }

  .overview-grid,
  .modules-grid {
    grid-template-columns: 1fr;
  }

  .modules-section-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }
}
`;