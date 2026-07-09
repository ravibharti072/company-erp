import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

import CompanyLayout from "../layouts/CompanyLayout";

import LoginPage from "../pages/LoginPage";

import DashboardPage from "../pages/DashboardPage";
import PeopleOnboardingPage from "../pages/PeopleOnboardingPage";
import UsersPage from "../pages/UsersPage";
import AttendancePage from "../pages/AttendancePage";
import TasksPage from "../pages/TasksPage";
import SalesPage from "../pages/SalesPage";
import SoftwareProductsPage from "../pages/SoftwareProductsPage";
import ReceivePaymentPage from "../pages/ReceivePaymentPage";
import ProjectsPage from "../pages/ProjectsPage";
import MaintenancePage from "../pages/MaintenancePage";
import SalesCommissionPage from "../pages/SalesCommissionPage";
import ReportsPage from "../pages/ReportsPage";
import SettingsPage from "../pages/SettingsPage";

function PageLoading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 900,
        color: "#2563eb",
      }}
    >
      Loading...
    </div>
  );
}

function PublicPage({ children }) {
  const auth = useAuth() || {};

  const checkingAuth =
    auth.checkingAuth || auth.loading || auth.isLoading || false;

  const isLoggedIn = Boolean(auth.isAuthenticated && auth.user && auth.token);

  if (checkingAuth) {
    return <PageLoading />;
  }

  if (isLoggedIn) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function ProtectedPage({ children }) {
  const location = useLocation();
  const auth = useAuth() || {};

  const checkingAuth =
    auth.checkingAuth || auth.loading || auth.isLoading || false;

  const isLoggedIn = Boolean(auth.isAuthenticated && auth.user && auth.token);

  if (checkingAuth) {
    return <PageLoading />;
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route
        path="/login"
        element={
          <PublicPage>
            <LoginPage />
          </PublicPage>
        }
      />

      <Route path="/super-admin-login" element={<Navigate to="/login" replace />} />
      <Route path="/super-admin" element={<Navigate to="/login" replace />} />

      <Route
        element={
          <ProtectedPage>
            <CompanyLayout />
          </ProtectedPage>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />

        <Route path="/people-onboarding" element={<PeopleOnboardingPage />} />
        <Route
          path="/people"
          element={<Navigate to="/people-onboarding" replace />}
        />

        <Route path="/users" element={<UsersPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/tasks" element={<TasksPage />} />

        <Route path="/sales" element={<SalesPage />} />
        <Route path="/software-products" element={<SoftwareProductsPage />} />
        <Route path="/receive-payment" element={<ReceivePaymentPage />} />
        <Route path="/sales-commission" element={<SalesCommissionPage />} />

        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/maintenance" element={<MaintenancePage />} />

        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}