// Root of the app: handles login state and shows the right page

import { lazy, Suspense, useEffect, useState } from "react";
import { LandingPage } from "./components/LandingPage";
import { LoginPage } from "./components/LoginPage";
import { RegisterPage } from "./components/RegisterPage";
import { ResetPasswordPage } from "./components/ResetPasswordPage";
import { Sidebar } from "./components/Sidebar";
import { AdminSidebar } from "./components/AdminSidebar";
import { AppLayout } from "./components/AppLayout";
import AuthService from "../services/authService";
import { SessionWatcher } from "./components/SessionWatcher";
import { ViewerContext } from "./viewer";
import { clearSession, mightBeSignedIn } from "../services/session";
import { PageLoader } from "./components/Loading";

// The pages behind the login load on demand, so the first visit only downloads the landing and login pages
// (and a player never downloads the admin pages)
const Dashboard = lazy(() => import("./components/Dashboard").then((m) => ({ default: m.Dashboard })));
const SimulationsPage = lazy(() => import("./components/SimulationsPage").then((m) => ({ default: m.SimulationsPage })));
const EmailSimulation = lazy(() => import("./components/EmailSimulation").then((m) => ({ default: m.EmailSimulation })));
const SMSSimulation = lazy(() => import("./components/SMSSimulation").then((m) => ({ default: m.SMSSimulation })));
const BaselineQuiz = lazy(() => import("./components/BaselineQuiz").then((m) => ({ default: m.BaselineQuiz })));
const Analytics = lazy(() => import("./components/Analytics").then((m) => ({ default: m.Analytics })));
const ProfilePage = lazy(() => import("./components/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const AdminDashboard = lazy(() => import("./components/AdminDashboard").then((m) => ({ default: m.AdminDashboard })));
const AdminAnalytics = lazy(() => import("./components/AdminAnalytics").then((m) => ({ default: m.AdminAnalytics })));
const DatasetManagementPage = lazy(() => import("./components/DatasetManagementPage").then((m) => ({ default: m.DatasetManagementPage })));
const ScenarioManagementPage = lazy(() => import("./components/ScenarioManagementPage").then((m) => ({ default: m.ScenarioManagementPage })));
const UserMonitoringPage = lazy(() => import("./components/UserMonitoringPage").then((m) => ({ default: m.UserMonitoringPage })));
const EmailDispatcherPage = lazy(() => import("./components/EmailDispatcherPage").then((m) => ({ default: m.EmailDispatcherPage })));
const BaselineManagementPage = lazy(() => import("./components/BaselineManagementPage").then((m) => ({ default: m.BaselineManagementPage })));
const AdminProfilePage = lazy(() => import("./components/AdminProfilePage").then((m) => ({ default: m.AdminProfilePage })));

// The pages each role can open; a saved page outside its list is ignored
const PLAYER_PAGES = ["dashboard", "quiz", "simulations", "email", "sms", "performance", "profile"];
const ADMIN_PAGES = [
  "admin-dashboard", "baseline-management", "datasets", "scenarios", "users", "analytics", "email-dispatcher",
  "admin-profile",
];

/** Root component: restores the login and shows the right page for the user's role. */
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<"player" | "admin">("player");
  const [currentPage, setCurrentPage] = useState("landing");

  interface CurrentUser {
    full_name: string;
    email: string;
    age: number | null;
    occupation: string | null;
    it_background: boolean | null;
    role: string;
    campaign_consent?: boolean | null;
    campaign_consent_at?: string | null;
  }

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loginNotice, setLoginNotice] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [resetToken, setResetToken] = useState("");

  useEffect(() => {
    restoreSession();
  }, []);

  /** Go to the login page after the session has ended. */
  const handleSessionEnd = () => {
    clearSession();
    sessionStorage.removeItem("current_page");
    setCurrentUser(null);
    setIsLoggedIn(false);
    setLoginNotice("Your session ended. Please sign in again.");
    setCurrentPage("login");
  };

  /** Open the login form for one account (used when a training email sends someone here). */
  const showLoginFor = (email: string) => {
    setLoginEmail(email);
    setLoginNotice(`Sign in as ${email} to continue your training.`);
    setCurrentPage("login");
  };

  const restoreSession = async () => {
    // A password reset email links to /reset-password#token=... The token is after "#", so the browser never
    // sends it to a server (no logs, no Referer). It is read here, then removed from the address bar.
    const params = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (window.location.pathname === "/reset-password" && fragment.get("token")) {
      setResetToken(fragment.get("token") ?? "");
      setCurrentPage("reset");
      window.history.replaceState(null, "", "/");
      setIsLoading(false);
      return;
    }

    // A training email's landing page links here with ?login=<recipient>
    const loginFor = params.get("login")?.trim().toLowerCase() || "";
    if (loginFor) window.history.replaceState(null, "", window.location.pathname);

    // No CSRF cookie means no session in this browser: skip asking the server
    if (!mightBeSignedIn()) {
      if (loginFor) showLoginFor(loginFor);
      setIsLoading(false);
      return;
    }

    try {
      const response = await AuthService.getCurrentUser();

      if (!response.ok) {
        AuthService.logout();

        setIsLoggedIn(false);
        setUserRole("player");
        if (loginFor) showLoginFor(loginFor);
        else setCurrentPage("landing");

        setIsLoading(false);
        return;
      }

      const user = response.data.data;

      // Signed in as someone else (e.g. the admin who sent the campaign): sign out first
      if (loginFor && String(user.email).toLowerCase() !== loginFor) {
        await AuthService.logout();
        sessionStorage.removeItem("current_page");
        setIsLoggedIn(false);
        setUserRole("player");
        showLoginFor(loginFor);
        return;
      }

      const role = user.role.toLowerCase() as "player" | "admin";

      setCurrentUser(user);

      setIsLoggedIn(true);
      setUserRole(role);

      const defaultPage = role === "admin" ? "admin-dashboard" : "dashboard";

      const savedPage = sessionStorage.getItem("current_page");
      const pages = role === "admin" ? ADMIN_PAGES : PLAYER_PAGES;

      // A page saved before it was removed (such as the old Inbox Rush) falls back to the home page
      setCurrentPage(savedPage && pages.includes(savedPage) ? savedPage : defaultPage);
    } catch (error) {
      console.error(error);

      AuthService.logout();

      setIsLoggedIn(false);
      setUserRole("player");
      setCurrentPage("landing");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    // The role comes from the signed-in user's own details, never from a token
    const response = await AuthService.getCurrentUser();
    if (!response.ok) {
      setLoginNotice("Signing in did not complete. Please try again.");
      return;
    }
    setCurrentUser(response.data.data);
    const role = String(response.data.data.role).toLowerCase() === "admin" ? "admin" : "player";

    const page = role === "admin" ? "admin-dashboard" : "dashboard";
    sessionStorage.setItem("current_page", page);
    setLoginNotice("");
    setLoginEmail("");
    setCurrentPage(page);
    setIsLoggedIn(true);
    setUserRole(role);
  };

  const handleRegister = () => {
    setIsLoggedIn(false);
    setUserRole("player");
    setCurrentPage("login");
  };

  const handleLogout = async () => {
    await AuthService.logout();

    sessionStorage.removeItem("current_page");

    setCurrentUser(null);

    setIsLoggedIn(false);
    setUserRole("player");
    setCurrentPage("landing");
  };

  const handleNavigate = (page: string) => {
    if (page !== "reset") setResetToken("");
    sessionStorage.setItem("current_page", page);
    setCurrentPage(page);
  };

  if (isLoading) {
    return <PageLoader fullScreen label="Loading PhishSimulator..." />;
  }

  if (!isLoggedIn) {
    if (currentPage === "landing")
      return <LandingPage onNavigate={handleNavigate} />;
    if (currentPage === "login")
      return <LoginPage onLogin={handleLogin} onNavigate={handleNavigate} notice={loginNotice} initialEmail={loginEmail} />;
    if (currentPage === "register")
      return (
        <RegisterPage onNavigate={handleNavigate} onRegister={handleRegister} />
      );
    if (currentPage === "reset")
      return <ResetPasswordPage onNavigate={handleNavigate} token={resetToken || undefined} />;
    return <LandingPage onNavigate={handleNavigate} />;
  }

  if (userRole === "admin") {
    const backToDashboard = () => handleNavigate("admin-dashboard");

    return (
      <AppLayout
        currentPage={currentPage}
        backdrop="/assets/backdrop-admin.webp"
        renderSidebar={(layout) => (
          <AdminSidebar currentPage={currentPage} onNavigate={handleNavigate} onLogout={handleLogout} {...layout} />
        )}
      >
        <SessionWatcher onSignInAgain={handleSessionEnd} onLogout={handleLogout} />
        <Suspense fallback={<PageLoader />}>
          {currentPage === "admin-dashboard" && <AdminDashboard onNavigate={handleNavigate} />}
          {currentPage === "baseline-management" && <BaselineManagementPage />}
          {currentPage === "datasets" && <DatasetManagementPage onBack={backToDashboard} />}
          {currentPage === "scenarios" && <ScenarioManagementPage onBack={backToDashboard} />}
          {currentPage === "users" && <UserMonitoringPage onBack={backToDashboard} />}
          {currentPage === "analytics" && <AdminAnalytics onNavigate={handleNavigate} />}
          {currentPage === "email-dispatcher" && <EmailDispatcherPage onBack={backToDashboard} />}
          {currentPage === "admin-profile" && (
            <AdminProfilePage user={currentUser} onBack={backToDashboard} />
          )}
        </Suspense>
      </AppLayout>
    );
  }

  /** Go back to the player home page. */
  const backToHome = () => handleNavigate("dashboard");
  const backToTraining = () => handleNavigate("simulations");

  return (
    <ViewerContext.Provider value={currentUser ? { name: currentUser.full_name, email: currentUser.email } : null}>
      <AppLayout
        currentPage={currentPage}
        backdrop="/assets/backdrop-player.webp"
        renderSidebar={(layout) => (
          <Sidebar currentPage={currentPage} onNavigate={handleNavigate} onLogout={handleLogout} {...layout} />
        )}
      >
        <SessionWatcher onSignInAgain={handleSessionEnd} onLogout={handleLogout} />
        <Suspense fallback={<PageLoader />}>
          {currentPage === "dashboard" && <Dashboard user={currentUser} onNavigate={handleNavigate} />}
          {currentPage === "quiz" && <BaselineQuiz onBack={backToHome} />}
          {currentPage === "simulations" && <SimulationsPage onNavigate={handleNavigate} />}
          {currentPage === "email" && <EmailSimulation onBack={backToTraining} onNavigate={handleNavigate} />}
          {currentPage === "sms" && <SMSSimulation onBack={backToTraining} onNavigate={handleNavigate} />}
          {currentPage === "performance" && <Analytics />}
          {currentPage === "profile" && (
            <ProfilePage user={currentUser} setCurrentUser={setCurrentUser} onBack={backToHome} />
          )}
        </Suspense>
      </AppLayout>
    </ViewerContext.Provider>
  );
}
