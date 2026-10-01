// Player page: My Progress. Overview and Badges show lifetime progress; Performance shows filtered metrics.

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Award, Flame, LayoutDashboard, LineChart, Target } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import AnalyticsService from '../../services/analyticsService';
import { BadgeCollection, ProfileStats, SkillRankCard, XpProgress } from './progress/ProgressWidgets';
import { ActivityCalendar } from './progress/ActivityCalendar';
import type { Progress as PlayerProgress } from '../../types/catch';
import { FilterBar } from './FilterBar';
import { ChannelBadge, DifficultyBadge } from './visuals';
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

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'performance', label: 'Performance', icon: LineChart },
  { id: 'badges', label: 'Badges', icon: Award },
] as const;
type TabId = (typeof TABS)[number]['id'];

// Remembers the open tab, and lets Home open a specific one
const TAB_KEY = 'progress_tab';

/** Open My Progress on a tab (used by the shortcuts on Home). */
export function openProgressTab(tab: string, onNavigate: (page: string) => void) {
  try {
    localStorage.setItem(TAB_KEY, tab);
  } catch {
    // Storage can be blocked; the page then opens on Overview
  }
  onNavigate('performance');
}

/** The tab to show first: the one asked for, or the last one viewed. */
function savedTab(): TabId {
  try {
    const saved = localStorage.getItem(TAB_KEY);
    return TABS.find((tab) => tab.id === saved)?.id ?? 'overview';
  } catch {
    return 'overview';
  }
}

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
  completed_simulations: number;
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

/** My Progress page: stats strip, then Overview, Performance and Badges tabs. */
export function Analytics() {
  const [performance, setPerformance] = useState<PlayerPerformance | null>(null);
  const [filters, setFilters] = useState(DEFAULT_METRICS_FILTERS);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>(savedTab);

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

  const changeTab = (next: string) => {
    const id = TABS.find((item) => item.id === next)?.id ?? 'overview';
    setTab(id);
    try {
      localStorage.setItem(TAB_KEY, id);
    } catch {
      // Not saved; the tab still changes
    }
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="My Progress"
        description="Your rank, streak, badges and how your phishing detection is improving"
        icon={LineChart}
        tone="bg-green-500/15 text-green-300"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* XP, rank, badges and streaks always count everything; only the Performance tab is filtered */}
        {performance ? (
          <ProfileStats progress={performance} completed={performance.completed_simulations} onOpen={changeTab} />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-24 rounded-xl" />)}
          </div>
        )}

        <TabBar value={tab} onChange={changeTab} />

        {tab === 'overview' && <OverviewTab performance={performance} />}
        {tab === 'performance' && (
          <PerformanceTab performance={performance} filters={filters} onFiltersChange={setFilters} loading={loading} />
        )}
        {tab === 'badges' && <BadgesTab performance={performance} />}
      </div>
    </div>
  );
}

/** The three section buttons under the stats strip. */
function TabBar({ value, onChange }: { value: TabId; onChange: (tab: string) => void }) {
  return (
    <div role="tablist" aria-label="My Progress sections" className="flex w-fit gap-1 rounded-xl border border-border bg-card/70 p-1">
      {TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            value === item.id ? 'bg-sky-500/20 text-sky-200 shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <item.icon className="w-4 h-4" />
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** Lifetime view: yearly activity, private skill rank, level and the adaptive difficulty. */
function OverviewTab({ performance }: { performance: PlayerPerformance | null }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-foreground">Yearly activity</CardTitle>
          <CardDescription>Every day you practised this year. Hover a square to see that day.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityCalendar />
        </CardContent>
      </Card>

      {performance ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-foreground">Private skill rank</CardTitle>
              <CardDescription>Measures skill, so it can rise or fall. No leaderboards.</CardDescription>
            </CardHeader>
            <CardContent>
              <SkillRankCard skill={performance.skill} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-foreground">Level and training</CardTitle>
              <CardDescription>XP measures effort; the difficulty follows your last 5 answers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <XpProgress progress={performance} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md bg-muted p-3">
                  <div className="text-xs text-muted-foreground">Next scenarios</div>
                  <div className="mt-1 flex items-center gap-2">
                    <DifficultyBadge difficulty={performance.difficulty} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{performance.adaptive_reason}</div>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <div className="text-xs text-muted-foreground">Baseline score</div>
                  <div className="mt-1 text-lg font-bold text-foreground">
                    {performance.baseline_score !== null ? `${performance.baseline_score}%` : '—'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {performance.baseline_score !== null ? 'Your starting level' : 'Take the baseline quiz from the menu'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Skeleton className="h-72" />
      )}
    </div>
  );
}

/** Filtered metrics: accuracy, mistakes, trends, channels, categories and the decisions themselves. */
function PerformanceTab({ performance, filters, onFiltersChange, loading }: {
  performance: PlayerPerformance | null;
  filters: typeof DEFAULT_METRICS_FILTERS;
  onFiltersChange: (filters: typeof DEFAULT_METRICS_FILTERS) => void;
  loading: boolean;
}) {
  const period = rangeLabel(filters);
  const risky = (performance?.phishing_links_clicked ?? 0) + (performance?.malicious_files_opened ?? 0);

  return (
    <div className="space-y-6">
      <MetricsFilters
        value={filters}
        onChange={onFiltersChange}
        categories={performance?.category_options ?? []}
        loading={loading && performance !== null}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Accuracy" value={performance ? `${performance.overall_accuracy}%` : undefined}
          hint={`${performance?.correct_attempts ?? 0} of ${performance?.total_attempts ?? 0} correct, ${period}`} icon={Target} tone="sky" />
        <StatCard label="Missed phishing" value={performance ? `${performance.false_negative_rate}%` : undefined}
          hint="Phishing you marked safe" icon={AlertTriangle} tone="red" />
        <StatCard label="False alarms" value={performance ? `${performance.false_positive_rate}%` : undefined}
          hint="Safe messages you reported" icon={Activity} tone="amber" />
        <StatCard label="Risky clicks" value={performance ? risky : undefined}
          hint={`${performance?.phishing_links_clicked ?? 0} links, ${performance?.malicious_files_opened ?? 0} files. Aim for zero`}
          icon={Flame} tone="orange" />
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-foreground">Mistakes over time</CardTitle>
            <CardDescription>Weekly missed phishing and false alarms, {period}</CardDescription>
          </CardHeader>
          <CardContent>
            <ErrorTrendChart data={performance?.weekly_errors ?? []} />
          </CardContent>
        </Card>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-foreground">Accuracy by category</CardTitle>
          <CardDescription>Where you practise most (bars) and how well you do (line)</CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryChart data={performance?.by_category ?? []} />
        </CardContent>
      </Card>

      <RecentDecisions performance={performance} period={period} />
    </div>
  );
}

/** Every badge, grouped, with how many are collected. */
function BadgesTab({ performance }: { performance: PlayerPerformance | null }) {
  if (!performance) return <Skeleton className="h-96" />;
  const earned = performance.badges.filter((badge) => badge.earned).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-foreground">Badge collection</CardTitle>
        <CardDescription>
          {earned} of {performance.badges.length} collected. Hover or tap a badge to see how to earn it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BadgeCollection badges={performance.badges} />
      </CardContent>
    </Card>
  );
}

/** The decisions in the chosen period: search, filter, sort, and open one for its full feedback. */
function RecentDecisions({ performance, period }: { performance: PlayerPerformance | null; period: string }) {
  const [search, setSearch] = useState('');
  const [result, setResult] = useState('');
  const [shown, setShown] = useState(PAGE_SIZE);
  const [opened, setOpened] = useState<RecentAttempt | null>(null);

  const matching = (performance?.recent_attempts ?? []).filter((attempt) =>
    attempt.scenario.toLowerCase().includes(search.toLowerCase())
    && (!result || (result === 'correct') === attempt.correct),
  );
  const decisions = useSort(matching, {
    date: (attempt) => attempt.attempted_at,
    xp: (attempt) => attempt.xp_earned,
    scenario: (attempt) => attempt.scenario,
  }, { key: 'date', direction: 'desc' });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-foreground">Recent decisions</CardTitle>
        <CardDescription>Feedback on your decisions, {period}. Click one to read it in full.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search scenarios"
          filters={[{
            key: 'result',
            label: 'Results',
            value: result,
            options: [{ value: 'correct', label: 'Correct' }, { value: 'incorrect', label: 'Incorrect' }],
            onChange: setResult,
          }]}
          onClear={() => {
            setSearch('');
            setResult('');
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

      <DecisionDetails attempt={opened} onClose={() => setOpened(null)} />
    </Card>
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
