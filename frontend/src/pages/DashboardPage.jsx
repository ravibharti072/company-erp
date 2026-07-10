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

const FULL_ACCESS_ROLES = [
  "super-admin",
  "company-admin",
  "admin",
  "owner",
];

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

  accountant: [
    "attendance",
    "tasks",
    "receive-payment",
    "reports",
    "settings",
  ],

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

const MODULE_GROUPS = [
  {
    key: "daily-work",
    title: "Daily Work",
    moduleKeys: [
      "sales",
      "receive-payment",
      "projects",
      "tasks",
    ],
  },
  {
    key: "team-management",
    title: "Team Management",
    moduleKeys: [
      "people-onboarding",
      "users",
      "attendance",
    ],
  },
  {
    key: "business-operations",
    title: "Business Operations",
    moduleKeys: [
      "software-products",
      "sales-commission",
      "maintenance",
    ],
  },
  {
    key: "insights-control",
    title: "Insights & Control",
    moduleKeys: ["reports", "settings"],
  },
];

const DASHBOARD_MODULES = [
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
      return (
        DEFAULT_PORTAL_ACCESS_BY_ROLE[normalizedRole] || [
          "attendance",
          "tasks",
          "settings",
        ]
      );
    }
  }

  return (
    DEFAULT_PORTAL_ACCESS_BY_ROLE[normalizedRole] || [
      "attendance",
      "tasks",
      "settings",
    ]
  );
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

  const portalAccess = parsePortalAccess(
    user?.portal_access,
    user?.role
  );

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
          response?.data?.data ||
          response?.data?.summary ||
          response?.data ||
          {};

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
    if (!canUseSales) return undefined;

    let isMounted = true;

    const loadSalesDashboardData = async () => {
      const [crmResult, paymentResult] =
        await Promise.allSettled([
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
    };

    loadSalesDashboardData();

    return () => {
      isMounted = false;
    };
  }, [canUseSales]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const getValue = (keys, fallback = 0) => {
    for (const key of keys) {
      if (
        summary?.[key] !== undefined &&
        summary?.[key] !== null
      ) {
        return summary[key];
      }
    }

    return fallback;
  };

  const getCrmValue = (keys, fallback = 0) => {
    for (const key of keys) {
      if (
        crmSummary?.[key] !== undefined &&
        crmSummary?.[key] !== null
      ) {
        return crmSummary[key];
      }
    }

    return fallback;
  };

  const getPaymentValue = (keys, fallback = 0) => {
    for (const key of keys) {
      if (
        paymentSummary?.[key] !== undefined &&
        paymentSummary?.[key] !== null
      ) {
        return paymentSummary[key];
      }
    }

    return fallback;
  };

  const formatNumber = (value) => {
    return Number(value || 0).toLocaleString("en-IN");
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
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

  const overviewCards = useMemo(() => {
    const allOverviewCards = [
      {
        key: "tasks",
        title: "Tasks Pending",
        value: formatNumber(
          getValue(
            [
              "tasks_pending",
              "pending_tasks",
              "pendingTasks",
            ],
            0
          )
        ),
        subtitle: `In progress: ${formatNumber(
          getValue(
            [
              "tasks_in_progress",
              "in_progress_tasks",
              "inProgressTasks",
            ],
            0
          )
        )}`,
        icon: ClipboardList,
        colorClass: "overview-purple",
      },
      {
        key: "sales",
        title: "Final Sales",
        value: formatCurrency(
          getValue(
            [
              "final_sales",
              "total_final_sales",
              "sales_amount",
            ],
            getCrmValue(["final_sales"], 0)
          )
        ),
        subtitle: `Converted: ${formatNumber(
          getValue(
            [
              "converted_sales",
              "sales_converted",
              "convertedSales",
            ],
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
          getPaymentValue(
            ["total_received"],
            getValue(["total_received"], 0)
          )
        ),
        subtitle: `Due: ${formatCurrency(
          getPaymentValue(
            ["total_pending_due_from_leads"],
            getValue(
              [
                "total_pending_due_from_leads",
                "pending_due",
              ],
              0
            )
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
            [
              "projects_running",
              "running_projects",
              "active_projects",
            ],
            getCrmValue(["ongoing_projects"], 0)
          )
        ),
        subtitle: `Completed: ${formatNumber(
          getValue(
            [
              "completed_projects",
              "projects_completed",
            ],
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
          getValue(
            [
              "team_overview",
              "team_members",
              "total_users",
              "users_count",
            ],
            0
          )
        ),
        subtitle: `Present today: ${formatNumber(
          getValue(
            [
              "present_today",
              "today_present",
              "presentToday",
            ],
            0
          )
        )}`,
        icon: Users,
        colorClass: "overview-blue",
      },
    ];

    const filteredCards = allOverviewCards.filter((card) =>
      canAccessPortal(user, card.key)
    );

    return filteredCards.length > 0
      ? filteredCards
      : [allOverviewCards[0]];
  }, [user, summary, crmSummary, paymentSummary]);

  const visibleModules = useMemo(() => {
    return DASHBOARD_MODULES.filter((module) =>
      canAccessPortal(user, module.key)
    );
  }, [user]);

  const groupedModules = useMemo(() => {
    const moduleMap = new Map();

    visibleModules.forEach((module) => {
      moduleMap.set(module.key, module);
    });

    return MODULE_GROUPS.map((group) => ({
      ...group,
      modules: group.moduleKeys
        .map((moduleKey) => moduleMap.get(moduleKey))
        .filter(Boolean),
    })).filter((group) => group.modules.length > 0);
  }, [visibleModules]);

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
                  Your dashboard shows only the modules assigned to
                  your account.
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
                <div
                  className={`overview-icon ${card.colorClass}`}
                >
                  <Icon size={18} />
                </div>

                <div className="overview-content">
                  <p>{card.title}</p>
                  <strong>{card.value}</strong>
                  <span>{card.subtitle}</span>
                </div>
              </article>
            );
          })}
        </section>

        <section className="workspace-section">
          <div className="workspace-header">
            <div>
              <span className="workspace-label">
                WORKSPACE
              </span>

              <h2>
                {isAdminUser
                  ? "Company Modules"
                  : "Your Modules"}
              </h2>
            </div>

            <span className="module-count-pill">
              {visibleModules.length}{" "}
              {visibleModules.length === 1
                ? "module"
                : "modules"}
            </span>
          </div>

          {groupedModules.length === 0 ? (
            <div className="empty-modules-card">
              <Settings size={32} />

              <h3>No modules assigned</h3>

              <p>
                Please contact Company Admin to update your software
                access.
              </p>
            </div>
          ) : (
            <div className="module-groups">
              {groupedModules.map((group) => (
                <section
                  className="module-group"
                  key={group.key}
                >
                  <div className="module-group-header">
                    <h3>{group.title}</h3>

                    <span>
                      {group.modules.length}{" "}
                      {group.modules.length === 1
                        ? "module"
                        : "modules"}
                    </span>
                  </div>

                  <div className="group-modules-grid">
                    {group.modules.map((module) => {
                      const Icon = module.icon;

                      return (
                        <button
                          type="button"
                          className="module-card"
                          key={module.key}
                          onClick={() => navigate(module.path)}
                        >
                          <div
                            className={`module-icon ${module.colorClass}`}
                          >
                            <Icon size={18} />
                          </div>

                          <div className="module-text">
                            <h4>{module.title}</h4>
                          </div>

                          <ArrowRight
                            className="module-arrow"
                            size={16}
                          />
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
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
  width: 100%;
  min-height: 86px;
  padding: 17px 22px;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid var(--erp-border, #e2e8f0);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.045);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.dashboard-title-wrap {
  min-width: 0;
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
  color: #06142b;
  font-size: 26px;
  line-height: 1.1;
}

.dashboard-header-card p {
  margin: 6px 0 0;
  color: #334155;
  font-size: 13px;
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
  flex-shrink: 0;
}

.dashboard-clock-card span {
  display: block;
  color: #2563eb;
  font-size: 11px;
}

.dashboard-clock-card strong {
  display: block;
  margin-top: 4px;
  color: #06142b;
  font-size: 17px;
  white-space: nowrap;
}

.welcome-card {
  width: 100%;
  min-height: 92px;
  padding: 19px 22px;
  border-radius: 20px;
  background:
    radial-gradient(
      circle at right center,
      rgba(20, 184, 166, 0.14),
      transparent 28%
    ),
    linear-gradient(
      135deg,
      #f8fbff 0%,
      #eef6ff 58%,
      #ecfdf5 100%
    );
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
  font-weight: 800;
  letter-spacing: 0.09em;
}

.welcome-card h2 {
  margin: 0;
  color: #06142b;
  font-size: 26px;
  line-height: 1.1;
  letter-spacing: -0.04em;
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
  color: #64748b;
  font-size: 11px;
}

.login-card strong {
  display: block;
  max-width: 130px;
  margin-top: 3px;
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
  min-width: 0;
  min-height: 72px;
  padding: 13px 16px;
  border-radius: 17px;
  background: #ffffff;
  border: 1px solid var(--erp-border, #e2e8f0);
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

.overview-green,
.overview-emerald {
  background: #e9fbf2;
  color: #059669;
}

.overview-blue {
  background: #eef6ff;
  color: #2563eb;
}

.overview-content {
  min-width: 0;
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
  overflow: hidden;
  text-overflow: ellipsis;
}

.overview-card span {
  display: block;
  margin-top: 6px;
  color: #52677e;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.workspace-section {
  width: 100%;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid var(--erp-border, #e2e8f0);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.05);
  overflow: hidden;
}

.workspace-header {
  min-height: 72px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--erp-border-soft, #eef2f7);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.workspace-label {
  display: block;
  margin-bottom: 4px;
  color: #2563eb;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.12em;
}

.workspace-header h2 {
  margin: 0;
  color: #06142b;
  font-size: 21px;
}

.module-count-pill {
  min-height: 31px;
  padding: 0 11px;
  border-radius: 999px;
  background: #eef6ff;
  border: 1px solid #dbeafe;
  color: #2563eb;
  font-size: 10px;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.module-groups {
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.module-group {
  padding: 14px;
  border-radius: 17px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.module-group:first-child {
  background: #f4f8ff;
  border-color: #bfdbfe;
}

.module-group-header {
  min-height: 32px;
  margin-bottom: 11px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.module-group-header h3 {
  margin: 0;
  color: #06142b;
  font-size: 17px;
  font-weight: 900;
}

.module-group-header span {
  min-height: 27px;
  padding: 0 9px;
  border-radius: 999px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  color: #64748b;
  font-size: 9px;
  font-weight: 850;
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.group-modules-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 13px;
}

.module-card {
  width: 100%;
  min-width: 0;
  min-height: 78px;
  padding: 14px 13px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid var(--erp-border, #e2e8f0);
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

.module-card:focus-visible {
  outline: 3px solid rgba(37, 99, 235, 0.16);
  outline-offset: 2px;
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
  flex: 1;
  padding-right: 18px;
}

.module-text h4 {
  margin: 0;
  color: #06142b;
  font-size: 15px;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.module-arrow {
  position: absolute;
  top: 31px;
  right: 13px;
  color: #94a3b8;
}

.module-card:hover .module-arrow {
  color: #2563eb;
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
}

.empty-modules-card p {
  max-width: 420px;
  margin: 0;
  color: #52677e;
  font-size: 12px;
}

@media (max-width: 1450px) {
  .overview-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .group-modules-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .dashboard-header-card,
  .welcome-card {
    align-items: stretch;
    flex-direction: column;
  }

  .dashboard-clock-card,
  .login-card {
    width: 100%;
    min-width: 0;
  }

  .overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .workspace-header {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (max-width: 620px) {
  .overview-grid,
  .group-modules-grid {
    grid-template-columns: 1fr;
  }

  .module-group-header {
    align-items: flex-start;
  }

  .dashboard-header-card h1 {
    font-size: 22px;
  }

  .welcome-card h2 {
    font-size: 21px;
  }

  .module-text h4 {
    font-size: 14px;
  }
}
`;