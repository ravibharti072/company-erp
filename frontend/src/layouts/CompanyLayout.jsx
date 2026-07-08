import { createContext, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export const DashboardContext = createContext(null);

export default function CompanyLayout() {
  const [activeModule, setActiveModule] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  useEffect(() => {
    if (sidebarOpen) {
      document.body.classList.add("erp-sidebar-lock");
    } else {
      document.body.classList.remove("erp-sidebar-lock");
    }

    return () => {
      document.body.classList.remove("erp-sidebar-lock");
    };
  }, [sidebarOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 900) {
        setSidebarOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <DashboardContext.Provider value={{ activeModule, setActiveModule }}>
      <style>{layoutStyles}</style>

      <div className="company-layout-shell">
        <Sidebar
          isOpen={sidebarOpen}
          toggleSidebar={toggleSidebar}
          closeSidebar={closeSidebar}
          activeModule={activeModule}
          setActiveModule={setActiveModule}
        />

        <main className="company-layout-main">
          <button
            type="button"
            className="erp-mobile-menu-btn"
            onClick={toggleSidebar}
            aria-label="Open menu"
          >
            ☰
          </button>

          <Outlet context={{ activeModule, setActiveModule }} />
        </main>
      </div>
    </DashboardContext.Provider>
  );
}

const layoutStyles = `
@import url("https://fonts.googleapis.com/css2?family=Stack+Sans+Text:wght@300;400;500;600;700;800;900&display=swap");

:root {
  --erp-sidebar-width: 270px;
  --erp-bg: #eef3f8;
  --erp-border: #dbe5f2;
  --erp-border-soft: #e6edf6;
  --erp-primary: #2563eb;
  --erp-primary-border: #bfdbfe;
  --erp-muted: #51627a;
  --erp-danger: #ef4444;
  --erp-danger-dark: #dc2626;

  --erp-font: "Stack Sans Text", system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI", Roboto, Arial, sans-serif;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  width: 100%;
  min-height: 100%;
  margin: 0;
  padding: 0;
  font-family: var(--erp-font) !important;
}

body {
  background: var(--erp-bg);
  color: #0f172a;
  font-family: var(--erp-font) !important;
  overflow-x: hidden;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body.erp-sidebar-lock {
  overflow: hidden;
}

/* Base font */
body *,
.company-layout-shell *,
.company-layout-main * {
  font-family: var(--erp-font) !important;
}

/* Normal text */
p,
span,
div,
section,
article,
aside,
main,
nav,
label,
table,
thead,
tbody,
tr,
td,
small,
em,
li,
ul,
ol,
form,
input,
select,
textarea {
  font-family: var(--erp-font) !important;
  font-weight: 400;
}

/* Required bold text */
h1,
h2,
h3,
h4,
h5,
h6,
strong,
b,
button,
th,
.page-header h1,
.card-title-row h2,
.dashboard-header-card h1,
.welcome-card h2,
.modules-section-header h2,
.module-text h3,
.overview-card strong,
.dashboard-clock-card strong,
.login-card strong,
.sidebar-link-label,
.erp-sidebar-label,
.erp-sidebar-user-name,
.brand-title-row h2,
.erp-sidebar-app-name {
  font-family: var(--erp-font) !important;
  font-weight: 700;
}

/* Medium text where full bold is not needed */
.dashboard-header-card p,
.welcome-card p,
.modules-section-header p,
.module-text p,
.overview-card p,
.overview-card span,
.login-card span,
.sidebar-section-title,
.erp-sidebar-section-title,
.erp-sidebar-user-role,
.brand-text p,
.erp-sidebar-subtitle {
  font-weight: 500;
}

.company-layout-shell {
  min-height: 100vh;
  width: 100%;
  background: #eef3f8;
}

.company-layout-main {
  min-height: 100vh;
  margin-left: var(--erp-sidebar-width);
  padding: 24px 26px 34px;
  background: #eef3f8;
  box-sizing: border-box;
}

.erp-mobile-menu-btn {
  display: none;
  position: fixed;
  top: 14px;
  left: 14px;
  z-index: 9997;
  width: 42px;
  height: 42px;
  border: 1px solid #dbeafe;
  background: #ffffff;
  color: #2563eb;
  border-radius: 13px;
  font-size: 22px;
  line-height: 1;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
  cursor: pointer;
  font-weight: 700;
}

@media (max-width: 1100px) {
  .company-layout-main {
    padding: 22px 20px 32px;
  }
}

@media (max-width: 900px) {
  .erp-mobile-menu-btn {
    display: grid;
    place-items: center;
  }

  .company-layout-main {
    margin-left: 0;
    padding: 72px 16px 28px;
  }
}

@media (max-width: 640px) {
  .company-layout-main {
    padding: 68px 12px 26px;
  }
}
`;