import { Users, Activity, Target, Database, Mail, MessageSquare, AlertTriangle, TrendingUp, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';

interface AdminAnalyticsProps {
  onBack: () => void;
}

export function AdminAnalytics({ onBack }: AdminAnalyticsProps) {
  const platformStats = [
    { label: 'Total Simulations', value: '4,567', icon: Activity, color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)' },
    { label: 'Average Accuracy', value: '76%', icon: Target, color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
    { label: 'Avg. Baseline Score', value: '71%', icon: BarChart3, color: '#1e3a5f', bg: 'rgba(30,58,95,0.1)' },
    { label: 'Active Users (7d)', value: '89', icon: Users, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  ];

  const simulationBreakdown = [
    { type: 'Email Simulations', total: 3245, rate: 76, icon: Mail, color: '#0ea5e9' },
    { type: 'SMS Simulations', total: 1322, rate: 80, icon: MessageSquare, color: '#8b5cf6' },
  ];

  const datasetUsage = [
    { name: 'corporate_phishing_v1.csv', uses: 1243, scenarios: 18, accuracy: 74 },
    { name: 'smishing_dataset_2024.json', uses: 867, scenarios: 12, accuracy: 81 },
    { name: 'advanced_email_threats.csv', uses: 512, scenarios: 9, accuracy: 68 },
    { name: 'basic_phishing_intro.csv', uses: 389, scenarios: 7, accuracy: 89 },
  ];

  const systemActivity = [
    { date: 'Jun 30', sessions: 48, newUsers: 3 },
    { date: 'Jun 29', sessions: 61, newUsers: 5 },
    { date: 'Jun 28', sessions: 34, newUsers: 2 },
    { date: 'Jun 27', sessions: 72, newUsers: 8 },
    { date: 'Jun 26', sessions: 55, newUsers: 4 },
  ];

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: '#f0f4f8' }}>
      <div className="border-b p-4 flex items-center gap-4 bg-white">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: '#0f2240' }}>System Analytics</h2>
          <p className="text-sm" style={{ color: '#64748b' }}>Platform-wide statistics — not individual player data</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Platform stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {platformStats.map((s) => (
            <Card key={s.label} className="border-0 shadow-sm bg-white">
              <CardContent className="p-4">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: s.bg }}>
                  <s.icon className="w-4 h-4" style={{ color: s.color }} />
                </div>
                <div className="text-2xl font-bold" style={{ color: '#0f2240' }}>{s.value}</div>
                <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Simulation statistics */}
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-base" style={{ color: '#0f2240' }}>Simulation Statistics</CardTitle>
            <CardDescription>Email vs SMS completion and accuracy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {simulationBreakdown.map((sim) => (
              <div key={sim.type}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <sim.icon className="w-4 h-4" style={{ color: sim.color }} />
                    <span className="text-sm font-medium" style={{ color: '#0f2240' }}>{sim.type}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold" style={{ color: '#0f2240' }}>{sim.rate}%</span>
                    <span className="text-xs ml-2" style={{ color: '#94a3b8' }}>{sim.total.toLocaleString()} completed</span>
                  </div>
                </div>
                <Progress value={sim.rate} className="h-2.5" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Key insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="text-base" style={{ color: '#0f2240' }}>Most Difficult Scenario</CardTitle>
              <CardDescription>Highest fail rate in recent sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.15)' }}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
                  <div>
                    <div className="font-semibold text-sm" style={{ color: '#0f2240' }}>CEO Wire Transfer Request</div>
                    <div className="text-xs mt-1" style={{ color: '#64748b' }}>Category: Business Email Compromise · Difficulty: Hard</div>
                    <div className="flex items-center gap-3 mt-3">
                      <div>
                        <div className="text-lg font-bold" style={{ color: '#dc2626' }}>34%</div>
                        <div className="text-xs" style={{ color: '#94a3b8' }}>Success rate</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold" style={{ color: '#0f2240' }}>287</div>
                        <div className="text-xs" style={{ color: '#94a3b8' }}>Attempts</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="text-base" style={{ color: '#0f2240' }}>Most Missed Phishing Cue</CardTitle>
              <CardDescription>What players miss most often</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                  <div>
                    <div className="font-semibold text-sm" style={{ color: '#0f2240' }}>Lookalike Domain Names</div>
                    <div className="text-xs mt-1" style={{ color: '#64748b' }}>e.g. paypa1.com, arnazon.com, micros0ft.net</div>
                    <div className="flex items-center gap-3 mt-3">
                      <div>
                        <div className="text-lg font-bold" style={{ color: '#f59e0b' }}>61%</div>
                        <div className="text-xs" style={{ color: '#94a3b8' }}>Miss rate</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold" style={{ color: '#0f2240' }}>1,104</div>
                        <div className="text-xs" style={{ color: '#94a3b8' }}>Times missed</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dataset Usage */}
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-base" style={{ color: '#0f2240' }}>Dataset Usage</CardTitle>
            <CardDescription>How datasets are being utilised across simulations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: '#f1f5f9' }}>
                    <th className="text-left pb-3 text-xs font-medium" style={{ color: '#94a3b8' }}>Dataset</th>
                    <th className="text-right pb-3 text-xs font-medium" style={{ color: '#94a3b8' }}>Scenario Uses</th>
                    <th className="text-right pb-3 text-xs font-medium" style={{ color: '#94a3b8' }}>Sessions</th>
                    <th className="text-right pb-3 text-xs font-medium" style={{ color: '#94a3b8' }}>Avg. Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {datasetUsage.map((d, i) => (
                    <tr key={i} className="border-b last:border-b-0" style={{ borderColor: '#f1f5f9' }}>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Database className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#8b5cf6' }} />
                          <span className="font-medium text-xs" style={{ color: '#0f2240' }}>{d.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right text-xs" style={{ color: '#64748b' }}>{d.scenarios}</td>
                      <td className="py-3 text-right text-xs" style={{ color: '#64748b' }}>{d.uses.toLocaleString()}</td>
                      <td className="py-3 text-right">
                        <Badge
                          className="text-xs"
                          style={{
                            backgroundColor: d.accuracy >= 80 ? 'rgba(22,163,74,0.1)' : d.accuracy >= 70 ? 'rgba(245,158,11,0.1)' : 'rgba(220,38,38,0.1)',
                            color: d.accuracy >= 80 ? '#16a34a' : d.accuracy >= 70 ? '#f59e0b' : '#dc2626',
                          }}
                        >
                          {d.accuracy}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* System Activity */}
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-base" style={{ color: '#0f2240' }}>System Activity (Last 5 Days)</CardTitle>
            <CardDescription>Daily sessions and new user registrations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {systemActivity.map((day, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-14 text-xs font-medium" style={{ color: '#64748b' }}>{day.date}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs" style={{ color: '#94a3b8' }}>Sessions: {day.sessions}</span>
                      <span className="text-xs" style={{ color: '#94a3b8' }}>+{day.newUsers} new users</span>
                    </div>
                    <Progress value={(day.sessions / 80) * 100} className="h-2" />
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
