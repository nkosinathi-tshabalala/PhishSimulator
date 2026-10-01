// Player page: My Progress, narrowed by the filter bar

import { useEffect, useState } from 'react';
import { Target, Award, BarChart3, Activity, LineChart } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import AnalyticsService from '../../services/analyticsService';
import { BadgeGrid, SkillRankCard, XpProgress } from './progress/ProgressWidgets';
import type { Progress as PlayerProgress } from '../../types/catch';
import { FilterBar } from './FilterBar';
import { ChannelBadge } from './visuals';
import { CampaignTag, formatXp } from './CampaignInbox';
import { Skeleton } from './ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { StatCard } from './StatCard';
import { PageHeader } from './PageHeader';
import { DEFAULT_METRICS_FILTERS, MetricsFilters, metricsQuery, rangeLabel } from './MetricsFilters';
import { SortButton, useSort } from './sorting';
import {
  ActivityChart,
  CategoryChart,
  ErrorTrendChart,
  LearningCurveChart,
  type CategoryPoint,
  type CurvePoint,
  type DailyPoint,
  type WeeklyPoint,
} from './charts/TrendCharts';

// Recent decisions shown at first; "Show more" adds this many each time
const PAGE_SIZE = 8;

interface RecentAttempt {
  scenario: string;
  type: string;
  correct: boolean;
  feedback: string;
  xp_earned: number;
  clue_score: number | null;
  attempted_at: string;
  source?: 'CAMPAIGN' | 'TRAINING';
}

interface PlayerPerformance extends PlayerProgress {
  overall_accuracy: number;
  false_positive_rate: number;
  false_negative_rate: number;
  phishing_links_clicked: number;
  malicious_files_opened: number;
  baseline_score: number | null;
  correct_attempts: number;
  total_attempts: number;
  difficulty: string;
  adaptive_reason: string;
  by_type: Array<{ type: string; attempts: number; correct: number; accuracy: number }>;
  daily_trend: DailyPoint[];
  weekly_errors: WeeklyPoint[];
  learning_curve: CurvePoint[];
  by_category: CategoryPoint[];
  category_options: string[];
  recent_attempts: RecentAttempt[];
}

/** My Progress page: the player's stats, rank, badges and history. */
export function Analytics() {
  const [performance, setPerformance] = useState<PlayerPerformance | null>(null);
  const [filters, setFilters] = useState(DEFAULT_METRICS_FILTERS);
  const [loading, setLoading] = useState(true);
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [shown, setShown] = useState(PAGE_SIZE);
  const [opened, setOpened] = useState<RecentAttempt | null>(null);

  // Reload whenever a filter changes. `current` ignores replies to older requests that arrive late.
  useEffect(() => {
    let current = true;
    setLoading(true);
    AnalyticsService.getMyPerformance(metricsQuery(filters))
      .then((response) => current && response.ok && setPerformance(response.data.data))
      .catch((error) => console.error('Unable to load player analytics.', error))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [filters]);

  const period = rangeLabel(filters);
  const matching = (performance?.recent_attempts ?? []).filter((attempt) =>
    attempt.scenario.toLowerCase().includes(feedbackSearch.toLowerCase())
    && (!resultFilter || (resultFilter === 'correct') === attempt.correct),
  );
  const decisions = useSort(matching, {
    date: (attempt) => attempt.attempted_at,
    xp: (attempt) => attempt.xp_earned,
    scenario: (attempt) => attempt.scenario,
  }, { key: 'date', direction: 'desc' });

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="My Progress"
        description="Your training statistics, rank and history"
        icon={LineChart}
        tone="bg-green-500/15 text-green-300"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <MetricsFilters
          value={filters}
          onChange={(next) => {
            setFilters(next);
            setShown(PAGE_SIZE);
          }}
          categories={performance?.category_options ?? []}
          loading={loading && performance !== null}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Accuracy" value={performance ? `${performance.overall_accuracy}%` : undefined}
            hint={`${performance?.total_attempts ?? 0} decisions, ${period}`} icon={Target} tone="sky" />
          <StatCard label="Correct decisions" value={performance?.correct_attempts}
            hint={`of ${performance?.total_attempts ?? 0}`} icon={Activity} tone="blue" />
          <StatCard label="Baseline score" value={performance ? (performance.baseline_score !== null ? `${performance.baseline_score}%` : '—') : undefined}
            hint={performance?.baseline_score !== null ? 'Latest assessment' : 'Take the baseline quiz'} icon={Award} tone="green" />
          <StatCard label="Current difficulty" value={performance?.difficulty}
            hint="Chosen by the adaptive engine" icon={BarChart3} tone="amber" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-foreground">Activity and accuracy</CardTitle>
              <CardDescription>Decisions per day (bars) and accuracy (line), {period}</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityChart data={performance?.daily_trend ?? []} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-foreground">Learning curve</CardTitle>
              <CardDescription>Accuracy over your last 5 decisions, compared with your baseline</CardDescription>
            </CardHeader>
            <CardContent>
              <LearningCurveChart data={performance?.learning_curve ?? []} baseline={performance?.baseline_score ?? null} />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-foreground">Mistakes over time</CardTitle>
              <CardDescription>
                Missed phishing {performance?.false_negative_rate ?? 0}% · false alarms {performance?.false_positive_rate ?? 0}%
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ErrorTrendChart data={performance?.weekly_errors ?? []} />
              <RiskyCount label="Phishing links clicked" hint="Clicking a malicious link is the costliest mistake"
                value={performance?.phishing_links_clicked ?? 0} />
              <RiskyCount label="Malicious files opened" hint="Unexpected .htm, .zip, .docm or .iso files you opened"
                value={performance?.malicious_files_opened ?? 0} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base text-foreground">Level & Adaptive Status</CardTitle>
              <CardDescription>XP measures effort over all your training; difficulty adapts to your last 5 answers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {performance && <XpProgress progress={performance} />}
              <div className="flex items-center justify-between p-3 rounded-md bg-muted">
                <div>
                  <div className="text-sm font-medium text-foreground">Adaptive Engine</div>
                  <div className="text-xs text-muted-foreground">{performance?.adaptive_reason ?? 'Calculating recommendation'}</div>
                </div>
                <Badge className="text-xs border-0 bg-green-500/15 text-green-400">
                  {performance ? performance.difficulty : 'Loading'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {performance && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-foreground">Private Skill Rank</CardTitle>
                <CardDescription>Measures skill, so it can rise or fall. No leaderboards.</CardDescription>
              </CardHeader>
              <CardContent>
                <SkillRankCard skill={performance.skill} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-foreground">Badges</CardTitle>
                <CardDescription>Hover or tap a badge to see how to earn it</CardDescription>
              </CardHeader>
              <CardContent>
                <BadgeGrid badges={performance.badges} />
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-foreground">Email vs SMS</CardTitle>
              <CardDescription>Your accuracy on each channel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {(performance?.by_type ?? []).map((stat) => (
                <div key={stat.type}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-sm font-medium text-foreground">{stat.type === 'EMAIL' ? 'Email phishing' : 'SMS / smishing'}</span>
                      <span className="text-xs ml-2 text-muted-foreground">{stat.correct}/{stat.attempts} correct</span>
                    </div>
                    <span className="text-xl font-bold text-foreground">{stat.accuracy}%</span>
                  </div>
                  <Progress value={stat.accuracy} className="h-2.5" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-foreground">Accuracy by category</CardTitle>
              <CardDescription>Where you practise most (bars) and how well you do (line)</CardDescription>
            </CardHeader>
            <CardContent>
              <CategoryChart data={performance?.by_category ?? []} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-foreground">Recent decisions</CardTitle>
            <CardDescription>Feedback on your decisions, {period}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FilterBar
              search={feedbackSearch}
              onSearchChange={setFeedbackSearch}
              searchPlaceholder="Search scenarios"
              filters={[{
                key: 'result',
                label: 'Results',
                value: resultFilter,
                options: [{ value: 'correct', label: 'Correct' }, { value: 'incorrect', label: 'Incorrect' }],
                onChange: setResultFilter,
              }]}
              onClear={() => {
                setFeedbackSearch('');
                setResultFilter('');
              }}
              resultText={`${matching.length} decision(s)`}
            >
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Sort:</span>
                <SortButton label="Date" column="date" sort={decisions.sort} onSort={decisions.toggle} />
                <SortButton label="XP" column="xp" sort={decisions.sort} onSort={decisions.toggle} />
                <SortButton label="Scenario" column="scenario" sort={decisions.sort} onSort={decisions.toggle} />
              </div>
            </FilterBar>

            {!performance && [1, 2, 3].map((row) => <Skeleton key={row} className="h-16" />)}
            {decisions.sorted.slice(0, shown).map((attempt) => (
              <DecisionRow key={`${attempt.scenario}-${attempt.attempted_at}`} attempt={attempt} onOpen={() => setOpened(attempt)} />
            ))}
            {performance && !matching.length && (
              <p className="py-4 text-center text-sm text-muted-foreground">No decisions match these filters yet.</p>
            )}
            {matching.length > shown && (
              <Button variant="outline" className="w-full" onClick={() => setShown(shown + PAGE_SIZE)}>
                Show more ({matching.length - shown} left)
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <DecisionDetails attempt={opened} onClose={() => setOpened(null)} />
    </div>
  );
}

/** A count of risky actions with a short explanation. */
function RiskyCount({ label, hint, value }: { label: string; hint: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-orange-500/30 bg-orange-500/10 p-3">
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <span className="text-2xl font-bold text-orange-300">{value}</span>
    </div>
  );
}

/** One past decision in the list. Clicking it opens the full feedback. */
function DecisionRow({ attempt, onOpen }: { attempt: RecentAttempt; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`block w-full rounded-md border border-border border-l-4 bg-muted/40 p-3 text-left transition-colors hover:bg-sky-500/5 ${
        attempt.correct ? 'border-l-green-500' : 'border-l-red-500'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">{attempt.scenario}</span>
        <ChannelBadge channel={attempt.type} />
        {attempt.source === 'CAMPAIGN' && <CampaignTag />}
        <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {formatXp(attempt.xp_earned)}
          <Badge className={`text-xs border-0 ${attempt.correct ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
            {attempt.correct ? 'Correct' : 'Incorrect'}
          </Badge>
        </span>
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground">{attempt.feedback}</p>
      <p className="mt-1 text-xs text-muted-foreground/80">{new Date(attempt.attempted_at).toLocaleString()}</p>
    </button>
  );
}

/** Full feedback for one decision, opened from the list. */
function DecisionDetails({ attempt, onClose }: { attempt: RecentAttempt | null; onClose: () => void }) {
  return (
    <Dialog open={attempt !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {attempt && (
          <>
            <DialogHeader>
              <DialogTitle>{attempt.scenario}</DialogTitle>
              <DialogDescription>{new Date(attempt.attempted_at).toLocaleString()}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap items-center gap-2">
              <ChannelBadge channel={attempt.type} />
              {attempt.source === 'CAMPAIGN' && <CampaignTag />}
              <Badge className={`text-xs border-0 ${attempt.correct ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                {attempt.correct ? 'Correct' : 'Incorrect'}
              </Badge>
              <span className="text-xs text-muted-foreground">{formatXp(attempt.xp_earned)}</span>
              {attempt.clue_score !== null && (
                <span className="text-xs text-muted-foreground">· {attempt.clue_score}% of clues spotted</span>
              )}
            </div>
            <p className="rounded-md border border-border bg-muted/40 p-3 text-sm leading-relaxed text-foreground">{attempt.feedback}</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
