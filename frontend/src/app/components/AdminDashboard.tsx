import { Users, Database, FileText, Activity, BarChart3, Send, ChevronRight, TrendingUp, UserCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface AdminDashboardProps {
  onNavigate: (page: string) => void;
}

export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const stats = [
    { label: 'Total Users', value: '142', icon: Users, color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)', delta: '+8 this week' },
    { label: 'Registered Players', value: '138', icon: UserCheck, color: '#16a34a', bg: 'rgba(22,163,74,0.1)', delta: '97% of users' },
    { label: 'Datasets', value: '24', icon: Database, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', delta: '3 added recently' },
    { label: 'Scenarios', value: '53', icon: FileText, color: '#1e3a5f', bg: 'rgba(30,58,95,0.1)', delta: '12 active' },
    { label: 'Simulation Sessions', value: '4,567', icon: Activity, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', delta: '+124 today' },
    { label: 'Average Accuracy', value: '76%', icon: BarChart3, color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)', delta: 'Platform-wide' },
  ];

  const shortcuts = [
    { label: 'Manage Datasets', icon: Database, page: 'datasets', description: 'Upload, generate, and manage training datasets' },
    { label: 'Manage Scenarios', icon: FileText, page: 'scenarios', description: 'Create, edit, and preview phishing scenarios' },
    { label: 'Manage Users', icon: Users, page: 'users', description: 'Monitor player profiles and activity' },
    { label: 'System Analytics', icon: TrendingUp, page: 'analytics', description: 'Platform-wide statistics and insights' },
    { label: 'Email Dispatcher', icon: Send, page: 'email-dispatcher', description: 'Send phishing simulations via SMTP' },
  ];

  const recentActivity = [
    { action: 'New user registered', detail: 'jane.smith@example.com', time: '10 min ago', type: 'user' },
    { action: 'Dataset uploaded', detail: 'advanced_email_phishing_v2.csv', time: '1 hour ago', type: 'dataset' },
    { action: 'Scenario created', detail: 'Corporate Invoice Fraud – Hard', time: '3 hours ago', type: 'scenario' },
    { action: 'Simulation completed', detail: '14 players completed Email Sim #7', time: '5 hours ago', type: 'simulation' },
  ];

  const typeColor: Record<string, { bg: string; color: string }> = {
    user: { bg: 'rgba(22,163,74,0.1)', color: '#16a34a' },
    dataset: { bg: 'rgba(139,92,246,0.1)', color: '#8b5cf6' },
    scenario: { bg: 'rgba(14,165,233,0.1)', color: '#0ea5e9' },
    simulation: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full" style={{ backgroundColor: '#f0f4f8' }}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0f2240' }}>Administrator Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>Manage the PhishSimulator platform</p>
        </div>
        <Badge className="text-xs px-3 py-1 text-white" style={{ backgroundColor: '#f59e0b' }}>
          Admin Mode
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-0 shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: stat.bg }}>
                  <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                </div>
              </div>
              <div className="text-2xl font-bold" style={{ color: '#0f2240' }}>{stat.value}</div>
              <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>{stat.label}</div>
              <div className="text-xs mt-1 font-medium" style={{ color: stat.color }}>{stat.delta}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shortcuts */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base" style={{ color: '#0f2240' }}>Management Tools</CardTitle>
              <CardDescription>Quick access to admin functions</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              {shortcuts.map((s) => (
                <button
                  key={s.label}
                  onClick={() => onNavigate(s.page)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all"
                  style={{ borderColor: '#e2e8f0' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#0ea5e9';
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(14,165,233,0.04)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0';
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgba(30,58,95,0.08)' }}>
                      <s.icon className="w-4 h-4" style={{ color: '#1e3a5f' }} />
                    </div>
                    <div>
                      <div className="text-sm font-medium" style={{ color: '#0f2240' }}>{s.label}</div>
                      <div className="text-xs" style={{ color: '#94a3b8' }}>{s.description}</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: '#94a3b8' }} />
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-1">
          <Card className="border-0 shadow-sm bg-white h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base" style={{ color: '#0f2240' }}>Recent Activity</CardTitle>
              <CardDescription>Latest platform events</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: typeColor[item.type]?.color || '#94a3b8' }} />
                  <div>
                    <div className="text-sm font-medium" style={{ color: '#0f2240' }}>{item.action}</div>
                    <div className="text-xs" style={{ color: '#64748b' }}>{item.detail}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{item.time}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
