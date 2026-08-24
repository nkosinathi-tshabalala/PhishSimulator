import { useEffect, useState } from 'react';
import { Users, Database, FileText, Activity, BarChart3, Send, ChevronRight, TrendingUp, UserCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import AnalyticsService from '../../services/analyticsService';

interface AdminDashboardProps {
  onNavigate: (page: string) => void;
}

interface DashboardStats {
  total_users: number;
  registered_players: number;
  datasets: number;
  scenarios: number;
  active_scenarios: number;
  simulation_sessions: number;
  sessions_today: number;
  average_accuracy: number;
  recent_activity: RecentActivity[];
}

interface RecentActivity {
  action: string;
  detail: string;
  occurred_at: string;
  type: 'user' | 'dataset' | 'scenario' | 'simulation';
}

export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    const loadDashboardStats = async () => {
      try {
        const response = await AnalyticsService.getAdminDashboardStats();

        if (response.ok) {
          setDashboardStats(response.data.data);
          return;
        }
      } catch (error) {
        console.error('Unable to load administrator dashboard statistics.', error);
      }

      setStatsError(true);
    };

    loadDashboardStats();
  }, []);

  const stats = [
    { label: 'Total Users', value: dashboardStats?.total_users, icon: Users, color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', delta: 'All registered accounts' },
    { label: 'Registered Players', value: dashboardStats?.registered_players, icon: UserCheck, color: '#3fb950', bg: 'rgba(63,185,80,0.12)', delta: 'Player accounts' },
    { label: 'Datasets', value: dashboardStats?.datasets, icon: Database, color: '#bc8cff', bg: 'rgba(188,140,255,0.12)', delta: 'Uploaded datasets' },
    { label: 'Scenarios', value: dashboardStats?.scenarios, icon: FileText, color: '#2f81f7', bg: 'rgba(47,129,247,0.12)', delta: `${dashboardStats?.active_scenarios ?? 0} active` },
    { label: 'Simulation Sessions', value: dashboardStats?.simulation_sessions, icon: Activity, color: '#f2cc60', bg: 'rgba(242,204,96,0.12)', delta: `+${dashboardStats?.sessions_today ?? 0} today` },
    { label: 'Average Accuracy', value: dashboardStats ? `${dashboardStats.average_accuracy}%` : undefined, icon: BarChart3, color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', delta: 'Platform-wide' },
  ];

  const shortcuts = [
    { label: 'Manage Datasets', icon: Database, page: 'datasets', description: 'Upload, generate, and manage training datasets' },
    { label: 'Manage Scenarios', icon: FileText, page: 'scenarios', description: 'Create, edit, and preview phishing scenarios' },
    { label: 'Manage Users', icon: Users, page: 'users', description: 'Monitor player profiles and activity' },
    { label: 'System Analytics', icon: TrendingUp, page: 'analytics', description: 'Platform-wide statistics and insights' },
    { label: 'Email Campaign Manager', icon: Send, page: 'email-dispatcher', description: 'Send phishing simulations via SMTP' },
  ];

  const typeColor: Record<string, { bg: string; color: string }> = {
    user: { bg: 'rgba(63,185,80,0.12)', color: '#3fb950' },
    dataset: { bg: 'rgba(188,140,255,0.12)', color: '#bc8cff' },
    scenario: { bg: 'rgba(56,189,248,0.12)', color: '#38bdf8' },
    simulation: { bg: 'rgba(242,204,96,0.12)', color: '#f2cc60' },
  };

  const formatActivityTime = (occurredAt: string) => {
    const elapsedMinutes = Math.floor((Date.now() - new Date(occurredAt).getTime()) / 60000);

    if (elapsedMinutes < 1) return 'Just now';
    if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;
    if (elapsedMinutes < 1440) return `${Math.floor(elapsedMinutes / 60)} hour${elapsedMinutes >= 120 ? 's' : ''} ago`;
    return `${Math.floor(elapsedMinutes / 1440)} day${elapsedMinutes >= 2880 ? 's' : ''} ago`;
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Administrator Dashboard</h1>
          <p className="text-sm mt-1 text-muted-foreground">Manage the PhishSimulator platform</p>
        </div>
        <Badge className="text-xs px-3 py-1 border-0" style={{ backgroundColor: '#f2cc60', color: '#04121c' }}>
          Admin Mode
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ backgroundColor: stat.bg }}>
                  <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                </div>
              </div>
              <div className="text-2xl font-bold text-foreground">{stat.value ?? '...'}</div>
              <div className="text-xs mt-0.5 text-muted-foreground">{stat.label}</div>
              <div className="text-xs mt-1 font-medium" style={{ color: stat.color }}>{stat.delta}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {statsError && (
        <p className="text-sm" style={{ color: '#f85149' }}>
          Dashboard metrics could not be loaded.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shortcuts */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-foreground">Management Tools</CardTitle>
              <CardDescription>Quick access to admin functions</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              {shortcuts.map((s) => (
                <button
                  key={s.label}
                  onClick={() => onNavigate(s.page)}
                  className="w-full flex items-center justify-between p-3 rounded-md border border-border text-left transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md flex items-center justify-center bg-muted">
                      <s.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">{s.label}</div>
                      <div className="text-xs text-muted-foreground">{s.description}</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-foreground">Recent Activity</CardTitle>
              <CardDescription>Latest platform events</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {dashboardStats?.recent_activity.length ? dashboardStats.recent_activity.map((item) => (
                <div key={`${item.type}-${item.occurred_at}-${item.detail}`} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: typeColor[item.type]?.color || '#8b949e' }} />
                  <div>
                    <div className="text-sm font-medium text-foreground">{item.action}</div>
                    <div className="text-xs text-muted-foreground">{item.detail}</div>
                    <div className="text-xs mt-0.5 text-muted-foreground">{formatActivityTime(item.occurred_at)}</div>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">No platform activity yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
