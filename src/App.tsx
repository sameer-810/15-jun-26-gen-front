import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./app/layouts/AppLayout";
import { RequireAuth } from "./app/router/RequireAuth";
import { PageLoader } from "./shared/components/PageLoader";

const LoginPage = lazy(() =>
  import("./modules/auth/pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const DashboardPage = lazy(() =>
  import("./modules/dashboard/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const SettingsPage = lazy(() =>
  import("./modules/settings/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const UsersPage = lazy(() =>
  import("./modules/users/pages/UsersPage").then((m) => ({ default: m.UsersPage })),
);
const MyPerformancePage = lazy(() =>
  import("./modules/hr/pages/MyPerformancePage").then((m) => ({ default: m.MyPerformancePage })),
);
const AttendanceAdminPage = lazy(() =>
  import("./modules/hr/pages/AttendanceAdminPage").then((m) => ({
    default: m.AttendanceAdminPage,
  })),
);
const LeadListPage = lazy(() =>
  import("./modules/lead/pages/LeadListPage").then((m) => ({ default: m.LeadListPage })),
);
const LeadDetailPage = lazy(() =>
  import("./modules/lead/pages/LeadDetailPage").then((m) => ({ default: m.LeadDetailPage })),
);
const CapacityCalculatorPage = lazy(() =>
  import("./modules/capacity/pages/CapacityCalculatorPage").then((m) => ({
    default: m.CapacityCalculatorPage,
  })),
);
const InventoryListPage = lazy(() =>
  import("./modules/inventory/pages/InventoryListPage").then((m) => ({
    default: m.InventoryListPage,
  })),
);
const TemplatesPage = lazy(() =>
  import("./modules/messaging/pages/TemplatesPage").then((m) => ({ default: m.TemplatesPage })),
);
const LocationsPage = lazy(() =>
  import("./modules/location/LocationsPage").then((m) => ({ default: m.LocationsPage })),
);
const ProductListPage = lazy(() =>
  import("./modules/product/pages/ProductListPage").then((m) => ({
    default: m.ProductListPage,
  })),
);
const SaleListPage = lazy(() =>
  import("./modules/sale/pages/SaleListPage").then((m) => ({ default: m.SaleListPage })),
);
const QuotationListPage = lazy(() =>
  import("./modules/quotation/pages/QuotationListPage").then((m) => ({
    default: m.QuotationListPage,
  })),
);
const ActivityFeedPage = lazy(() =>
  import("./modules/activity/pages/ActivityFeedPage").then((m) => ({
    default: m.ActivityFeedPage,
  })),
);
const ReportsPage = lazy(() =>
  import("./modules/reports/pages/ReportsPage").then((m) => ({ default: m.ReportsPage })),
);

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="leads" element={<LeadListPage />} />
          <Route path="leads/:id" element={<LeadDetailPage />} />
          <Route path="capacity-calculator" element={<CapacityCalculatorPage />} />
          <Route path="catalog" element={<ProductListPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="locations" element={<LocationsPage />} />
          <Route path="inventory" element={<InventoryListPage />} />
          <Route path="sales" element={<SaleListPage />} />
          <Route path="quotations" element={<QuotationListPage />} />
          <Route path="activity" element={<ActivityFeedPage />} />
          <Route path="reports" element={<ReportsPage />} />
          {/* SRS 3.5 — every role has this; the server scopes it to them. */}
          <Route path="my-performance" element={<MyPerformancePage />} />
          <Route path="attendance" element={<AttendanceAdminPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="users" element={<UsersPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
