import { Home, Mail, BarChart3, User, Shield, LogOut, ClipboardList, Activity } from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export function Sidebar({ currentPage, onNavigate, onLogout }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, description: 'Your progress at a glance' },
    { id: 'quiz', label: 'Baseline Assessment', icon: ClipboardList, description: 'Take the initial skills assessment' },
    { id: 'simulations', label: 'Simulations', icon: Mail, description: 'Practice spotting phishing emails and texts' },
    { id: 'performance', label: 'Performance', icon: Activity, description: 'Review your scores and history' },
    { id: 'profile', label: 'Profile', icon: User, description: 'Manage your account details' },
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
            <p className="text-xs mt-1 text-slate-500">Learner workspace</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 pt-5 space-y-1">
        <p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.14em] text-slate-500">WORKSPACE</p>
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
