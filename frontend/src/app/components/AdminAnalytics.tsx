import { useEffect, useState } from 'react';
import { Users, Activity, Target, Database, Mail, MessageSquare, AlertTriangle, TrendingUp, BarChart3, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import AnalyticsService from '../../services/analyticsService';

interface AdminAnalyticsProps {
  onBack: () => void;
}

interface SimulationBreakdown {
  type: string;
  total: number;
  rate: number;
  icon: LucideIcon;
  color: string;
}

export function AdminAnalytics({ onBack }: AdminAnalyticsProps) {
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    AnalyticsService.getAdminAnalytics().then((response) => {
      if (response.ok) setAnalytics(response.data.data);
    }).catch((error) => console.error('Unable to load administrator analytics.', error));
  }, []);

  const platformStats = [
    { label: 'Total Simulations', value: analytics?.total_simulations, icon: Activity, color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
    { label: 'Average Accuracy', value: analytics ? `${analytics.average_accuracy}%` : undefined, icon: Target, color: '#3fb950', bg: 'rgba(63,185,80,0.12)' },
    { label: 'Avg. Baseline Score', value: analytics ? `${analytics.average_baseline_score}%` : undefined, icon: BarChart3, color: '#2f81f7', bg: 'rgba(47,129,247,0.12)' },
    { label: 'Active Users (7d)', value: analytics?.active_users_7d, icon: Users, color: '#bc8cff', bg: 'rgba(188,140,255,0.12)' },
  ];

  const simulationBreakdown: SimulationBreakdown[] = (analytics?.by_type || []).map((item: any) => ({
    type: item.type === 'EMAIL' ? 'Email Simulations' : 'SMS Simulations',
    total: item.attempts,
    rate: item.accuracy,
    icon: item.type === 'EMAIL' ? Mail : MessageSquare,
    color: item.type === 'EMAIL' ? '#38bdf8' : '#bc8cff',
  }));
  const maxActivity = Math.max(...(analytics?.activity || []).map((day: any) => day.attempts), 1);

  return (
    <div className="h-full flex flex-col">
      <div className="border-b p-4 flex items-center gap-4 bg-card">
        <div>
          <h2 className="text-xl font-semibold text-foreground">System Analytics</h2>
          <p className="text-sm text-muted-foreground">Platform-wide statistics — not individual player data</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Platform stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {platformStats.map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className="w-9 h-9 rounded-md flex items-center justify-center mb-3" style={{ backgroundColor: s.bg }}>
                  <s.icon className="w-4 h-4" style={{ color: s.color }} />
                </div>
                <div className="text-2xl font-bold text-foreground">{s.value ?? '...'}</div>
                <div className="text-xs mt-0.5 text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Simulation statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-foreground">Simulation Statistics</CardTitle>
            <CardDescription>Email vs SMS completion and accuracy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {simulationBreakdown.map((sim) => (
              <div key={sim.type}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <sim.icon className="w-4 h-4" style={{ color: sim.color }} />
                    <span className="text-sm font-medium text-foreground">{sim.type}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold text-foreground">{sim.rate}%</span>
                    <span className="text-xs ml-2 text-muted-foreground">{sim.total.toLocaleString()} completed</span>
                  </div>
                </div>
                <Progress value={sim.rate} className="h-2.5" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Key insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-foreground">Most Difficult Scenario</CardTitle>
              <CardDescription>Highest fail rate in recent sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-md" style={{ backgroundColor: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.25)' }}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#f85149' }} />
                  <div>
                    <div className="font-semibold text-sm text-foreground">{analytics?.most_difficult?.title ?? 'No scenario attempts yet'}</div>
                    <div className="text-xs mt-1 text-muted-foreground">{analytics?.most_difficult ? `Category: ${analytics.most_difficult.category} · Difficulty: ${analytics.most_difficult.difficulty}` : 'Complete simulations to identify difficult scenarios.'}</div>
                    <div className="flex items-center gap-3 mt-3">
                      <div>
                        <div className="text-lg font-bold" style={{ color: '#f85149' }}>{analytics?.most_difficult?.success_rate ?? 0}%</div>
                        <div className="text-xs text-muted-foreground">Success rate</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-foreground">{analytics?.most_difficult?.attempts ?? 0}</div>
                        <div className="text-xs text-muted-foreground">Attempts</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base text-foreground">Most Missed Phishing Cue</CardTitle>
              <CardDescription>What players miss most often</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-md" style={{ backgroundColor: 'rgba(242,204,96,0.08)', border: '1px solid rgba(242,204,96,0.25)' }}>
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#f2cc60' }} />
                  <div>
                    <div className="font-semibold text-sm text-foreground">{analytics?.most_missed_cue?.cue ?? 'No missed cue data yet'}</div>
                    <div className="text-xs mt-1 text-muted-foreground">Derived from incorrect attempts on scenarios containing this cue.</div>
                    <div className="flex items-center gap-3 mt-3">
                      <div>
                        <div className="text-lg font-bold" style={{ color: '#f2cc60' }}>{analytics?.most_missed_cue?.miss_rate ?? 0}%</div>
                        <div className="text-xs text-muted-foreground">Miss rate</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-foreground">{analytics?.most_missed_cue?.missed_count ?? 0}</div>
                        <div className="text-xs text-muted-foreground">Times missed</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dataset Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-foreground">Dataset Usage</CardTitle>
            <CardDescription>How datasets are being utilised across simulations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left pb-3 text-xs font-medium text-muted-foreground">Dataset</th>
                    <th className="text-right pb-3 text-xs font-medium text-muted-foreground">Records</th>
                    <th className="text-right pb-3 text-xs font-medium text-muted-foreground">Processed Records</th>
                    <th className="text-right pb-3 text-xs font-medium text-muted-foreground">Processing Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics?.datasets || []).map((d: any) => (
                    <tr key={d.name} className="border-b border-border last:border-b-0">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Database className="w-3.5 h-3.5 shrink-0" style={{ color: '#bc8cff' }} />
                          <span className="font-medium text-xs text-foreground">{d.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right text-xs text-muted-foreground">{d.records}</td>
                      <td className="py-3 text-right text-xs text-muted-foreground">{d.processed_records}</td>
                      <td className="py-3 text-right">
                        <Badge
                          className="text-xs border-0"
                          style={{
                            backgroundColor: 'rgba(56,189,248,0.12)',
                            color: '#38bdf8',
                          }}
                        >
                          {d.processed_records} processed
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {!analytics?.datasets?.length && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No datasets uploaded yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* System Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-foreground">System Activity (Last 5 Days)</CardTitle>
            <CardDescription>Daily sessions and new user registrations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(analytics?.activity || []).map((day: any) => (
                <div key={day.date} className="flex items-center gap-4">
                  <div className="w-20 text-xs font-medium text-muted-foreground">{day.date}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Attempts: {day.attempts}</span>
                      <span className="text-xs text-muted-foreground">+{day.new_users} new users</span>
                    </div>
                    <Progress value={(day.attempts / maxActivity) * 100} className="h-2" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
