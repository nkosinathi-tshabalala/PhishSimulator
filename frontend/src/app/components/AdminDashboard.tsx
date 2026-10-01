// Admin page: home dashboard

import { useEffect, useState } from 'react';
import { Users, Database, FileText, Activity, BarChart3, Send, ChevronRight, TrendingUp, UserCheck, MousePointerClick } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import AnalyticsService from '../../services/analyticsService';
import { StatCard, type StatTone } from './StatCard';

interface AdminDashboardProps {
  onNavigate: (page: string) => void;
}

interface DashboardStats {
  total_users: number;
  registered_players: number;
  datasets: number;
  scenarios: number;
  active_scenarios: number;
  scenarios_awaiting_review: number;
  simulation_sessions: number;
  sessions_today: number;
  average_accuracy: number;
  campaigns_launched: number;
  campaign_emails_delivered: number;
  campaign_click_rate: number;
  campaign_report_rate: number;
  recent_activity: RecentActivity[];
}

interface RecentActivity {
  action: string;
  detail: string;
  occurred_at: string;
  type: 'user' | 'dataset' | 'scenario' | 'simulation';
}

// Where each kind of recent activity takes the admin when clicked
const ACTIVITY_PAGES: Record<string, string> = {
  user: "users",
  dataset: "datasets",
  scenario: "scenarios",
  simulation: "analytics",
};

/** Admin home: platform totals, recent activity and shortcuts. */
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

  // Each card opens the page it summarises
  const stats: Array<{ label: string; value: string | number | undefined; icon: typeof Users; tone: StatTone; delta: string; page: string }> = [
    { label: 'Total Users', value: dashboardStats?.total_users, icon: Users, tone: 'sky', delta: 'All registered accounts', page: 'users' },
    { label: 'Registered Players', value: dashboardStats?.registered_players, icon: UserCheck, tone: 'green', delta: 'Player accounts', page: 'users' },
    { label: 'Datasets', value: dashboardStats?.datasets, icon: Database, tone: 'violet', delta: 'Uploaded datasets', page: 'datasets' },
    { label: 'Scenarios', value: dashboardStats?.scenarios, icon: FileText, tone: 'blue', delta: `${dashboardStats?.active_scenarios ?? 0} active · ${dashboardStats?.scenarios_awaiting_review ?? 0} awaiting review`, page: 'scenarios' },
    { label: 'Simulation Sessions', value: dashboardStats?.simulation_sessions, icon: Activity, tone: 'amber', delta: `+${dashboardStats?.sessions_today ?? 0} today`, page: 'analytics' },
    { label: 'Average Accuracy', value: dashboardStats ? `${dashboardStats.average_accuracy}%` : undefined, icon: BarChart3, tone: 'orange', delta: 'Training and campaigns', page: 'analytics' },
    { label: 'Email Campaigns', value: dashboardStats?.campaigns_launched, icon: Send, tone: 'pink', delta: `${dashboardStats?.campaign_emails_delivered ?? 0} emails delivered`, page: 'email-dispatcher' },
    { label: 'Campaign Click Rate', value: dashboardStats ? `${dashboardStats.campaign_click_rate}%` : undefined, icon: MousePointerClick, tone: 'red', delta: `${dashboardStats?.campaign_report_rate ?? 0}% reported instead`, page: 'email-dispatcher' },
  ];

  const shortcuts = [
    { label: 'Manage Datasets', icon: Database, page: 'datasets', description: 'Upload, generate, and manage training datasets' },
    { label: 'Scenario Review', icon: FileText, page: 'scenarios', description: 'Approve drafts with the QA checklist and activate them' },
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Administrator Dashboard</h1>
          <p className="text-sm mt-1 text-muted-foreground">Manage the PhishSimulator platform</p>
        </div>
        <Badge className="text-xs px-3 py-1 border-0" style={{ backgroundColor: '#f2cc60', color: '#04121c' }}>
          Admin Mode
        </Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            hint={stat.delta}
            icon={stat.icon}
            tone={stat.tone}
            onClick={() => onNavigate(stat.page)}
          />
        ))}
      </div>

      {statsError && (
        <p className="text-sm" style={{ color: '#f85149' }}>
          Dashboard metrics could not be loaded.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-foreground">Recent Activity</CardTitle>
              <CardDescription>Latest platform events</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {dashboardStats?.recent_activity.length ? dashboardStats.recent_activity.map((item) => (
                <button
                  type="button"
                  key={`${item.type}-${item.occurred_at}-${item.detail}`}
                  onClick={() => onNavigate(ACTIVITY_PAGES[item.type] ?? "admin-dashboard")}
                  className="flex w-full items-start gap-3 rounded-md p-2 -mx-2 text-left transition-colors hover:bg-white/5"
                >
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: typeColor[item.type]?.color || '#8b949e' }} />
                  <div>
                    <div className="text-sm font-medium text-foreground">{item.action}</div>
                    <div className="text-xs text-muted-foreground">{item.detail}</div>
                    <div className="text-xs mt-0.5 text-muted-foreground">{formatActivityTime(item.occurred_at)}</div>
                  </div>
                </button>
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
