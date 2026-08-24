import { Home, Database, FileText, Users, BarChart3, Shield, LogOut, Send, ClipboardList, User } from 'lucide-react';

interface AdminSidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export function AdminSidebar({ currentPage, onNavigate, onLogout }: AdminSidebarProps) {
  const menuItems = [
    { id: 'admin-dashboard', label: 'Dashboard', icon: Home, description: 'Overview of platform activity' },
    { id: 'baseline-management', label: 'Baseline Questions', icon: ClipboardList, description: 'Edit the player baseline assessment' },
    { id: 'datasets', label: 'Manage Datasets', icon: Database, description: 'Upload and review training data' },
    { id: 'scenarios', label: 'Manage Scenarios', icon: FileText, description: 'Create and edit simulation scenarios' },
    { id: 'users', label: 'Manage Users', icon: Users, description: 'View and moderate registered players' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, description: 'Platform-wide performance insights' },
    { id: 'email-dispatcher', label: 'Email Campaign Manager', icon: Send, description: 'Launch email simulation campaigns' },
    { id: "admin-profile", label: "Admin Profile", icon: User, description: 'Manage your administrator account' },
  ];

  return (
    <div className="w-64 h-screen flex flex-col bg-[#05080c] text-slate-300 border-r border-white/10">
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 flex items-center justify-center border border-sky-400/30 bg-sky-400/10">
            <Shield className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h2 className="font-bold text-white text-sm leading-none tracking-[0.08em]">PHISHSIMULATOR</h2>
            <p className="text-xs mt-1 text-sky-400">Security operations</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 pt-5 space-y-1">
        <p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.14em] text-slate-500">ADMINISTRATION</p>
        {menuItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={item.description}
              className={`w-full flex items-center gap-3 border-l-2 px-3 py-2.5 text-sm font-medium transition-colors text-left ${isActive ? "border-sky-400 bg-white/8 text-white" : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 border-l-2 border-transparent px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors text-left hover:bg-red-400/10 hover:text-red-200"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Logout
        </button>
      </div>
    </div>
  );
}
