import { CenteredCrudModalToastContainer } from "@/components/ui/centered-crud-toast";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import Index from "./pages/Index";
import Assets from "./pages/Assets";
import ResidentialHub from "./pages/ResidentialHub";
import ResidentialPermanent from "./pages/ResidentialPermanent";
import ResidentialSeasonal from "./pages/ResidentialSeasonal";
import ResidentialGuest from "./pages/ResidentialGuest";
import QRCodes from "./pages/QRCodes";
import Approvals from "./pages/Approvals";
import Transfers from "./pages/Transfers";
import Tickets from "./pages/Tickets";
import Reports from "./pages/Reports";
import Audit from "./pages/Audit";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import ForceChangePassword from "./pages/ForceChangePassword";


import AssetDetails from "./pages/AssetDetails";
import AssetAnalytics from "./pages/AssetAnalytics";
import Compliance from "./pages/Compliance";
import Maintenance from "./pages/Maintenance";
import Scan from "./pages/Scan";
import Newsletter from "./pages/Newsletter";
import Status from "@/pages/Status";
import Help from "./pages/Help";
import TicketDetails from "./pages/TicketDetails";
import ApprovalDetails from "./pages/ApprovalDetails";
import ReportDetails from "./pages/ReportDetails";
import QRCodeDetails from "./pages/QRCodeDetails";
import Employees from "./pages/Employees";
import HouseOpp from "./pages/HouseOpp";
import AllocatedHouses from "./pages/AllocatedHouses";
import HouseCommandCenter from "./pages/HouseCommandCenter";
import HouseOperations from "./pages/HouseOperations";
import SmartAllocationConsole from "./pages/SmartAllocationConsole";
import AllocationHistory from "./pages/AllocationHistory";
import HouseQueuePage from "./pages/HouseQueuePage";
import HouseQueueReview from "./pages/HouseQueueReview";
import ScoringConfigPage from "./pages/ScoringConfigPage";
import EligibilityConfigPage from "./pages/EligibilityConfigPage";
import HouseApplicationNew from "./pages/HouseApplicationNew";
import HouseApplicationMy from "./pages/HouseApplicationMy";
import HouseApplicationStatus from "./pages/HouseApplicationStatus";
import TerminationManagement from "./pages/TerminationManagement";
import Properties from "./pages/Properties";
import PropertyDetails from "./pages/PropertyDetails";
import HouseDetails from "./pages/HouseDetails";
import UserDetails from "./pages/UserDetails";
import EmployeeDetails from "./pages/EmployeeDetails";
import { RequesterLayout } from "./pages/requester/RequesterLayout";
import RequesterDashboard from "./pages/requester/RequesterDashboard";
import RequesterApplicationNew from "./pages/requester/RequesterApplicationNew";
import RequesterMyApplications from "./pages/requester/RequesterMyApplications";
import RequesterApplicationStatus from "./pages/requester/RequesterApplicationStatus";
import RequesterProfile from "./pages/requester/RequesterProfile";
import { ApplicantLayout } from "./pages/applicant/ApplicantLayout";
import ApplicantDashboard from "./pages/applicant/ApplicantDashboard";
import ApplicantApplicationNew from "./pages/applicant/ApplicantApplicationNew";
import ApplicantMyApplications from "./pages/applicant/ApplicantMyApplications";
import ApplicantApplicationStatus from "./pages/applicant/ApplicantApplicationStatus";
import ApplicantProfile from "./pages/applicant/ApplicantProfile";
import ApplicantMaintenanceRequest from "./pages/applicant/ApplicantMaintenanceRequest";
import CivilWorkPanel from "./pages/CivilWorkPanel";
// SingleDeviceGuard removed per user request

import RequireView from "@/components/session/RequireView";
import { ConnectionStatus } from "@/components/common/ConnectionStatus";
import { ThemeInitializer } from "@/components/common/ThemeInitializer";
import { WelcomeDialog } from "@/components/common/WelcomeDialog";

const BASE_TITLE = "Metahara_Sugar_factory";

// Update browser favicon to QR code image
const updateFavicon = () => {
  const link = document.querySelector(
    "link[rel*='icon']",
  ) as HTMLLinkElement | null;
  if (link) {
    link.href = "/qrcodeimage.jpg";
  } else {
    const newLink = document.createElement("link");
    newLink.rel = "icon";
    newLink.href = "/qrcodeimage.jpg";
    document.head.appendChild(newLink);
  }
};

import { isAuthenticated, getCurrentUser, clearStoredSession } from "@/services/djangoAuth";
import { normalizeRole } from "@/services/permissions";

function SessionLoading() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background">
      <div className="relative">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm font-semibold text-foreground">
          Securing your session
        </p>
        <p className="text-xs text-muted-foreground">
          Verifying access credentials&hellip;
        </p>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [state, setState] = useState<"checking" | "valid" | "invalid">(
    "checking",
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isAuthenticated()) {
        clearStoredSession();
        if (!cancelled) setState("invalid");
        return;
      }
      // Validate the stored session against the backend so a stale or forged
      // token can never unlock the dashboard.
      const user = await getCurrentUser().catch(() => null);
      if (cancelled) return;
      if (!user) {
        clearStoredSession();
        if (!cancelled) setState("invalid");
        return;
      }
      // Normalize a stored SUPER_ADMIN role to ADMIN so every role check in
      // the app treats Django superusers as full admins.
      try {
        const raw = localStorage.getItem("auth_user");
        if (raw) {
          const au = JSON.parse(raw);
          if (normalizeRole(au?.role) === "admin" && au.role !== "admin") {
            au.role = "admin";
            localStorage.setItem("auth_user", JSON.stringify(au));
          }
        }
      } catch {}
      if (!cancelled) setState("valid");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "invalid") {
    const returnTo = location.pathname + location.search;
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }
  if (state === "checking") return <SessionLoading />;
  return <>{children}</>;
}

function RootRedirect() {
  return isAuthenticated() ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <Navigate to="/login" replace />
  );
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  if (isAuthenticated()) {
    const params = new URLSearchParams(location.search);
    // If ?force=true is present (e.g. from "Access Platform" on the site),
    // show the login page instead of auto-redirecting to the dashboard.
    if (params.get("force") === "true") {
      return <>{children}</>;
    }
    const returnTo = params.get("returnTo");
    return <Navigate to={returnTo || "/dashboard"} replace />;
  }
  return <>{children}</>;
}

function RoleGate({
  roles,
  children,
}: {
  roles: string[];
  children: React.ReactNode;
}) {
  let role = "";
  try {
    const raw = localStorage.getItem("auth_user");
    role = raw ? JSON.parse(raw).role || "" : "";
  } catch {}
  const r = normalizeRole(role);
  if (!roles.map((s) => s.toLowerCase()).includes(r)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function RequesterShell() {
  return (
    <RequireAuth>
      <RequesterLayout>
        <Outlet />
      </RequesterLayout>
    </RequireAuth>
  );
}

function ApplicantShell() {
  return (
    <RequireAuth>
      <ApplicantLayout>
        <Outlet />
      </ApplicantLayout>
    </RequireAuth>
  );
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleExpired = () => {
      const returnTo = location.pathname + location.search;
      toast.warning("Your session has expired. Please log in again.");
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
    };
    window.addEventListener("sams:session-expired", handleExpired);
    return () =>
      window.removeEventListener("sams:session-expired", handleExpired);
  }, [navigate, location]);

  return (
    <RequireAuth>
      <Layout>
        <Outlet />
      </Layout>
    </RequireAuth>
  );
}

const queryClient = new QueryClient();

// Initialize MSF branding
updateFavicon();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <CenteredCrudModalToastContainer />
      <ConnectionStatus />
      <ThemeInitializer />
      <WelcomeDialog />
      {/* SingleDeviceGuard removed */}
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/force-change-password" element={<RequireAuth><ForceChangePassword /></RequireAuth>} />
          {/* Root — authenticated users go straight to the dashboard,
              unauthenticated visitors are sent to /login */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="/site" element={<Navigate to="/" replace />} />

          <Route element={<AppShell />}>
            <Route
              path="/dashboard"
              element={<Index />}
            />
            <Route
              path="/assets"
              element={
                <RequireView page="assets">
                  <Assets />
                </RequireView>
              }
            />
            <Route
              path="/assets/analytics"
              element={
                <RequireView page="assets">
                  <AssetAnalytics />
                </RequireView>
              }
            />
            <Route
              path="/assets/compliance"
              element={
                <RequireView page="assets">
                  <Compliance />
                </RequireView>
              }
            />
            <Route
              path="/maintenance"
              element={
                <RequireView page="assets">
                  <Maintenance />
                </RequireView>
              }
            />
            <Route
              path="/assets/:id"
              element={
                <RequireView page="assets">
                  <AssetDetails />
                </RequireView>
              }
            />
            <Route
              path="/transfers"
              element={
                <RequireView page="assets">
                  <Transfers />
                </RequireView>
              }
            />
            <Route
              path="/properties"
              element={
                <RequireView page="properties">
                  <Properties />
                </RequireView>
              }
            />
            <Route
              path="/properties/:id"
              element={
                <RequireView page="properties">
                  <PropertyDetails />
                </RequireView>
              }
            />
            <Route
              path="/house-opp/:id"
              element={
                <RequireView page="houses">
                  <HouseDetails />
                </RequireView>
              }
            />
            <Route
              path="/house-opp"
              element={
                <RequireView page="houses">
                  <HouseOpp />
                </RequireView>
              }
            />
            <Route
              path="/houses"
              element={<Navigate to="/house-opp" replace />}
            />
            <Route
              path="/houses/command-center"
              element={
                <RequireView page="houses">
                  <HouseCommandCenter />
                </RequireView>
              }
            />
            <Route
              path="/houses/allocations"
              element={
                <RequireView page="houses">
                  <AllocatedHouses />
                </RequireView>
              }
            />
            <Route
              path="/houses/allocate"
              element={
                <RequireView page="houses">
                  <SmartAllocationConsole />
                </RequireView>
              }
            />
            <Route
              path="/houses/allocations/history"
              element={
                <RequireView page="houses">
                  <AllocationHistory />
                </RequireView>
              }
            />
            <Route
              path="/houses/operations"
              element={
                <RequireView page="houses">
                  <HouseOperations />
                </RequireView>
              }
            />
            <Route
              path="/houses/terminations"
              element={
                <RoleGate roles={["admin", "manager"]}>
                  <TerminationManagement />
                </RoleGate>
              }
            />
            <Route
              path="/house-opp/queue"
              element={
                <RoleGate roles={["admin", "manager"]}>
                  <HouseQueuePage />
                </RoleGate>
              }
            />
            <Route
              path="/house-opp/queue/:id"
              element={
                <RoleGate roles={["admin", "manager"]}>
                  <HouseQueueReview />
                </RoleGate>
              }
            />
            <Route
              path="/house-opp/scoring"
              element={
                <RoleGate roles={["admin", "manager"]}>
                  <ScoringConfigPage />
                </RoleGate>
              }
            />
            <Route
              path="/house-opp/eligibility"
              element={
                <RoleGate roles={["admin", "manager"]}>
                  <EligibilityConfigPage />
                </RoleGate>
              }
            />
            <Route
              path="/house-application/new"
              element={
                <RoleGate roles={["admin", "manager", "requester"]}>
                  <HouseApplicationNew />
                </RoleGate>
              }
            />
            <Route
              path="/house-application/my"
              element={
                <RoleGate roles={["admin", "manager", "requester"]}>
                  <HouseApplicationMy />
                </RoleGate>
              }
            />
            <Route
              path="/house-application/status"
              element={
                <RoleGate roles={["admin", "manager", "requester"]}>
                  <HouseApplicationStatus />
                </RoleGate>
              }
            />
            <Route
              path="/residential-hub"
              element={
                <RequireView page="residential_hub">
                  <ResidentialHub />
                </RequireView>
              }
            />
            <Route
              path="/residential-hub/permanent"
              element={
                <RequireView page="residential_hub">
                  <ResidentialPermanent />
                </RequireView>
              }
            />
            <Route
              path="/residential-hub/seasonal"
              element={
                <RequireView page="residential_hub">
                  <ResidentialSeasonal />
                </RequireView>
              }
            />
            <Route
              path="/residential-hub/guest"
              element={
                <RequireView page="residential_hub">
                  <ResidentialGuest />
                </RequireView>
              }
            />
            <Route
              path="/qr-codes"
              element={
                <RequireView page="qrcodes">
                  <QRCodes />
                </RequireView>
              }
            />
            <Route
              path="/qr-codes/:id"
              element={
                <RequireView page="qrcodes">
                  <QRCodeDetails />
                </RequireView>
              }
            />
            <Route path="/scan" element={<Scan />} />
            <Route
              path="/approvals"
              element={
                <RoleGate roles={["admin", "manager"]}>
                  <Approvals />
                </RoleGate>
              }
            />
            <Route
              path="/approvals/:id"
              element={
                <RoleGate roles={["admin", "manager"]}>
                  <ApprovalDetails />
                </RoleGate>
              }
            />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/tickets/:id" element={<TicketDetails />} />
            <Route
              path="/civil-work"
              element={
                <RoleGate roles={["admin", "manager", "field_staff"]}>
                  <CivilWorkPanel />
                </RoleGate>
              }
            />
            <Route path="/newsletter" element={<Newsletter />} />
            <Route path="/help" element={<Help />} />
            <Route
              path="/employees"
              element={
                <RequireView page="employees">
                  <Employees />
                </RequireView>
              }
            />
            <Route
              path="/employees/:id"
              element={
                <RequireView page="employees">
                  <EmployeeDetails />
                </RequireView>
              }
            />
            <Route
              path="/reports"
              element={
                <RequireView page="reports">
                  <Reports />
                </RequireView>
              }
            />
            <Route
              path="/reports/:id"
              element={
                <RequireView page="reports">
                  <ReportDetails />
                </RequireView>
              }
            />
            <Route
              path="/audit"
              element={
                <RoleGate roles={["manager", "admin"]}>
                  <Audit />
                </RoleGate>
              }
            />
            <Route
              path="/users"
              element={
                <RequireView page="users">
                  <Users />
                </RequireView>
              }
            />
            <Route
              path="/users/:id"
              element={
                <RequireView page="users">
                  <UserDetails />
                </RequireView>
              }
            />
            <Route path="/profile" element={<Profile />} />
            <Route
              path="/settings"
              element={
                <RequireView page="settings">
                  <Settings />
                </RequireView>
              }
            />
            <Route path="/status" element={<Status />} />
          </Route>

          {/* Requester-specific routes */}
          <Route element={<RequesterShell />}>
            <Route
              path="/requester"
              element={<Navigate to="/requester/dashboard" replace />}
            />
            <Route
              path="/requester/dashboard"
              element={
                <RoleGate roles={["admin", "manager", "requester"]}>
                  <RequesterDashboard />
                </RoleGate>
              }
            />
            <Route
              path="/requester/new"
              element={
                <RoleGate roles={["admin", "manager", "requester"]}>
                  <RequesterApplicationNew />
                </RoleGate>
              }
            />
            <Route
              path="/requester/my"
              element={
                <RoleGate roles={["admin", "manager", "requester"]}>
                  <RequesterMyApplications />
                </RoleGate>
              }
            />
            <Route
              path="/requester/status"
              element={
                <RoleGate roles={["admin", "manager", "requester"]}>
                  <RequesterApplicationStatus />
                </RoleGate>
              }
            />
            <Route
              path="/requester/profile"
              element={
                <RoleGate roles={["admin", "manager", "requester"]}>
                  <RequesterProfile />
                </RoleGate>
              }
            />
          </Route>

          {/* Applicant-specific routes */}
          <Route element={<ApplicantShell />}>
            <Route
              path="/applicant"
              element={<Navigate to="/applicant/new" replace />}
            />
            <Route
              path="/applicant/dashboard"
              element={
                <RoleGate roles={["applicant"]}>
                  <ApplicantDashboard />
                </RoleGate>
              }
            />
            <Route
              path="/applicant/new"
              element={
                <RoleGate roles={["applicant"]}>
                  <ApplicantApplicationNew />
                </RoleGate>
              }
            />
            <Route
              path="/applicant/my"
              element={
                <RoleGate roles={["applicant"]}>
                  <ApplicantMyApplications />
                </RoleGate>
              }
            />
            <Route
              path="/applicant/status"
              element={
                <RoleGate roles={["applicant"]}>
                  <ApplicantApplicationStatus />
                </RoleGate>
              }
            />
            <Route
              path="/applicant/profile"
              element={
                <RoleGate roles={["applicant"]}>
                  <ApplicantProfile />
                </RoleGate>
              }
            />
            <Route
              path="/applicant/maintenance"
              element={
                <RoleGate roles={["applicant"]}>
                  <ApplicantMaintenanceRequest />
                </RoleGate>
              }
            />
          </Route>
          <Route path="*" element={<RequireAuth><NotFound /></RequireAuth>} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
