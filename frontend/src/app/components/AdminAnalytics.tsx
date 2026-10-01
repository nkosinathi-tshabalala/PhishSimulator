// Admin page: charts across all players, narrowed by the filter bar

import { useEffect, useState } from 'react';
import { Users, Activity, Target, Database, Mail, MessageSquare, AlertTriangle, TrendingUp, BarChart3, LineChart, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { FilterBar } from './FilterBar';
import AnalyticsService from '../../services/analyticsService';
import { StatCard, type StatTone } from './StatCard';
import { PageHeader } from './PageHeader';
import { DEFAULT_METRICS_FILTERS, MetricsFilters, metricsQuery, rangeLabel } from './MetricsFilters';
import { SortButton, useSort } from './sorting';
import { ActivityChart, CategoryChart, DifficultyChart, ErrorTrendChart } from './charts/TrendCharts';

interface DatasetUsage {
  dataset_id: number;
  name: string;
  records: number;
  processed_records: number;
}

/** Admin charts: accuracy, error rates and trends across all players. */
export function AdminAnalytics({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [filters, setFilters] = useState(DEFAULT_METRICS_FILTERS);
  const [loading, setLoading] = useState(true);
  const [datasetSearch, setDatasetSearch] = useState('');

  // Reload whenever a filter changes. `current` ignores replies to older requests that arrive late.
  useEffect(() => {
    let current = true;
    setLoading(true);
    AnalyticsService.getAdminAnalytics(metricsQuery(filters))
      .then((response) => current && response.ok && setAnalytics(response.data.data))
      .catch((error) => console.error('Unable to load administrator analytics.', error))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [filters]);

  const period = rangeLabel(filters);
  const platformStats: Array<{ label: string; value: string | number | undefined; icon: LucideIcon; tone: StatTone; hint: string }> = [
    { label: 'Decisions', value: analytics?.total_simulations, icon: Activity, tone: 'sky', hint: `Made in ${period}` },
    { label: 'Average Accuracy', value: analytics ? `${analytics.average_accuracy}%` : undefined, icon: Target, tone: 'green', hint: 'Across the filtered decisions' },
    { label: 'Avg. Baseline Score', value: analytics ? `${analytics.average_baseline_score}%` : undefined, icon: BarChart3, tone: 'blue', hint: 'Assessments completed' },
    { label: 'Active Users', value: analytics?.active_users, icon: Users, tone: 'violet', hint: `Signed in, ${period}` },
  ];

  const datasetRows: DatasetUsage[] = (analytics?.datasets ?? []).filter((dataset: DatasetUsage) =>
    dataset.name.toLowerCase().includes(datasetSearch.toLowerCase()),
  );
  const processedShare = (dataset: DatasetUsage) =>
    dataset.records ? Math.round((dataset.processed_records / dataset.records) * 100) : 0;
  const datasets = useSort(datasetRows, {
    name: (dataset) => dataset.name,
    records: (dataset) => dataset.records,
    processed: (dataset) => dataset.processed_records,
    progress: processedShare,
  }, { key: 'name', direction: 'asc' });

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="System Analytics"
        description="Platform-wide statistics — not individual player data"
        icon={LineChart}
        tone="bg-violet-500/15 text-violet-300"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <MetricsFilters
          value={filters}
          onChange={setFilters}
          categories={analytics?.category_options ?? []}
          showGroup
          loading={loading && analytics !== null}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {platformStats.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} hint={s.hint} icon={s.icon} tone={s.tone} />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-foreground">Platform activity</CardTitle>
            <CardDescription>Decisions and new users per day (bars) with accuracy (line), {period}</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityChart data={analytics?.daily_trend ?? []} showNewUsers />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-foreground">Mistakes over time</CardTitle>
              <CardDescription>Weekly missed phishing and false alarms, {period}</CardDescription>
            </CardHeader>
            <CardContent>
              <ErrorTrendChart data={analytics?.weekly_errors ?? []} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-foreground">Accuracy by difficulty</CardTitle>
              <CardDescription>Harder scenarios should have lower accuracy</CardDescription>
            </CardHeader>
            <CardContent>
              <DifficultyChart data={analytics?.by_difficulty ?? []} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-foreground">Accuracy by category</CardTitle>
            <CardDescription>Which kinds of phishing players see most (bars) and handle best (line)</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryChart data={analytics?.by_category ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-foreground">Email vs SMS</CardTitle>
            <CardDescription>Decisions and accuracy for each channel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {(analytics?.by_type ?? []).map((item: { type: string; attempts: number; accuracy: number }) => {
              const isEmail = item.type === 'EMAIL';
              const Icon = isEmail ? Mail : MessageSquare;
              return (
                <div key={item.type}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${isEmail ? 'text-sky-400' : 'text-violet-400'}`} />
                      <span className="text-sm font-medium text-foreground">{isEmail ? 'Email simulations' : 'SMS simulations'}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold text-foreground">{item.accuracy}%</span>
                      <span className="text-xs ml-2 text-muted-foreground">{item.attempts.toLocaleString()} decisions</span>
                    </div>
                  </div>
                  <Progress value={item.accuracy} className="h-2.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InsightCard
            title="Most Difficult Scenario"
            description="Lowest success rate in the filtered decisions"
            icon={AlertTriangle}
            tone="red"
            headline={analytics?.most_difficult?.title ?? 'No scenario attempts yet'}
            detail={analytics?.most_difficult
              ? `Category: ${analytics.most_difficult.category} · Difficulty: ${analytics.most_difficult.difficulty}`
              : 'Complete simulations to identify difficult scenarios.'}
            figures={[
              { value: `${analytics?.most_difficult?.success_rate ?? 0}%`, label: 'Success rate' },
              { value: analytics?.most_difficult?.attempts ?? 0, label: 'Attempts' },
            ]}
          />
          <InsightCard
            title="Most Missed Phishing Cue"
            description="What players miss most often"
            icon={TrendingUp}
            tone="amber"
            headline={analytics?.most_missed_cue?.cue ?? 'No missed cue data yet'}
            detail="Derived from incorrect attempts on scenarios containing this cue."
            figures={[
              { value: `${analytics?.most_missed_cue?.miss_rate ?? 0}%`, label: 'Miss rate' },
              { value: analytics?.most_missed_cue?.missed_count ?? 0, label: 'Times missed' },
            ]}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-foreground">Dataset Usage</CardTitle>
            <CardDescription>How much of each uploaded dataset has been turned into scenarios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FilterBar
              search={datasetSearch}
              onSearchChange={setDatasetSearch}
              searchPlaceholder="Search datasets"
              onClear={() => setDatasetSearch('')}
              resultText={`${datasetRows.length} dataset(s)`}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left pb-3"><SortButton label="Dataset" column="name" sort={datasets.sort} onSort={datasets.toggle} /></th>
                    <th className="text-right pb-3"><SortButton label="Records" column="records" sort={datasets.sort} onSort={datasets.toggle} /></th>
                    <th className="text-right pb-3"><SortButton label="Processed" column="processed" sort={datasets.sort} onSort={datasets.toggle} /></th>
                    <th className="text-right pb-3"><SortButton label="Progress" column="progress" sort={datasets.sort} onSort={datasets.toggle} /></th>
                  </tr>
                </thead>
                <tbody>
                  {datasets.sorted.map((dataset) => (
                    <tr
                      key={dataset.dataset_id}
                      onClick={() => onNavigate('datasets')}
                      title="Open in Dataset Management"
                      className="cursor-pointer border-b border-border last:border-b-0 hover:bg-sky-500/5"
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Database className="w-3.5 h-3.5 shrink-0 text-violet-400" />
                          <span className="font-medium text-xs text-foreground">{dataset.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right text-xs text-muted-foreground">{dataset.records.toLocaleString()}</td>
                      <td className="py-3 text-right text-xs text-muted-foreground">{dataset.processed_records.toLocaleString()}</td>
                      <td className="py-3">
                        <div className="ml-auto flex w-32 items-center gap-2">
                          <Progress value={processedShare(dataset)} className="h-1.5" />
                          <span className="w-9 text-right text-xs text-sky-300">{processedShare(dataset)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {analytics && !datasetRows.length && (
                    <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">
                      {analytics.datasets.length ? 'No datasets match this search.' : 'No datasets uploaded yet.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const INSIGHT_TONES = {
  red: { box: 'border-red-500/25 bg-red-500/10', accent: 'text-red-400' },
  amber: { box: 'border-amber-400/25 bg-amber-400/10', accent: 'text-amber-300' },
};

/** A highlighted finding with a headline and two figures (most difficult scenario, most missed cue). */
function InsightCard({ title, description, icon: Icon, tone, headline, detail, figures }: {
  title: string;
  description: string;
  icon: LucideIcon;
  tone: keyof typeof INSIGHT_TONES;
  headline: string;
  detail: string;
  figures: Array<{ value: string | number; label: string }>;
}) {
  const style = INSIGHT_TONES[tone];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-foreground">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={`flex items-start gap-3 rounded-md border p-4 ${style.box}`}>
          <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${style.accent}`} />
          <div>
            <div className="font-semibold text-sm text-foreground">{headline}</div>
            <div className="text-xs mt-1 text-muted-foreground">{detail}</div>
            <div className="flex items-center gap-4 mt-3">
              {figures.map((figure, index) => (
                <div key={figure.label}>
                  <div className={`text-lg font-bold ${index === 0 ? style.accent : 'text-foreground'}`}>{figure.value}</div>
                  <div className="text-xs text-muted-foreground">{figure.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
