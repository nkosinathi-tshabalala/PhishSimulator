import { Award, Mail, MessageSquare, Target, TrendingUp, AlertTriangle, CheckCircle2, ClipboardList, Activity, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const stats = [
    { label: 'Overall Accuracy', value: '78%', icon: Target, color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)' },
    { label: 'False Positives', value: '12%', icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    { label: 'False Negatives', value: '8%', icon: AlertTriangle, color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
    { label: 'Simulations Done', value: '35', icon: CheckCircle2, color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
  ];

  const quickActions = [
    { label: 'Start Baseline Assessment', icon: ClipboardList, page: 'quiz', description: 'Evaluate your current knowledge' },
    { label: 'Email Simulation', icon: Mail, page: 'email', description: 'Identify phishing emails' },
    { label: 'SMS Simulation', icon: MessageSquare, page: 'sms', description: 'Detect smishing attacks' },
    { label: 'View Performance', icon: Activity, page: 'performance', description: 'Track your progress' },
  ];

  const recentActivity = [
    { type: 'Email', result: 'Correct', scenario: 'PayPal Account Suspended', time: '2 hours ago', success: true },
    { type: 'SMS', result: 'Incorrect', scenario: 'Bank Verification Text', time: '5 hours ago', success: false },
    { type: 'Email', result: 'Correct', scenario: 'IT Department Password Reset', time: 'Yesterday', success: true },
    { type: 'Email', result: 'Correct', scenario: 'Amazon Order Confirmation', time: 'Yesterday', success: true },
  ];

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0f2240' }}>Welcome back, John Doe</h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>Continue your phishing awareness training</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="text-white text-xs px-3 py-1" style={{ backgroundColor: '#0ea5e9' }}>
            Level 3
          </Badge>
          <Badge variant="outline" className="text-xs px-3 py-1" style={{ color: '#1e3a5f', borderColor: '#1e3a5f' }}>
            Rank #12
          </Badge>
        </div>
      </div>

      {/* Profile Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-xl" style={{ backgroundColor: '#1e3a5f' }}>
        {[
          { label: 'Current Level', value: '3' },
          { label: 'Baseline Score', value: '82%' },
          { label: 'Current Difficulty', value: 'Medium' },
          { label: 'Current Rank', value: '#12' },
        ].map((item) => (
          <div key={item.label} className="text-center">
            <div className="text-2xl font-bold text-white">{item.value}</div>
            <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: stat.bg }}>
                  <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                </div>
              </div>
              <div className="text-2xl font-bold" style={{ color: '#0f2240' }}>{stat.value}</div>
              <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <Card className="border-0 shadow-sm h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base" style={{ color: '#0f2240' }}>Quick Actions</CardTitle>
              <CardDescription>Jump into a training session</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => onNavigate(action.page)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left hover:shadow-sm group"
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
                      <action.icon className="w-4 h-4" style={{ color: '#1e3a5f' }} />
                    </div>
                    <div>
                      <div className="text-sm font-medium" style={{ color: '#0f2240' }}>{action.label}</div>
                      <div className="text-xs" style={{ color: '#94a3b8' }}>{action.description}</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4" style={{ color: '#94a3b8' }} />
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Progress & Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Adaptive Progress */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base" style={{ color: '#0f2240' }}>Adaptive Learning Progress</CardTitle>
                <Badge className="text-xs" style={{ backgroundColor: 'rgba(14,165,233,0.1)', color: '#0ea5e9' }}>
                  Medium Difficulty
                </Badge>
              </div>
              <CardDescription>Progress toward next level</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span style={{ color: '#64748b' }}>Level 3 Progress</span>
                  <span className="font-medium" style={{ color: '#0f2240' }}>78 / 100 XP</span>
                </div>
                <Progress value={78} className="h-2.5" />
              </div>
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#f0f4f8' }}>
                  <div className="font-bold text-lg" style={{ color: '#16a34a' }}>27</div>
                  <div className="text-xs" style={{ color: '#64748b' }}>Correct</div>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#f0f4f8' }}>
                  <div className="font-bold text-lg" style={{ color: '#f59e0b' }}>4</div>
                  <div className="text-xs" style={{ color: '#64748b' }}>False +</div>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#f0f4f8' }}>
                  <div className="font-bold text-lg" style={{ color: '#dc2626' }}>3</div>
                  <div className="text-xs" style={{ color: '#64748b' }}>False -</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base" style={{ color: '#0f2240' }}>Recent Simulations</CardTitle>
                <button
                  onClick={() => onNavigate('performance')}
                  className="text-xs font-medium"
                  style={{ color: '#0ea5e9' }}
                >
                  View All
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-2">
                {recentActivity.map((activity, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b last:border-b-0" style={{ borderColor: '#f1f5f9' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: activity.type === 'Email' ? 'rgba(14,165,233,0.1)' : 'rgba(139,92,246,0.1)' }}>
                        {activity.type === 'Email'
                          ? <Mail className="w-3.5 h-3.5" style={{ color: '#0ea5e9' }} />
                          : <MessageSquare className="w-3.5 h-3.5" style={{ color: '#8b5cf6' }} />
                        }
                      </div>
                      <div>
                        <div className="text-sm font-medium" style={{ color: '#0f2240' }}>{activity.scenario}</div>
                        <div className="text-xs" style={{ color: '#94a3b8' }}>{activity.time}</div>
                      </div>
                    </div>
                    <Badge
                      className="text-xs"
                      style={{
                        backgroundColor: activity.success ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
                        color: activity.success ? '#16a34a' : '#dc2626',
                      }}
                    >
                      {activity.result}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
