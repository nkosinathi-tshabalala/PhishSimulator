// Player page: Home

import { useEffect, useState, type ReactNode } from "react";
import {
  Award,
  ChevronRight,
  ClipboardList,
  Flame,
  History,
  ListChecks,
  Mail,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import AnalyticsService from "../../services/analyticsService";
import {
  BADGE_ICONS,
  BadgeShowcase,
  DailyGoalRing,
  ProfileStats,
  SkillRankCard,
  XpProgress,
} from "./progress/ProgressWidgets";
import { openProgressTab } from "./Analytics";
import { goalPercent, pickGoals, type Goal, type GoalKind } from "./progress/goals";
import { ChannelBadge, DifficultyBadge } from "./visuals";
import { CampaignInbox, CampaignTag, formatXp } from "./CampaignInbox";
import type { Progress as PlayerProgress } from "../../types/catch";

interface CurrentUser {
  user_id: number;
  full_name: string;
  email: string;
  age: number | null;
  occupation: string | null;
  it_background: boolean | null;
  role: string;
}

interface DashboardProps {
  user: CurrentUser | null;
  onNavigate: (page: string) => void;
}

interface PlayerPerformance extends PlayerProgress {
  overall_accuracy: number;
  false_positive_rate: number;
  false_negative_rate: number;
  phishing_links_clicked: number;
  malicious_files_opened: number;
  total_attempts: number;
  correct_attempts: number;
  baseline_score: number | null;
  new_baselines?: number;
  difficulty: string;
  adaptive_reason: string;
  recent_attempts: Array<{
    scenario: string;
    type: string;
    correct: boolean;
    xp_earned: number;
    attempted_at: string;
    /** CAMPAIGN when it came from a real email the player received, TRAINING otherwise. */
    source?: "CAMPAIGN" | "TRAINING";
  }>;
}

const GOAL_ICONS: Record<GoalKind, typeof Target> = {
  quiz: ClipboardList,
  daily: Target,
  rating: ShieldCheck,
  tier: ShieldCheck,
  level: Sparkles,
  badge: Award,
  streak: Flame,
  decisions: ListChecks,
};

/** Good morning, afternoon or evening. */
function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Player home page: what to do next (goals, training, inbox) and a quick look at progress. */
export function Dashboard({ user, onNavigate }: DashboardProps) {
  const [performance, setPerformance] = useState<PlayerPerformance | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Runs each time the player comes back to Home, so goals always reflect the latest progress
  useEffect(() => {
    AnalyticsService.getMyPerformance()
      .then((response) => {
        if (response.ok) setPerformance(response.data.data);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const firstName = user?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <WelcomeBanner
        firstName={firstName}
        performance={performance}
        isLoading={isLoading}
        onNavigate={onNavigate}
      />

      <CampaignInbox />

      {isLoading ? (
        <DashboardSkeletons />
      ) : performance && (
        <>
          <ProfileStats
            progress={performance}
            completed={performance.total_attempts}
            onOpen={(tab) => openProgressTab(tab, onNavigate)}
          />

          <TrainingCards onNavigate={onNavigate} />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <GoalsPanel performance={performance} onNavigate={onNavigate} />
            <Panel icon={ShieldCheck} iconClass="text-violet-300" title="Rank & level" description="Private: only you can see your rank">
              <div className="space-y-5">
                <SkillRankCard skill={performance.skill} showNextTier={false} />
                <div className="border-t border-border pt-4">
                  <XpProgress progress={performance} />
                </div>
              </div>
            </Panel>
            <RecentActivity performance={performance} onNavigate={onNavigate} />
          </div>

          <Panel
            icon={Trophy}
            iconClass="text-amber-400"
            title="Badges"
            description={`${performance.badges.filter((badge) => badge.earned).length} of ${performance.badges.length} collected`}
            action={(
              <Button variant="ghost" size="sm" onClick={() => openProgressTab("badges", onNavigate)}>
                View all
              </Button>
            )}
          >
            <BadgeShowcase badges={performance.badges} />
          </Panel>
        </>
      )}
    </div>
  );
}

/** Card with the same header layout everywhere on this page, so panels line up.
 * Inside a grid the cards stretch to the tallest one in the row on their own. */
function Panel({ icon: Icon, iconClass, title, description, action, className = "", children }: {
  icon: typeof Target;
  iconClass: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={`gap-4 ${className}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Icon className={`w-4 h-4 ${iconClass}`} />
            {title}
          </CardTitle>
          {description && <CardDescription className="text-sm">{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">{children}</CardContent>
    </Card>
  );
}

/** Greeting with level, streak, difficulty, the daily goal ring and a start button. */
function WelcomeBanner({ firstName, performance, isLoading, onNavigate }: {
  firstName: string;
  performance: PlayerPerformance | null;
  isLoading: boolean;
  onNavigate: (page: string) => void;
}) {
  const percent = performance?.xp_for_next_level
    ? Math.round((performance.xp_into_level / performance.xp_for_next_level) * 100)
    : 100;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-sky-500/20 bg-linear-to-br from-sky-600/30 via-indigo-600/20 to-violet-700/20 p-6">
      <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-sky-400/10 blur-2xl" aria-hidden />
      <div className="relative flex flex-col md:flex-row md:items-center gap-6">
        <LevelRing level={performance?.level} percent={percent} />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white">
            {greeting()}, {firstName}!
          </h1>
          <p className="text-sm text-sky-100/80 mt-1">
            {isLoading
              ? "Loading your progress..."
              : performance?.total_attempts
                ? `You've made ${performance.total_attempts} decisions at ${performance.overall_accuracy}% accuracy. Next up: ${performance.difficulty} scenarios.`
                : "Ready for your first scenario? Spot the phish before it spots you."}
          </p>
          {performance && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <DifficultyBadge difficulty={performance.difficulty} title={performance.adaptive_reason} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-5">
          {performance && (
            <div className="flex flex-col items-center" title="Decisions today towards your daily goal">
              <DailyGoalRing progress={performance} />
              <span className="mt-1 text-[10px] uppercase tracking-wide text-sky-100/70">Daily goal</span>
            </div>
          )}
          <Button size="lg" className="bg-white text-slate-900 hover:bg-sky-100" onClick={() => onNavigate("simulations")}>
            <Flame className="w-4 h-4 mr-2 text-orange-500" />
            {performance?.practised_today ? "Keep training" : "Start training"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Circular progress towards the next level. */
function LevelRing({ level, percent }: { level?: number; percent: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 80 80" className="w-24 h-24 -rotate-90">
        <circle cx="40" cy="40" r={radius} strokeWidth="7" className="fill-none stroke-white/15" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          strokeWidth="7"
          strokeLinecap="round"
          className="fill-none stroke-amber-300 transition-all duration-700"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] uppercase tracking-wide text-sky-100/70">Level</span>
        <span className="text-2xl font-bold text-white">{level ?? "–"}</span>
      </div>
    </div>
  );
}

/** Shortcuts to email, SMS and Inbox Rush training. */
function TrainingCards({ onNavigate }: { onNavigate: (page: string) => void }) {
  const cards = [
    {
      page: "email",
      title: "Email training",
      text: "Inspect a realistic inbox",
      icon: Mail,
      tone: "from-sky-500/30 to-sky-700/10 border-sky-500/30 text-sky-200",
    },
    {
      page: "sms",
      title: "SMS training",
      text: "Spot smishing on a phone",
      icon: MessageSquare,
      tone: "from-purple-500/30 to-purple-700/10 border-purple-500/30 text-purple-200",
    },
    {
      page: "triage",
      title: "Inbox Rush",
      text: "Sort a whole inbox against the clock",
      icon: Zap,
      tone: "from-orange-500/30 via-pink-500/15 to-violet-600/10 border-orange-400/30 text-orange-200",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card) => (
        <button
          key={card.page}
          onClick={() => onNavigate(card.page)}
          className={`group flex items-center gap-4 rounded-xl border bg-linear-to-br p-4 text-left transition-transform hover:-translate-y-0.5 ${card.tone}`}
        >
          <div className="w-11 h-11 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
            <card.icon className="w-6 h-6 transition-transform group-hover:scale-110" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white">{card.title}</div>
            <div className="text-xs opacity-80 truncate">{card.text}</div>
          </div>
          <ChevronRight className="w-4 h-4 opacity-60 transition-transform group-hover:translate-x-0.5" />
        </button>
      ))}
    </div>
  );
}

/** One current goal to act on now, and the next four lined up behind it. */
function GoalsPanel({ performance, onNavigate }: {
  performance: PlayerPerformance;
  onNavigate: (page: string) => void;
}) {
  const { current, next } = pickGoals(performance);

  return (
    <Panel icon={Zap} iconClass="text-orange-300" title="Goals" description="Finish one and the next moves up">
      {current ? (
        <div className="space-y-5">
          <CurrentGoal goal={current} onNavigate={onNavigate} />
          {next.length > 0 && (
            <div>
              <p className="mb-3 text-[11px] uppercase tracking-wide text-muted-foreground">Up next</p>
              <ul className="space-y-3">
                {next.map((goal) => <GoalRow key={goal.id} goal={goal} onNavigate={onNavigate} />)}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Every goal is done. New ones appear as you keep training.</p>
      )}
    </Panel>
  );
}

/** Icon for a goal: a badge goal uses that badge's own icon. */
function goalIcon(goal: Goal) {
  return goal.badgeKey ? BADGE_ICONS[goal.badgeKey] ?? Award : GOAL_ICONS[goal.kind];
}

/** The highlighted goal at the top, with a button to go and work on it. */
function CurrentGoal({ goal, onNavigate }: { goal: Goal; onNavigate: (page: string) => void }) {
  const Icon = goalIcon(goal);
  const percent = goalPercent(goal);

  return (
    <div className="rounded-lg border border-orange-400/30 bg-linear-to-br from-orange-500/15 to-transparent p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-orange-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-orange-300/80">Current goal</p>
          <p className="text-sm font-semibold text-foreground">{goal.title}</p>
          <p className="text-xs text-muted-foreground">{goal.detail}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-linear-to-r from-orange-400 to-pink-400 transition-all duration-700"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">{goal.label ?? `${goal.progress} / ${goal.target}`}</span>
      </div>
      {goal.action && (
        <Button size="sm" className="mt-3 w-full" onClick={() => onNavigate(goal.action!)}>
          {goal.kind === "quiz" ? "Take the quiz" : "Train now"}
          <ChevronRight className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

/** A queued goal: icon, name, progress. */
function GoalRow({ goal, onNavigate }: { goal: Goal; onNavigate: (page: string) => void }) {
  const Icon = goalIcon(goal);
  return (
    <li>
      <button
        type="button"
        title={goal.detail}
        onClick={() => onNavigate(goal.action ?? "simulations")}
        className="flex w-full items-center gap-3 rounded-md p-1 -m-1 text-left transition-colors hover:bg-white/5"
      >
      <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate">{goal.title}</span>
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">{goal.label ?? `${goal.progress} / ${goal.target}`}</span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-sky-400 transition-all duration-700" style={{ width: `${goalPercent(goal)}%` }} />
        </div>
      </div>
      </button>
    </li>
  );
}

/** The player's last five decisions. */
function RecentActivity({ performance, onNavigate }: {
  performance: PlayerPerformance;
  onNavigate: (page: string) => void;
}) {
  const recent = performance.recent_attempts.slice(0, 5);

  return (
    <Panel
      icon={History}
      iconClass="text-sky-300"
      title="Recent decisions"
      description="Your last five scenarios"
      className="md:col-span-2 lg:col-span-1"
      action={<Button variant="ghost" size="sm" onClick={() => onNavigate("performance")}>View all</Button>}
    >
      {recent.length ? (
        <div className="space-y-2">
          {recent.map((activity) => (
            <button
              type="button"
              key={`${activity.scenario}-${activity.attempted_at}`}
              onClick={() => onNavigate("performance")}
              title="See the feedback on My Progress"
              className="flex w-full items-center gap-3 rounded-lg border border-border p-2 text-left transition-colors hover:border-sky-500/40 hover:bg-sky-500/5"
            >
              <span className={`w-1.5 h-8 rounded-full shrink-0 ${activity.correct ? "bg-green-400" : "bg-red-400"}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{activity.scenario}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ChannelBadge channel={activity.type} />
                  {activity.source === "CAMPAIGN" && <CampaignTag />}
                  {new Date(activity.attempted_at).toLocaleDateString()}
                </div>
              </div>
              <span
                className={`text-xs font-semibold shrink-0 ${
                  activity.xp_earned > 0 ? "text-amber-300" : activity.xp_earned < 0 ? "text-red-300" : "text-muted-foreground"
                }`}
              >
                {formatXp(activity.xp_earned)}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-6 text-center">
          <History className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No decisions yet. Your first scenario is waiting.</p>
          <Button size="sm" variant="outline" onClick={() => onNavigate("simulations")}>
            Start training
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </Panel>
  );
}

/** Placeholders shaped like the loaded page. */
function DashboardSkeletons() {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-24 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((item) => <Skeleton key={item} className="h-80 rounded-xl" />)}
      </div>
    </>
  );
}
