// XP bar, rank card, badges, daily goal ring and streak flame (CATCH "Help")

import { Award, Check, Flame, Lock, Medal, Search, ShieldCheck, Target, TrendingUp, Zap } from "lucide-react";
import { Progress as ProgressBar } from "../ui/progress";
import type { BadgeProgress, Progress, SkillRank } from "../../../types/catch";

export const BADGE_ICONS: Record<string, typeof Award> = {
  first_catch: Target,
  clue_hunter: Search,
  category_master: Medal,
  zero_misses: ShieldCheck,
  comeback: TrendingUp,
};

// How to earn each badge, matching the rules in backend ProgressService.badge_progress
const BADGE_HINTS: Record<string, string> = {
  first_catch: "Report a phishing message correctly. Every mode counts, including Inbox Rush.",
  clue_hunter: "Answer correctly and tick every warning sign in the message, with no wrong picks. Do it 5 times.",
  category_master: "Answer 10 scenarios in one category, like Banking, and get at least 90% of them right. Retakes count.",
  zero_misses: "Make 10 decisions in a row without marking a phishing message as safe. False alarms don't break the run.",
  comeback: "Your skill rank has to drop and then climb back up. Keep training after a bad run.",
};

export const TIER_STYLES: Record<string, { text: string; bg: string; ring: string; bar: string }> = {
  Recruit: { text: "text-slate-200", bg: "bg-slate-500/20", ring: "ring-slate-400/40", bar: "bg-slate-400" },
  Spotter: { text: "text-emerald-200", bg: "bg-emerald-500/20", ring: "ring-emerald-400/40", bar: "bg-emerald-400" },
  Analyst: { text: "text-sky-200", bg: "bg-sky-500/20", ring: "ring-sky-400/40", bar: "bg-sky-400" },
  Defender: { text: "text-violet-200", bg: "bg-violet-500/20", ring: "ring-violet-400/40", bar: "bg-violet-400" },
  Guardian: { text: "text-amber-200", bg: "bg-amber-500/20", ring: "ring-amber-400/50", bar: "bg-amber-400" },
};

/** Colours for a rank tier. */
export function tierStyle(tier: string) {
  return TIER_STYLES[tier] ?? TIER_STYLES.Recruit;
}

/** Rank emblem: a shield in the tier's colour. */
export function TierEmblem({ tier, size = "md" }: { tier: string; size?: "sm" | "md" | "lg" }) {
  const style = tierStyle(tier);
  const box = { sm: "w-8 h-8", md: "w-12 h-12", lg: "w-16 h-16" }[size];
  const icon = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-8 h-8" }[size];

  return (
    <div className={`${box} ${style.bg} rounded-xl ring-2 ${style.ring} flex items-center justify-center shrink-0`}>
      <ShieldCheck className={`${icon} ${style.text}`} />
    </div>
  );
}

/** Level, XP bar and multiplier. */
export function XpProgress({ progress }: { progress: Progress }) {
  const isMaxLevel = progress.xp_for_next_level === null;
  const percent = isMaxLevel
    ? 100
    : Math.round((progress.xp_into_level / (progress.xp_for_next_level ?? 1)) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Level {progress.level}</span>
        <span className="text-muted-foreground">
          {isMaxLevel
            ? `${progress.xp} XP · max level`
            : `${progress.xp_into_level} / ${progress.xp_for_next_level} XP`}
        </span>
      </div>
      <ProgressBar value={percent} className="h-2.5" />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Zap className="w-3 h-3 text-amber-400" />
          XP multiplier ×{progress.multiplier.toFixed(2)}
        </span>
        <span>{progress.xp} XP total</span>
      </div>
      {progress.rank_dropped && (
        <p className="text-xs text-amber-300">
          Your skill rank dropped, so the multiplier is one level lower until you recover.
        </p>
      )}
    </div>
  );
}

/** The private skill rank and the tiers above it. */
export function SkillRankCard({ skill, showNextTier = true }: { skill: SkillRank; showNextTier?: boolean }) {
  const isRated = skill.attempts_until_rated === 0;
  const style = tierStyle(skill.tier);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <TierEmblem tier={skill.tier} />
        <div>
          <div className={`text-2xl font-bold ${style.text}`}>
            {skill.tier}
            {isRated && <span className="ml-2 text-base font-semibold text-muted-foreground">{skill.rating}</span>}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Lock className="w-3 h-3" />
            {isRated
              ? "Phish Detection Rating: accuracy on your last 20 attempts. Only you see your rating and position; no one sees anyone else's."
              : `Complete ${skill.attempts_until_rated} more simulation(s) to get your first rating.`}
          </p>
        </div>
      </div>

      {skill.standing && <StandingLine standing={skill.standing} />}

      <TierLadder skill={skill} />

      {showNextTier && isRated && skill.next_tier && (
        <p className="text-xs text-muted-foreground">
          Reach {skill.next_tier_rating} to become <span className="text-foreground">{skill.next_tier}</span>
          {skill.next_tier === "Guardian" && " (and miss no more than 5% of phishing)"}.
          Harder scenarios count more: Easy ×1, Medium ×1.5, Hard ×2.
        </p>
      )}
    </div>
  );
}

/** "#12 of 40 players": your private position. Other players stay anonymous. */
function StandingLine({ standing }: { standing: NonNullable<SkillRank["standing"]> }) {
  if (standing.position === null) {
    return (
      <p className="text-xs text-muted-foreground">
        Get rated to see where you stand among {standing.out_of} players.
      </p>
    );
  }
  return (
    <div className="flex items-center justify-between rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2">
      <div className="flex items-center gap-2">
        <Medal className="w-4 h-4 text-sky-300" />
        <span className="text-sm font-semibold text-foreground">
          #{standing.position} <span className="font-normal text-muted-foreground">of {standing.out_of} players</span>
        </span>
      </div>
      <span className="text-xs text-sky-300">Top {standing.top_percent}%</span>
    </div>
  );
}

/** The five rank tiers with the current one highlighted. */
function TierLadder({ skill }: { skill: SkillRank }) {
  return (
    <div className="grid grid-cols-5 gap-1 items-end">
      {skill.tiers.map((tier, index) => {
        const isCurrent = index === skill.tier_index;
        const isReached = index <= skill.tier_index;
        const style = tierStyle(tier.name);
        return (
          <div key={tier.name} className="text-center">
            <div
              className={`rounded-t-sm transition-all duration-700 ${
                isReached ? style.bar : "bg-muted"
              } ${isCurrent ? "shine" : isReached ? "opacity-60" : ""}`}
              style={{ height: `${18 + index * 10}px` }}
            />
            <div className={`mt-1 text-[10px] ${isCurrent ? `${style.text} font-semibold` : "text-muted-foreground"}`}>
              {tier.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Every badge. */
export function BadgeGrid({ badges }: { badges: BadgeProgress[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {badges.map((badge) => (
        <BadgeTile key={badge.key} badge={badge} />
      ))}
    </div>
  );
}

/** One badge with its progress. Hovering (or tapping) it shows how to earn it. */
export function BadgeTile({ badge, highlight = false }: { badge: BadgeProgress; highlight?: boolean }) {
  const Icon = BADGE_ICONS[badge.key] ?? Award;
  const percent = Math.round((badge.progress / Math.max(badge.target, 1)) * 100);
  const hint = BADGE_HINTS[badge.key] ?? badge.description;
  const remaining = badge.target - badge.progress;

  return (
    <div
      // Focusable so keyboard and touch users can reveal the hint too
      tabIndex={0}
      aria-label={`${badge.name}. ${badge.earned ? "Earned" : `${badge.progress} of ${badge.target}`}. ${hint}`}
      className={`group relative min-h-44 overflow-hidden rounded-xl border p-3 text-center transition-all outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
        badge.earned
          ? "border-amber-400/50 bg-linear-to-b from-amber-400/20 to-amber-400/5 shadow-[0_0_20px_-8px_rgba(251,191,36,0.6)]"
          : "border-border bg-muted/30 hover:border-sky-400/40"
      } ${highlight ? "animate-in zoom-in-50 duration-500" : ""}`}
    >
      {badge.earned && <div className="absolute inset-0 shine" aria-hidden />}
      <div
        className={`relative w-11 h-11 mx-auto rounded-full flex items-center justify-center ${
          badge.earned ? "bg-amber-400/25" : "bg-muted"
        }`}
      >
        <Icon className={`w-6 h-6 ${badge.earned ? "text-amber-300" : "text-muted-foreground"}`} />
        {badge.earned && (
          <span className="absolute -right-1 -bottom-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </span>
        )}
      </div>
      <div className="relative mt-2 text-sm font-semibold">{badge.name}</div>
      <div className="relative text-[11px] text-muted-foreground leading-tight min-h-7">{badge.description}</div>
      {!badge.earned && (
        <div className="relative mt-2">
          <div className="h-1.5 rounded-full bg-background overflow-hidden">
            <div className="h-full rounded-full bg-sky-400 transition-all duration-700" style={{ width: `${percent}%` }} />
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">{badge.progress} / {badge.target}</div>
        </div>
      )}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-card/95 p-3 opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 group-focus:opacity-100"
      >
        <span className="text-[10px] uppercase tracking-wide text-amber-300">{badge.earned ? "Earned" : "How to earn"}</span>
        <p className="text-[11px] leading-snug text-foreground">{hint}</p>
        {!badge.earned && <span className="text-[10px] text-muted-foreground">{remaining} to go</span>}
      </div>
    </div>
  );
}

/** Ring showing today's decisions against the daily goal. */
export function DailyGoalRing({ progress, size = 72 }: { progress: Progress; size?: number }) {
  const done = Math.min(progress.today_attempts, progress.daily_goal);
  const percent = done / progress.daily_goal;
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const isComplete = done >= progress.daily_goal;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
        <circle cx="36" cy="36" r={radius} strokeWidth="7" className="fill-none stroke-white/10" />
        <circle
          cx="36"
          cy="36"
          r={radius}
          strokeWidth="7"
          strokeLinecap="round"
          className={`fill-none transition-all duration-700 ${isComplete ? "stroke-green-400" : "stroke-orange-400"}`}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {isComplete
          ? <Check className="w-6 h-6 text-green-400" />
          : <span className="text-lg font-bold text-white">{done}/{progress.daily_goal}</span>}
      </div>
    </div>
  );
}

/** Flame with the number of practice days in a row. */
export function StreakFlame({ days, className = "" }: { days: number; className?: string }) {
  const isLit = days > 0;
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${isLit ? "text-orange-300" : "text-muted-foreground"} ${className}`}>
      <Flame className={`w-4 h-4 ${isLit ? "flame fill-orange-400/40" : ""}`} />
      {days}
    </span>
  );
}
