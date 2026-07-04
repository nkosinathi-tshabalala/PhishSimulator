import { Target, AlertTriangle, TrendingUp, Award, BarChart3, Activity, ChevronUp, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';

interface AnalyticsProps {
  onBack: () => void;
}

export function Analytics({ onBack }: AnalyticsProps) {
  const detectionStats = [
    { category: 'Email Phishing', attempts: 22, correct: 18, rate: 82 },
    { category: 'SMS / Smishing', attempts: 13, correct: 10, rate: 77 },
  ];

  const recentFeedback = [
    { scenario: 'PayPal Account Suspended', type: 'Email', result: 'Correct', note: 'Correctly identified urgency language and domain spoof.', date: '2 hours ago' },
    { scenario: 'Bank Verification Text', type: 'SMS', result: 'Incorrect', note: 'Missed the shortened URL and unknown sender indicators.', date: '5 hours ago' },
    { scenario: 'IT Password Reset', type: 'Email', result: 'Correct', note: 'Recognised internal spoofing attempt.', date: 'Yesterday' },
  ];

  const simulationHistory = [
    { date: 'Jun 30', email: 3, sms: 1, accuracy: 80 },
    { date: 'Jun 29', email: 4, sms: 2, accuracy: 75 },
    { date: 'Jun 28', email: 2, sms: 1, accuracy: 85 },
    { date: 'Jun 27', email: 5, sms: 0, accuracy: 70 },
  ];

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: '#f0f4f8' }}>
      <div className="border-b p-4 flex items-center gap-4 bg-white">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: '#0f2240' }}>My Performance</h2>
          <p className="text-sm" style={{ color: '#64748b' }}>Personal training statistics and progress</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Overall Accuracy', value: '78%', icon: Target, color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)', trend: '+3% this week' },
            { label: 'Baseline Score', value: '82%', icon: Award, color: '#16a34a', bg: 'rgba(22,163,74,0.1)', trend: 'Assessed 5 days ago' },
            { label: 'Correct Decisions', value: '27', icon: Activity, color: '#1e3a5f', bg: 'rgba(30,58,95,0.1)', trend: 'of 35 simulations' },
            { label: 'Current Difficulty', value: 'Medium', icon: BarChart3, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', trend: 'Adaptive engine' },
          ].map((s) => (
            <Card key={s.label} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: s.bg }}>
                  <s.icon className="w-4 h-4" style={{ color: s.color }} />
                </div>
                <div className="text-2xl font-bold" style={{ color: '#0f2240' }}>{s.value}</div>
                <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>{s.label}</div>
                <div className="text-xs mt-1" style={{ color: s.color }}>{s.trend}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Error rates and ranking */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base" style={{ color: '#0f2240' }}>Error Rate Analysis</CardTitle>
              <CardDescription>False positives and false negatives</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: '#0f2240' }}>False Positives</span>
                  <span className="text-sm" style={{ color: '#f59e0b' }}>12%</span>
                </div>
                <Progress value={12} className="h-2" />
                <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>Safe emails you marked as phishing</p>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: '#0f2240' }}>False Negatives</span>
                  <span className="text-sm" style={{ color: '#dc2626' }}>8%</span>
                </div>
                <Progress value={8} className="h-2" />
                <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>Phishing emails you marked as safe</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base" style={{ color: '#0f2240' }}>Ranking & Adaptive Status</CardTitle>
              <CardDescription>Private ranking and engine status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: '#f0f4f8' }}>
                <div>
                  <div className="text-sm font-medium" style={{ color: '#0f2240' }}>Private Rank</div>
                  <div className="text-xs" style={{ color: '#64748b' }}>Among all players</div>
                </div>
                <div className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>#12</div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: '#f0f4f8' }}>
                <div>
                  <div className="text-sm font-medium" style={{ color: '#0f2240' }}>Adaptive Engine</div>
                  <div className="text-xs" style={{ color: '#64748b' }}>Learning adjustment</div>
                </div>
                <Badge className="text-xs" style={{ backgroundColor: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                  Active
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: '#f0f4f8' }}>
                <div>
                  <div className="text-sm font-medium" style={{ color: '#0f2240' }}>XP Level</div>
                  <div className="text-xs" style={{ color: '#64748b' }}>Current level progress</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold" style={{ color: '#1e3a5f' }}>Level 3</div>
                  <div className="text-xs" style={{ color: '#94a3b8' }}>78 / 100 XP</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detection by type */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base" style={{ color: '#0f2240' }}>Performance by Simulation Type</CardTitle>
            <CardDescription>Accuracy across email and SMS scenarios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {detectionStats.map((stat) => (
              <div key={stat.category}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-medium" style={{ color: '#0f2240' }}>{stat.category}</span>
                    <span className="text-xs ml-2" style={{ color: '#94a3b8' }}>{stat.correct}/{stat.attempts} correct</span>
                  </div>
                  <span className="text-xl font-bold" style={{ color: '#0f2240' }}>{stat.rate}%</span>
                </div>
                <Progress value={stat.rate} className="h-2.5" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Simulation History */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base" style={{ color: '#0f2240' }}>Simulation History</CardTitle>
            <CardDescription>Recent session activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: '#f1f5f9' }}>
                    <th className="text-left pb-2 text-xs font-medium" style={{ color: '#94a3b8' }}>Date</th>
                    <th className="text-left pb-2 text-xs font-medium" style={{ color: '#94a3b8' }}>Email Sessions</th>
                    <th className="text-left pb-2 text-xs font-medium" style={{ color: '#94a3b8' }}>SMS Sessions</th>
                    <th className="text-right pb-2 text-xs font-medium" style={{ color: '#94a3b8' }}>Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {simulationHistory.map((row, i) => (
                    <tr key={i} className="border-b last:border-b-0" style={{ borderColor: '#f1f5f9' }}>
                      <td className="py-3 font-medium" style={{ color: '#0f2240' }}>{row.date}</td>
                      <td className="py-3" style={{ color: '#64748b' }}>{row.email}</td>
                      <td className="py-3" style={{ color: '#64748b' }}>{row.sms}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {row.accuracy >= 80
                            ? <ChevronUp className="w-3.5 h-3.5" style={{ color: '#16a34a' }} />
                            : <ChevronDown className="w-3.5 h-3.5" style={{ color: '#dc2626' }} />
                          }
                          <span className="font-medium" style={{ color: row.accuracy >= 80 ? '#16a34a' : '#dc2626' }}>
                            {row.accuracy}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Feedback */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base" style={{ color: '#0f2240' }}>Recent Feedback</CardTitle>
            <CardDescription>Feedback from your latest simulations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentFeedback.map((fb, i) => (
              <div key={i} className="p-3 rounded-lg border" style={{ borderColor: '#e2e8f0', backgroundColor: '#fafafa' }}>
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: '#0f2240' }}>{fb.scenario}</span>
                    <Badge className="text-xs" style={{ backgroundColor: fb.type === 'Email' ? 'rgba(14,165,233,0.1)' : 'rgba(139,92,246,0.1)', color: fb.type === 'Email' ? '#0ea5e9' : '#8b5cf6' }}>
                      {fb.type}
                    </Badge>
                  </div>
                  <Badge
                    className="text-xs"
                    style={{
                      backgroundColor: fb.result === 'Correct' ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
                      color: fb.result === 'Correct' ? '#16a34a' : '#dc2626',
                    }}
                  >
                    {fb.result}
                  </Badge>
                </div>
                <p className="text-xs" style={{ color: '#64748b' }}>{fb.note}</p>
                <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>{fb.date}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
