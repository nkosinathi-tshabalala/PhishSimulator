// Root of the app: handles login state and shows the right page

import { useEffect, useState } from "react";
import { LandingPage } from "./components/LandingPage";
import { LoginPage } from "./components/LoginPage";
import { RegisterPage } from "./components/RegisterPage";
import { ResetPasswordPage } from "./components/ResetPasswordPage";
import { Sidebar } from "./components/Sidebar";
import { AdminSidebar } from "./components/AdminSidebar";
import { AppLayout } from "./components/AppLayout";
import { Dashboard } from "./components/Dashboard";
import { SimulationsPage } from "./components/SimulationsPage";
import { EmailSimulation } from "./components/EmailSimulation";
import { SMSSimulation } from "./components/SMSSimulation";
import { InboxTriage } from "./components/InboxTriage";
import { BaselineQuiz } from "./components/BaselineQuiz";
import { Analytics } from "./components/Analytics";
import { ProfilePage } from "./components/ProfilePage";
import { AdminDashboard } from "./components/AdminDashboard";
import { AdminAnalytics } from "./components/AdminAnalytics";
import { DatasetManagementPage } from "./components/DatasetManagementPage";
import { ScenarioManagementPage } from "./components/ScenarioManagementPage";
import { UserMonitoringPage } from "./components/UserMonitoringPage";
import { EmailDispatcherPage } from "./components/EmailDispatcherPage";
import { BaselineManagementPage } from "./components/BaselineManagementPage";
import { AdminProfilePage } from "./components/AdminProfilePage";
import AuthService from "../services/authService";
import { SessionWatcher } from "./components/SessionWatcher";

/** Root component: restores the login and shows the right page for the user's role. */
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<"player" | "admin">("player");
  const [currentPage, setCurrentPage] = useState("landing");

  interface CurrentUser {
    user_id: number;
    full_name: string;
    email: string;
    age: number | null;
    occupation: string | null;
    it_background: boolean | null;
    role: string;
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
    localStorage.removeItem("access_token");
    localStorage.removeItem("current_page");
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
    // A password reset email links to /reset-password?token=...; the token is read, then removed from the address bar
    const params = new URLSearchParams(window.location.search);
    if (window.location.pathname === "/reset-password" && params.get("token")) {
      setResetToken(params.get("token") ?? "");
      setCurrentPage("reset");
      window.history.replaceState(null, "", "/");
      setIsLoading(false);
      return;
    }

    // A training email's landing page links here with ?login=<recipient>
    const loginFor = params.get("login")?.trim().toLowerCase() || "";
    if (loginFor) window.history.replaceState(null, "", window.location.pathname);

    const token = localStorage.getItem("access_token");

    if (!token) {
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
        localStorage.removeItem("current_page");
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

      const savedPage = localStorage.getItem("current_page");

      setCurrentPage(savedPage || defaultPage);
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

  const handleLogin = async (role: "player" | "admin") => {
    const response = await AuthService.getCurrentUser();
    if (response.ok) {
      setCurrentUser(response.data.data);
    }

    const page = role === "admin" ? "admin-dashboard" : "dashboard";
    localStorage.setItem("current_page", page);
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

    localStorage.removeItem("current_page");

    setCurrentUser(null);

    setIsLoggedIn(false);
    setUserRole("player");
    setCurrentPage("landing");
  };

  const handleNavigate = (page: string) => {
    if (page !== "reset") setResetToken("");
    localStorage.setItem("current_page", page);
    setCurrentPage(page);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
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
        backgroundImage="/assets/IMG_5602.jpg"
        renderSidebar={(layout) => (
          <AdminSidebar currentPage={currentPage} onNavigate={handleNavigate} onLogout={handleLogout} {...layout} />
        )}
      >
        <SessionWatcher onSignInAgain={handleSessionEnd} onLogout={handleLogout} />
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
      </AppLayout>
    );
  }

  /** Go back to the player home page. */
  const backToHome = () => handleNavigate("dashboard");
  const backToTraining = () => handleNavigate("simulations");

  return (
    <AppLayout
      currentPage={currentPage}
      backgroundImage="/assets/IMG_5601.jpg"
      renderSidebar={(layout) => (
        <Sidebar currentPage={currentPage} onNavigate={handleNavigate} onLogout={handleLogout} {...layout} />
      )}
    >
      <SessionWatcher onSignInAgain={handleSessionEnd} onLogout={handleLogout} />
      {currentPage === "dashboard" && <Dashboard user={currentUser} onNavigate={handleNavigate} />}
      {currentPage === "quiz" && <BaselineQuiz onBack={backToHome} />}
      {currentPage === "simulations" && <SimulationsPage onNavigate={handleNavigate} />}
      {currentPage === "email" && <EmailSimulation onBack={backToTraining} onNavigate={handleNavigate} />}
      {currentPage === "sms" && <SMSSimulation onBack={backToTraining} onNavigate={handleNavigate} />}
      {currentPage === "triage" && <InboxTriage onBack={backToTraining} onNavigate={handleNavigate} />}
      {currentPage === "performance" && <Analytics />}
      {currentPage === "profile" && (
        <ProfilePage user={currentUser} setCurrentUser={setCurrentUser} onBack={backToHome} />
      )}
    </AppLayout>
  );
}
