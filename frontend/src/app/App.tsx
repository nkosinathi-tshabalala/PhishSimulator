import { useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { AdminLoginPage } from './components/AdminLoginPage';
import { RegisterPage } from './components/RegisterPage';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { Dashboard } from './components/Dashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { EmailSimulation } from './components/EmailSimulation';
import { SMSSimulation } from './components/SMSSimulation';
import { BaselineQuiz } from './components/BaselineQuiz';
import { Analytics } from './components/Analytics';
import { AdminAnalytics } from './components/AdminAnalytics';
import { ProfilePage } from './components/ProfilePage';
import { SimulationsPage } from './components/SimulationsPage';
import { DatasetManagementPage } from './components/DatasetManagementPage';
import { ScenarioManagementPage } from './components/ScenarioManagementPage';
import { UserMonitoringPage } from './components/UserMonitoringPage';
import { EmailDispatcherPage } from './components/EmailDispatcherPage';
import { Sidebar } from './components/Sidebar';
import { AdminSidebar } from './components/AdminSidebar';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<'player' | 'admin'>('player');
  const [currentPage, setCurrentPage] = useState('landing');

  const handleLogin = (role: 'player' | 'admin') => {
    setIsLoggedIn(true);
    setUserRole(role);
    setCurrentPage(role === 'admin' ? 'admin-dashboard' : 'dashboard');
  };

  const handleRegister = () => {
    setIsLoggedIn(true);
    setUserRole('player');
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRole('player');
    setCurrentPage('landing');
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
  };

  // Public pages
  if (!isLoggedIn) {
    if (currentPage === 'landing') return <LandingPage onNavigate={handleNavigate} />;
    if (currentPage === 'login') return <LoginPage onLogin={handleLogin} onNavigate={handleNavigate} />;
    if (currentPage === 'admin-login') return <AdminLoginPage onLogin={handleLogin} onNavigate={handleNavigate} />;
    if (currentPage === 'register') return <RegisterPage onNavigate={handleNavigate} onRegister={handleRegister} />;
    if (currentPage === 'reset') return <ResetPasswordPage onNavigate={handleNavigate} />;
    return <LandingPage onNavigate={handleNavigate} />;
  }

  // Admin pages
  if (userRole === 'admin') {
    return (
      <div className="flex h-screen overflow-hidden">
        <AdminSidebar currentPage={currentPage} onNavigate={handleNavigate} onLogout={handleLogout} />
        <div className="flex-1 overflow-auto" style={{ backgroundColor: '#f0f4f8' }}>
          {currentPage === 'admin-dashboard' && <AdminDashboard onNavigate={handleNavigate} />}
          {currentPage === 'datasets' && <DatasetManagementPage onBack={() => handleNavigate('admin-dashboard')} />}
          {currentPage === 'scenarios' && <ScenarioManagementPage onBack={() => handleNavigate('admin-dashboard')} />}
          {currentPage === 'users' && <UserMonitoringPage onBack={() => handleNavigate('admin-dashboard')} />}
          {currentPage === 'analytics' && <AdminAnalytics onBack={() => handleNavigate('admin-dashboard')} />}
          {currentPage === 'email-dispatcher' && <EmailDispatcherPage onBack={() => handleNavigate('admin-dashboard')} />}
          {currentPage === 'settings' && <ProfilePage onBack={() => handleNavigate('admin-dashboard')} />}
        </div>
      </div>
    );
  }

  // Player pages
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar currentPage={currentPage} onNavigate={handleNavigate} onLogout={handleLogout} />
      <div className="flex-1 overflow-auto" style={{ backgroundColor: '#f0f4f8' }}>
        {currentPage === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
        {currentPage === 'quiz' && <BaselineQuiz onBack={() => handleNavigate('dashboard')} />}
        {currentPage === 'simulations' && <SimulationsPage onNavigate={handleNavigate} />}
        {currentPage === 'email' && <EmailSimulation onBack={() => handleNavigate('simulations')} />}
        {currentPage === 'sms' && <SMSSimulation onBack={() => handleNavigate('simulations')} />}
        {currentPage === 'performance' && <Analytics onBack={() => handleNavigate('dashboard')} />}
        {currentPage === 'profile' && <ProfilePage onBack={() => handleNavigate('dashboard')} />}
      </div>
    </div>
  );
}
