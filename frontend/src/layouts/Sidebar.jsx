import {
  BarChart3,
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  Percent,
  Settings,
  Target,
  User,
  UserCheck,
  UsersRound,
  WalletCards,
  Wrench,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { appInfo } from "../shared/config/appInfo";

const sidebarCss = `
  :root {
    --erp-sidebar-width: 270px;
  }

  .erp-sidebar {
    width: var(--erp-sidebar-width);
    height: 100vh;
    position: fixed;
    left: 0;
    top: 0;
    background:
      radial-gradient(circle at 20% 10%, rgba(37, 99, 235, 0.06), transparent 32%),
      radial-gradient(circle at 80% 90%, rgba(20, 184, 166, 0.07), transparent 34%),
      #ffffff;
    border-right: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    z-index: 9998;
    box-shadow: 8px 0 28px rgba(15, 23, 42, 0.04);
    overflow: hidden;
  }

  .erp-sidebar-header {
    min-height: 96px;
    padding: 20px 18px 16px;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    gap: 12px;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.78);
    backdrop-filter: blur(12px);
  }

  .erp-sidebar-logo-mark {
    width: 52px;
    height: 52px;
    border-radius: 18px;
    background: #ffffff;
    border: 1px solid #bfdbfe;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    overflow: hidden;
    padding: 0;
    box-shadow:
      0 12px 24px rgba(37, 99, 235, 0.14),
      0 0 0 5px rgba(239, 246, 255, 0.95);
  }

  .erp-sidebar-logo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    display: block;
    border-radius: inherit;
    transform: scale(1.04);
  }

  .erp-sidebar-brand-text {
    min-width: 0;
  }

  .erp-sidebar-logo-title {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }

  .erp-sidebar-app-name {
    color: #0f172a;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.03em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .erp-version-badge {
    flex: 0 0 auto;
    border: 1px solid #bfdbfe;
    background: #eff6ff;
    color: #2563eb;
    border-radius: 999px;
    padding: 3px 7px;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    box-shadow: 0 6px 14px rgba(37, 99, 235, 0.10);
  }

  .erp-sidebar-subtitle {
    margin: 5px 0 0;
    color: #64748b;
    font-size: 11px;
    font-weight: 500;
    line-height: 1.2;
  }

  .erp-sidebar-nav {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 14px 12px 16px;
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 transparent;
  }

  .erp-sidebar-nav::-webkit-scrollbar {
    width: 6px;
  }

  .erp-sidebar-nav::-webkit-scrollbar-track {
    background: transparent;
  }

  .erp-sidebar-nav::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 999px;
  }

  .erp-sidebar-section {
    margin-bottom: 18px;
  }

  .erp-sidebar-section-title {
    margin: 0 0 8px;
    padding: 0 8px;
    color: #64748b;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .erp-sidebar-menu {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .erp-sidebar-item {
    width: 100%;
    min-height: 42px;
    border: 1px solid transparent;
    background: transparent;
    color: #0f172a;
    border-radius: 13px;
    padding: 0 11px;
    cursor: pointer;
    display: grid;
    grid-template-columns: 22px minmax(0, 1fr) 16px;
    align-items: center;
    gap: 9px;
    text-align: left;
    font-family: inherit;
    text-decoration: none;
    transition: 0.16s ease;
  }

  .erp-sidebar-item:hover {
    background: #f8fafc;
    border-color: #e2e8f0;
    transform: translateX(2px);
  }

  .erp-sidebar-item.active {
    background: linear-gradient(135deg, #eff6ff 0%, #ecfdf5 100%);
    border-color: #bfdbfe;
    color: #2563eb;
    box-shadow:
      0 10px 22px rgba(37, 99, 235, 0.12),
      inset 0 0 0 1px rgba(255, 255, 255, 0.70);
  }

  .erp-sidebar-icon {
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    color: inherit;
    border-radius: 8px;
  }

  .erp-sidebar-item.active .erp-sidebar-icon {
    background: #ffffff;
    color: #2563eb;
    box-shadow: 0 7px 14px rgba(37, 99, 235, 0.10);
  }

  .erp-sidebar-label {
    font-size: 14px;
    font-weight: 700;
    color: inherit;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .erp-sidebar-arrow {
    color: #94a3b8;
    opacity: 0;
    transform: translateX(-4px);
    transition: 0.16s ease;
  }

  .erp-sidebar-item:hover .erp-sidebar-arrow,
  .erp-sidebar-item.active .erp-sidebar-arrow {
    opacity: 1;
    transform: translateX(0);
  }

  .erp-sidebar-item.active .erp-sidebar-arrow {
    color: #2563eb;
  }

  .erp-sidebar-footer {
    padding: 14px 14px 16px;
    border-top: 1px solid #e2e8f0;
    background: rgba(255, 255, 255, 0.82);
    backdrop-filter: blur(12px);
  }

  .erp-sidebar-user {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 46px;
    padding: 0 10px;
    margin-bottom: 10px;
    border-radius: 15px;
    background: linear-gradient(135deg, #eff6ff 0%, #ecfdf5 100%);
    border: 1px solid #bfdbfe;
    color: #0f172a;
    box-shadow:
      0 12px 24px rgba(37, 99, 235, 0.10),
      0 12px 28px rgba(20, 184, 166, 0.08);
  }

  .erp-sidebar-user-icon {
    width: 30px;
    height: 30px;
    border-radius: 11px;
    background: linear-gradient(135deg, #2563eb, #10b981);
    color: #ffffff;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    box-shadow: 0 8px 18px rgba(37, 99, 235, 0.20);
  }

  .erp-sidebar-user-text {
    min-width: 0;
  }

  .erp-sidebar-user-name {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .erp-sidebar-user-role {
    margin: 2px 0 0;
    font-size: 10px;
    font-weight: 500;
    color: #64748b;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-transform: capitalize;
  }

  .erp-sidebar-logout {
    width: 100%;
    height: 44px;
    border: none;
    background: #ef4444;
    color: #ffffff;
    border-radius: 13px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    box-shadow: 0 12px 22px rgba(239, 68, 68, 0.18);
    transition: 0.16s ease;
  }

  .erp-sidebar-logout:hover {
    background: #dc2626;
    transform: translateY(-1px);
  }

  @media (max-width: 900px) {
    .erp-sidebar {
      transform: translateX(-100%);
      transition: transform 0.2s ease;
    }

    .erp-sidebar.erp-sidebar-open {
      transform: translateX(0);
    }
  }
`;

const FULL_ACCESS_ROLES = ["super-admin", "company-admin", "admin", "owner"];

const DEFAULT_PORTAL_ACCESS_BY_ROLE = {
  "super-admin": [
    "dashboard",
    "people-onboarding",
    "users",
    "attendance",
    "tasks",
    "sales",
    "software-products",
    "sales-commission",
    "projects",
    "reports",
    "settings",
  ],
  "company-admin": [
    "dashboard",
    "people-onboarding",
    "users",
    "attendance",
    "tasks",
    "sales",
    "software-products",
    "sales-commission",
    "projects",
    "reports",
    "settings",
  ],
  admin: [
    "dashboard",
    "people-onboarding",
    "users",
    "attendance",
    "tasks",
    "sales",
    "software-products",
    "sales-commission",
    "projects",
    "reports",
    "settings",
  ],
  owner: [
    "dashboard",
    "people-onboarding",
    "users",
    "attendance",
    "tasks",
    "sales",
    "software-products",
    "sales-commission",
    "projects",
    "reports",
    "settings",
  ],
  hr: [
    "dashboard",
    "people-onboarding",
    "users",
    "attendance",
    "tasks",
    "reports",
    "settings",
  ],
  manager: [
    "dashboard",
    "people-onboarding",
    "users",
    "attendance",
    "tasks",
    "sales",
    "software-products",
    "sales-commission",
    "projects",
    "reports",
    "settings",
  ],
  accountant: ["dashboard", "attendance", "tasks", "reports", "settings"],
  employee: ["dashboard", "attendance", "tasks", "settings"],
  intern: ["dashboard", "attendance", "tasks", "settings"],
  "sales-representative": [
    "dashboard",
    "attendance",
    "tasks",
    "sales",
    "software-products",
    "sales-commission",
    "settings",
  ],
  freelancer: ["dashboard", "attendance", "tasks", "settings"],
};

const menuSections = [
  {
    title: "MAIN",
    items: [
      {
        label: "Dashboard",
        path: "/dashboard",
        icon: LayoutDashboard,
        portalKey: "dashboard",
      },
    ],
  },
  {
    title: "COMPANY MANAGEMENT",
    items: [
      {
        label: "People Onboarding",
        path: "/people-onboarding",
        icon: UsersRound,
        portalKey: "people-onboarding",
      },
      {
        label: "Software Users",
        path: "/users",
        icon: UserCheck,
        portalKey: "users",
      },
      {
        label: "Attendance",
        path: "/attendance",
        icon: CalendarCheck,
        portalKey: "attendance",
      },
      {
        label: "Tasks",
        path: "/tasks",
        icon: ClipboardList,
        portalKey: "tasks",
      },
    ],
  },
  {
    title: "BUSINESS",
    items: [
      {
        label: "Sales",
        path: "/sales",
        icon: Target,
        portalKey: "sales",
      },
      {
        label: "Software Products",
        path: "/software-products",
        icon: PackageCheck,
        portalKey: "software-products",
      },
      {
        label: "Receive Payment",
        path: "/receive-payment",
        icon: WalletCards,
        portalKey: "sales",
      },
      {
        label: "Sales Commission",
        path: "/sales-commission",
        icon: Percent,
        portalKey: "sales-commission",
      },
      {
        label: "Projects",
        path: "/projects",
        icon: FolderKanban,
        portalKey: "projects",
      },
      {
        label: "Maintenance",
        path: "/maintenance",
        icon: Wrench,
        portalKey: "sales",
      },
    ],
  },
  {
    title: "REPORTS",
    items: [
      {
        label: "Reports",
        path: "/reports",
        icon: BarChart3,
        portalKey: "reports",
      },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      {
        label: "Settings",
        path: "/settings",
        icon: Settings,
        portalKey: "settings",
      },
    ],
  },
];

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replaceAll(" ", "-");
}

function normalizePortal(portal) {
  return String(portal || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replaceAll(" ", "-");
}

function formatRole(role) {
  if (!role) return "Company User";

  return String(role)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getDisplayName(user) {
  return (
    user?.full_name ||
    user?.person?.full_name ||
    user?.name ||
    user?.username ||
    user?.email ||
    "User"
  );
}

function parsePortalAccess(value, role) {
  const normalizedRole = normalizeRole(role);

  if (FULL_ACCESS_ROLES.includes(normalizedRole)) {
    return [
      "dashboard",
      "people-onboarding",
      "users",
      "attendance",
      "tasks",
      "sales",
      "software-products",
      "sales-commission",
      "projects",
      "reports",
      "settings",
    ];
  }

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
      return DEFAULT_PORTAL_ACCESS_BY_ROLE[normalizedRole] || [
        "dashboard",
        "attendance",
        "tasks",
        "settings",
      ];
    }
  }

  return DEFAULT_PORTAL_ACCESS_BY_ROLE[normalizedRole] || [
    "dashboard",
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
    ["software-products", "sales-commission"].includes(normalizedPortal) &&
    portalAccess.includes("sales")
  ) {
    return true;
  }

  return portalAccess.includes(normalizedPortal);
}

export default function Sidebar({ isOpen = false, closeSidebar = () => {} }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const userRole = normalizeRole(user?.role);
  const displayName = getDisplayName(user);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleNavClick = () => {
    closeSidebar();
  };

  return (
    <>
      <style>{sidebarCss}</style>

      <aside className={isOpen ? "erp-sidebar erp-sidebar-open" : "erp-sidebar"}>
        <div className="erp-sidebar-header">
          <div className="erp-sidebar-logo-mark">
            <img
              src={appInfo.logoPath || "/logo.png"}
              alt={appInfo.appName || "AeroState ERP"}
              className="erp-sidebar-logo-img"
            />
          </div>

          <div className="erp-sidebar-brand-text">
            <h2 className="erp-sidebar-logo-title">
              <span className="erp-sidebar-app-name">
                {appInfo.appName || "AeroState ERP"}
              </span>
              <span className="erp-version-badge">
                {appInfo.appVersion || "v1.0"}
              </span>
            </h2>

            <p className="erp-sidebar-subtitle">
              {appInfo.appSubtitle || "Company Management"}
            </p>
          </div>
        </div>

        <nav className="erp-sidebar-nav" aria-label="Main navigation">
          {menuSections.map((section) => {
            const allowedItems = section.items.filter((item) =>
              canAccessPortal(user, item.portalKey)
            );

            if (allowedItems.length === 0) {
              return null;
            }

            return (
              <div className="erp-sidebar-section" key={section.title}>
                <h3 className="erp-sidebar-section-title">{section.title}</h3>

                <div className="erp-sidebar-menu">
                  {allowedItems.map((item) => {
                    const Icon = item.icon;

                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === "/dashboard"}
                        onClick={handleNavClick}
                        className={({ isActive }) =>
                          isActive
                            ? "erp-sidebar-item active"
                            : "erp-sidebar-item"
                        }
                      >
                        <span className="erp-sidebar-icon">
                          <Icon size={16} />
                        </span>

                        <span className="erp-sidebar-label">{item.label}</span>

                        <ChevronRight
                          className="erp-sidebar-arrow"
                          size={16}
                        />
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="erp-sidebar-footer">
          <div className="erp-sidebar-user">
            <span className="erp-sidebar-user-icon">
              <User size={16} />
            </span>

            <div className="erp-sidebar-user-text">
              <p className="erp-sidebar-user-name">{displayName}</p>
              <p className="erp-sidebar-user-role">
                {formatRole(userRole || user?.role || "Company User")}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="erp-sidebar-logout"
            onClick={handleLogout}
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}