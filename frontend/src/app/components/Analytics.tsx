import { useEffect, useState } from 'react';
import { Target, Award, BarChart3, Activity, ChevronUp, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import AnalyticsService from '../../services/analyticsService';

interface AnalyticsProps {
  onBack: () => void;
}

interface PlayerPerformance {
  overall_accuracy: number;
  false_positive_rate: number;
  false_negative_rate: number;
  baseline_score: number | null;
  correct_attempts: number;
  total_attempts: number;
  difficulty: string;
  adaptive_reason: string;
  rank: number;
  player_count: number;
  level: number;
  xp_into_level: number;
  by_type: Array<{ type: string; attempts: number; correct: number; accuracy: number }>;
  history: Array<{ date: string; email: number; sms: number; accuracy: number }>;
  recent_attempts: Array<{ scenario: string; type: string; correct: boolean; feedback: string; attempted_at: string }>;
}

export function Analytics({ onBack }: AnalyticsProps) {
  const [performance, setPerformance] = useState<PlayerPerformance | null>(null);

  useEffect(() => {
    AnalyticsService.getMyPerformance().then((response) => {
      if (response.ok) setPerformance(response.data.data);
    }).catch((error) => console.error('Unable to load player analytics.', error));
  }, []);

  const detectionStats = performance?.by_type.map((stat) => ({
    category: stat.type === 'EMAIL' ? 'Email Phishing' : 'SMS / Smishing',
    attempts: stat.attempts,
    correct: stat.correct,
    rate: stat.accuracy,
  })) ?? [];
  const recentFeedback = performance?.recent_attempts ?? [];
  const simulationHistory = performance?.history ?? [];

  return (
    <div className="h-full flex flex-col">
      <div className="border-b p-4 flex items-center gap-4 bg-card">
        <div>
          <h2 className="text-xl font-semibold text-foreground">My Performance</h2>
          <p className="text-sm text-muted-foreground">Personal training statistics and progress</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Overall Accuracy', value: performance ? `${performance.overall_accuracy}%` : '...', icon: Target, color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', trend: `${performance?.total_attempts ?? 0} simulations` },
            { label: 'Baseline Score', value: performance?.baseline_score !== null && performance ? `${performance.baseline_score}%` : 'Not assessed', icon: Award, color: '#3fb950', bg: 'rgba(63,185,80,0.12)', trend: 'Latest completed assessment' },
            { label: 'Correct Decisions', value: performance?.correct_attempts ?? '...', icon: Activity, color: '#2f81f7', bg: 'rgba(47,129,247,0.12)', trend: `of ${performance?.total_attempts ?? 0} simulations` },
            { label: 'Current Difficulty', value: performance?.difficulty ?? '...', icon: BarChart3, color: '#f2cc60', bg: 'rgba(242,204,96,0.12)', trend: 'Adaptive engine recommendation' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className="w-9 h-9 rounded-md flex items-center justify-center mb-3" style={{ backgroundColor: s.bg }}>
                  <s.icon className="w-4 h-4" style={{ color: s.color }} />
                </div>
                <div className="text-2xl font-bold text-foreground">{s.value}</div>
                <div className="text-xs mt-0.5 text-muted-foreground">{s.label}</div>
                <div className="text-xs mt-1" style={{ color: s.color }}>{s.trend}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Error rates and ranking */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-foreground">Error Rate Analysis</CardTitle>
              <CardDescription>False positives and false negatives</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">False Positives</span>
                  <span className="text-sm" style={{ color: '#f2cc60' }}>{performance?.false_positive_rate ?? 0}%</span>
                </div>
                <Progress value={performance?.false_positive_rate ?? 0} className="h-2" />
                <p className="text-xs mt-1 text-muted-foreground">Safe emails you marked as phishing</p>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">False Negatives</span>
                  <span className="text-sm" style={{ color: '#f85149' }}>{performance?.false_negative_rate ?? 0}%</span>
                </div>
                <Progress value={performance?.false_negative_rate ?? 0} className="h-2" />
                <p className="text-xs mt-1 text-muted-foreground">Phishing emails you marked as safe</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base text-foreground">Ranking & Adaptive Status</CardTitle>
              <CardDescription>Private ranking and engine status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-md bg-muted">
                <div>
                  <div className="text-sm font-medium text-foreground">Private Rank</div>
                  <div className="text-xs text-muted-foreground">Among all players</div>
                </div>
                <div className="text-2xl font-bold" style={{ color: '#2f81f7' }}>#{performance?.rank ?? '...'}</div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md bg-muted">
                <div>
                  <div className="text-sm font-medium text-foreground">Adaptive Engine</div>
                  <div className="text-xs text-muted-foreground">{performance?.adaptive_reason ?? 'Calculating recommendation'}</div>
                </div>
                <Badge className="text-xs border-0" style={{ backgroundColor: 'rgba(63,185,80,0.12)', color: '#3fb950' }}>
                  {performance ? performance.difficulty : 'Loading'}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md bg-muted">
                <div>
                  <div className="text-sm font-medium text-foreground">XP Level</div>
                  <div className="text-xs text-muted-foreground">Current level progress</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold" style={{ color: '#2f81f7' }}>Level {performance?.level ?? '...'}</div>
                  <div className="text-xs text-muted-foreground">{performance?.xp_into_level ?? 0} / 100 XP</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detection by type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-foreground">Performance by Simulation Type</CardTitle>
            <CardDescription>Accuracy across email and SMS scenarios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {detectionStats.map((stat) => (
              <div key={stat.category}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-medium text-foreground">{stat.category}</span>
                    <span className="text-xs ml-2 text-muted-foreground">{stat.correct}/{stat.attempts} correct</span>
                  </div>
                  <span className="text-xl font-bold text-foreground">{stat.rate}%</span>
                </div>
                <Progress value={stat.rate} className="h-2.5" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Simulation History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-foreground">Simulation History</CardTitle>
            <CardDescription>Recent session activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left pb-2 text-xs font-medium text-muted-foreground">Date</th>
                    <th className="text-left pb-2 text-xs font-medium text-muted-foreground">Email Sessions</th>
                    <th className="text-left pb-2 text-xs font-medium text-muted-foreground">SMS Sessions</th>
                    <th className="text-right pb-2 text-xs font-medium text-muted-foreground">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {simulationHistory.map((row) => (
                    <tr key={row.date} className="border-b border-border last:border-b-0">
                      <td className="py-3 font-medium text-foreground">{row.date}</td>
                      <td className="py-3 text-muted-foreground">{row.email}</td>
                      <td className="py-3 text-muted-foreground">{row.sms}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {row.accuracy >= 80
                            ? <ChevronUp className="w-3.5 h-3.5" style={{ color: '#3fb950' }} />
                            : <ChevronDown className="w-3.5 h-3.5" style={{ color: '#f85149' }} />
                          }
                          <span className="font-medium" style={{ color: row.accuracy >= 80 ? '#3fb950' : '#f85149' }}>
                            {row.accuracy}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!simulationHistory.length && (
                    <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No simulation history yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Feedback */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-foreground">Recent Feedback</CardTitle>
            <CardDescription>Feedback from your latest simulations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentFeedback.map((fb) => (
              <div key={`${fb.scenario}-${fb.attempted_at}`} className="p-3 rounded-md border border-border bg-muted">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{fb.scenario}</span>
                    <Badge className="text-xs border-0" style={{ backgroundColor: fb.type === 'EMAIL' ? 'rgba(56,189,248,0.12)' : 'rgba(188,140,255,0.12)', color: fb.type === 'EMAIL' ? '#38bdf8' : '#bc8cff' }}>
                      {fb.type}
                    </Badge>
                  </div>
                  <Badge
                    className="text-xs border-0"
                    style={{
                      backgroundColor: fb.correct ? 'rgba(63,185,80,0.12)' : 'rgba(248,81,73,0.12)',
                      color: fb.correct ? '#3fb950' : '#f85149',
                    }}
                  >
                    {fb.correct ? 'Correct' : 'Incorrect'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{fb.feedback}</p>
                <p className="text-xs mt-1 text-muted-foreground">{new Date(fb.attempted_at).toLocaleString()}</p>
              </div>
            ))}
            {!recentFeedback.length && <p className="text-sm text-muted-foreground">No simulation feedback yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
