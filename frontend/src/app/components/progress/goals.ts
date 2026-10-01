// Player goals: one current goal and the next ones, rebuilt from live progress on every load

import type { Progress } from "../../../types/catch";

export type GoalKind = "quiz" | "daily" | "rating" | "tier" | "level" | "badge" | "streak" | "decisions";

export interface Goal {
  id: string;
  kind: GoalKind;
  title: string;
  detail: string;
  progress: number;
  target: number;
  /** Shown instead of "progress / target" when that reads better (e.g. XP or rating). */
  label?: string;
  /** Page the goal's button opens. */
  action?: string;
  /** Badge key, so the goal can use the badge's icon. */
  badgeKey?: string;
}

export interface GoalInput extends Progress {
  total_attempts: number;
  baseline_score: number | null;
}

// Open-ended ladders: after the last step the target keeps rising, so there is always a next goal
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];
const DECISION_MILESTONES = [25, 50, 100, 250, 500, 1000];
// Mirrors ProgressService.GUARDIAN_MAX_MISSED_PERCENT on the backend
const GUARDIAN_MAX_MISSED = 5;

/** The first milestone above value; past the ladder, the next multiple of step. */
export function nextMilestone(value: number, ladder: number[], step: number) {
  const found = ladder.find((milestone) => milestone > value);
  if (found) return found;
  const last = ladder[ladder.length - 1];
  return last + Math.ceil((value - last + 1) / step) * step;
}

/** How close a goal is to done, 0 to 100. */
export function goalPercent(goal: Goal) {
  return Math.min(100, Math.round((goal.progress / Math.max(goal.target, 1)) * 100));
}

/** Every unfinished goal, in priority order. */
export function buildGoals(player: GoalInput): Goal[] {
  const { skill } = player;
  const goals: Goal[] = [];

  if (player.baseline_score === null) {
    goals.push({
      id: "quiz", kind: "quiz", title: "Take the baseline quiz",
      detail: "5 minutes. Sets your starting level", progress: 0, target: 1, action: "quiz",
    });
  }

  goals.push({
    id: "daily", kind: "daily", title: "Hit today's goal",
    detail: `Make ${player.daily_goal} decisions today to keep your streak`,
    progress: Math.min(player.today_attempts, player.daily_goal), target: player.daily_goal,
    action: "simulations",
  });

  if (skill.attempts_until_rated > 0) {
    goals.push({
      id: "rating", kind: "rating", title: "Earn your first skill rating",
      detail: `${skill.attempts_until_rated} more ${skill.attempts_until_rated === 1 ? "decision" : "decisions"} to get rated`,
      progress: skill.rated_attempts, target: skill.rated_attempts + skill.attempts_until_rated,
      action: "simulations",
    });
  } else if (skill.next_tier && skill.next_tier_rating !== null && skill.rating >= skill.next_tier_rating) {
    // The rating is already high enough, so the only thing holding the rank back is missed
    // phishing (Guardian allows at most 5% missed). Fewer misses fill the bar.
    goals.push({
      id: "tier", kind: "tier", title: `Rank up to ${skill.next_tier}`,
      detail: `Your rating is there. Now miss no more than ${GUARDIAN_MAX_MISSED}% of phishing`,
      progress: 100 - skill.missed_percent, target: 100 - GUARDIAN_MAX_MISSED,
      label: `${skill.missed_percent}% missed`, action: "simulations",
    });
  } else if (skill.next_tier && skill.next_tier_rating !== null) {
    // Measure from the floor of the current tier, so the bar starts empty at each new rank
    const floor = skill.tiers[skill.tier_index]?.min_rating ?? 0;
    goals.push({
      id: "tier", kind: "tier", title: `Rank up to ${skill.next_tier}`,
      detail: `Reach a rating of ${skill.next_tier_rating}. Harder scenarios count more`,
      progress: Math.max(0, skill.rating - floor), target: skill.next_tier_rating - floor,
      label: `${skill.rating} / ${skill.next_tier_rating}`, action: "simulations",
    });
  }

  if (player.xp_for_next_level !== null) {
    goals.push({
      id: "level", kind: "level", title: `Reach level ${player.level + 1}`,
      detail: "Every decision earns XP, right or wrong",
      progress: player.xp_into_level, target: player.xp_for_next_level,
      label: `${player.xp_into_level} / ${player.xp_for_next_level} XP`, action: "simulations",
    });
  }

  for (const badge of player.badges.filter((item) => !item.earned)) {
    goals.push({
      id: `badge-${badge.key}`, kind: "badge", title: `Unlock ${badge.name}`, detail: badge.description,
      progress: badge.progress, target: badge.target, badgeKey: badge.key, action: "simulations",
    });
  }

  const streakTarget = nextMilestone(player.daily_streak, STREAK_MILESTONES, 50);
  goals.push({
    id: "streak", kind: "streak", title: `${streakTarget}-day streak`,
    detail: "Practise on consecutive days", progress: player.daily_streak, target: streakTarget,
    label: `${player.daily_streak} / ${streakTarget} days`,
  });

  const decisionsTarget = nextMilestone(player.total_attempts, DECISION_MILESTONES, 500);
  goals.push({
    id: "decisions", kind: "decisions", title: `Make ${decisionsTarget} decisions`,
    detail: "Total scenarios answered", progress: player.total_attempts, target: decisionsTarget,
    action: "simulations",
  });

  return goals.filter((goal) => goal.progress < goal.target);
}

/**
 * The goal to work on now, plus the next few.
 * The quiz, then today's goal, always come first while unfinished.
 * After that the goal closest to done leads, so finishing one promotes the next.
 */
export function pickGoals(player: GoalInput, count = 5) {
  const goals = buildGoals(player);
  const pinned = goals.find((goal) => goal.kind === "quiz") ?? goals.find((goal) => goal.kind === "daily");

  // Closest to done first; ties keep the priority order above
  const rest = goals
    .map((goal, index) => ({ goal, index }))
    .filter(({ goal }) => goal !== pinned)
    .sort((first, second) => goalPercent(second.goal) - goalPercent(first.goal) || first.index - second.index)
    .map(({ goal }) => goal);

  const ordered = pinned ? [pinned, ...rest] : rest;
  return { current: ordered[0] ?? null, next: ordered.slice(1, count) };
}
