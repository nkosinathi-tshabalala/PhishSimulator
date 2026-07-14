import { useEffect, useState } from "react";
import { LandingPage } from "./components/LandingPage";
import { LoginPage } from "./components/LoginPage";
import { AdminLoginPage } from "./components/AdminLoginPage";
import { RegisterPage } from "./components/RegisterPage";
import { ResetPasswordPage } from "./components/ResetPasswordPage";
import { Dashboard } from "./components/Dashboard";
import { AdminDashboard } from "./components/AdminDashboard";
import { EmailSimulation } from "./components/EmailSimulation";
import { SMSSimulation } from "./components/SMSSimulation";
import { BaselineQuiz } from "./components/BaselineQuiz";
import { Analytics } from "./components/Analytics";
import { AdminAnalytics } from "./components/AdminAnalytics";
import { ProfilePage } from "./components/ProfilePage";
import { SimulationsPage } from "./components/SimulationsPage";
import { DatasetManagementPage } from "./components/DatasetManagementPage";
import { ScenarioManagementPage } from "./components/ScenarioManagementPage";
import { UserMonitoringPage } from "./components/UserMonitoringPage";
import { EmailDispatcherPage } from "./components/EmailDispatcherPage";
import { Sidebar } from "./components/Sidebar";
import { AdminSidebar } from "./components/AdminSidebar";

import AuthService from "../services/authService";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<"player" | "admin">("player");
  const [currentPage, setCurrentPage] = useState("landing");

  interface CurrentUser {
    user_id: number;
    full_name: string;
    email: string;
    age: number;
    occupation: string;
    it_background: boolean;
    role: string;
  }

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    const token = localStorage.getItem("access_token");

    // No stored session
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await AuthService.getCurrentUser();

      if (!response.ok) {
        AuthService.logout();

        setIsLoggedIn(false);
        setUserRole("player");
        setCurrentPage("landing");

        setIsLoading(false);
        return;
      }

      const user = response.data.data;

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

    console.log(response);

    if (response.ok) {
      setCurrentUser(response.data.data);
    }

    const page = role === "admin" ? "admin-dashboard" : "dashboard";

    localStorage.setItem("current_page", page);

    setCurrentPage(page);

    console.log("Navigating to:", page);

    setIsLoggedIn(true);
    setUserRole(role);
  };

  const handleRegister = () => {
    console.log("handleRegister called");
    setIsLoggedIn(false);
    setUserRole("player");
    setCurrentPage("login");
  };

  const handleLogout = () => {
    AuthService.logout();

    localStorage.removeItem("current_page");

    setCurrentUser(null);

    setIsLoggedIn(false);
    setUserRole("player");
    setCurrentPage("landing");
  };

  const handleNavigate = (page: string) => {
    localStorage.setItem("current_page", page);
    setCurrentPage(page);
  };

  // Public pages

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
      return <LoginPage onLogin={handleLogin} onNavigate={handleNavigate} />;
    if (currentPage === "admin-login")
      return (
        <AdminLoginPage onLogin={handleLogin} onNavigate={handleNavigate} />
      );
    if (currentPage === "register")
      return (
        <RegisterPage onNavigate={handleNavigate} onRegister={handleRegister} />
      );
    if (currentPage === "reset")
      return <ResetPasswordPage onNavigate={handleNavigate} />;
    return <LandingPage onNavigate={handleNavigate} />;
  }

  // Admin pages
  if (userRole === "admin") {
    return (
      <div className="flex h-screen overflow-hidden">
        <AdminSidebar
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
        <div
          className="flex-1 overflow-auto"
          style={{ backgroundColor: "#f0f4f8" }}
        >
          {currentPage === "admin-dashboard" && (
            <AdminDashboard onNavigate={handleNavigate} />
          )}
          {currentPage === "datasets" && (
            <DatasetManagementPage
              onBack={() => handleNavigate("admin-dashboard")}
            />
          )}
          {currentPage === "scenarios" && (
            <ScenarioManagementPage
              onBack={() => handleNavigate("admin-dashboard")}
            />
          )}
          {currentPage === "users" && (
            <UserMonitoringPage
              onBack={() => handleNavigate("admin-dashboard")}
            />
          )}
          {currentPage === "analytics" && (
            <AdminAnalytics onBack={() => handleNavigate("admin-dashboard")} />
          )}
          {currentPage === "email-dispatcher" && (
            <EmailDispatcherPage
              onBack={() => handleNavigate("admin-dashboard")}
            />
          )}

          {currentPage === "settings" && (
            <ProfilePage
              user={currentUser}
              setCurrentUser={setCurrentUser}
              onBack={() => handleNavigate("admin-dashboard")}
            />
          )}
        </div>
      </div>
    );
  }

  // Player pages
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />
      <div
        className="flex-1 overflow-auto"
        style={{ backgroundColor: "#f0f4f8" }}
      >
        {currentPage === "dashboard" && (
          <Dashboard user={currentUser} onNavigate={handleNavigate} />
        )}
        {currentPage === "quiz" && (
          <BaselineQuiz onBack={() => handleNavigate("dashboard")} />
        )}
        {currentPage === "simulations" && (
          <SimulationsPage onNavigate={handleNavigate} />
        )}
        {currentPage === "email" && (
          <EmailSimulation onBack={() => handleNavigate("simulations")} />
        )}
        {currentPage === "sms" && (
          <SMSSimulation onBack={() => handleNavigate("simulations")} />
        )}
        {currentPage === "performance" && (
          <Analytics onBack={() => handleNavigate("dashboard")} />
        )}
        {currentPage === "profile" && (
          <ProfilePage
            user={currentUser}
            setCurrentUser={setCurrentUser}
            onBack={() => handleNavigate("dashboard")}
          />
        )}
      </div>
    </div>
  );
}
