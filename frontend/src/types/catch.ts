// Shared types for the CATCH training loop (Check, Approve, Test, Correct, Help)

/** The two message channels. */
export type Channel = "EMAIL" | "SMS";
export type Decision = "REPORT" | "SAFE";
export type Difficulty = "Easy" | "Medium" | "Hard";
export type ScenarioStatus = "DRAFT" | "APPROVED" | "ACTIVE" | "ARCHIVED" | "REJECTED";
/** Clicking a link or opening a file: the player trusted the message. */
export type Trap = "LINK" | "ATTACHMENT";

export interface PracticeCategory {
  name: string;
  available: number;
  attempts: number;
  accuracy: number | null;
  /** Holds enough phishing and genuine messages to practise on its own (a one-sided one would give the answer away). */
  focusable: boolean;
}

/** The message itself, as a player sees it before deciding (never the answer). */
export interface MessageView {
  scenario_id: number;
  simulation_type: Channel;
  category: string;
  difficulty: Difficulty;
  sender: string | null;
  subject: string | null;
  message: string;
  attachment: string | null;
  clue_options: string[];
  already_completed: boolean;
}

/** One training round: the message plus the adaptive context around it. */
export interface PlayerScenario extends MessageView {
  completed_count: number;
  mistakes_to_review: number;
  total_active: number;
  practice_category: string | null;
  category_reason: string;
  adaptive_context: {
    occupation: string | null;
    mode: string;
    recommended_difficulty: Difficulty;
    difficulty_reason: string;
  };
  practice_categories: PracticeCategory[];
}

export interface ClueWithTip {
  name: string;
  tip: string;
}

export interface Feedback {
  headline: string;
  trap: Trap | null;
  trap_warning: string | null;
  summary: string;
  threat_explanation: string;
  safe_tip: string;
  clues_spotted: ClueWithTip[];
  clues_missed: ClueWithTip[];
  also_present: ClueWithTip[];
  wrong_picks: string[];
  admin_note: string | null;
}

export interface BadgeProgress {
  key: string;
  /** "streak", "milestone" or "skill": how the badge collection is grouped. */
  group: "streak" | "milestone" | "skill";
  name: string;
  description: string;
  /** How to earn it, shown when the badge is hovered or tapped. */
  how: string;
  earned: boolean;
  progress: number;
  target: number;
}

export interface SkillRank {
  rating: number;
  tier: string;
  tier_index: number;
  next_tier: string | null;
  next_tier_rating: number | null;
  rated_attempts: number;
  attempts_until_rated: number;
  missed_percent: number;
  tiers: Array<{ name: string; min_rating: number }>;
  /** Private position among all rated players. No other player's details are sent. */
  standing?: { position: number | null; out_of: number; top_percent: number | null; rated?: boolean };
}

/** CATCH "Help" stage: private progress for one player. */
export interface Progress {
  xp: number;
  level: number;
  xp_into_level: number;
  xp_for_next_level: number | null;
  max_level: number;
  multiplier: number;
  rank_dropped: boolean;
  skill: SkillRank;
  badges: BadgeProgress[];
  daily_streak: number;
  /** Most practice days in a row, ever. */
  longest_streak: number;
  practised_today: boolean;
  today_attempts: number;
  daily_goal: number;
}

export interface AttemptResult {
  attempt_id: number;
  correct: boolean;
  correct_answer: Decision;
  clicked_link: boolean;
  opened_attachment: boolean;
  clue_score: number;
  xp_earned: number;
  feedback: Feedback;
  progress: Progress;
  changes: {
    level_up: boolean;
    new_badges: BadgeProgress[];
    rank_change: "up" | "down" | null;
    rating_before: number;
  };
}

/** Activity per day for one year (decisions plus finished baseline quizzes). */
export interface YearActivity {
  year: number;
  first_year: number;
  last_year: number;
  /** "YYYY-MM-DD" -> number of events that day. */
  days: Record<string, number>;
  total: number;
  active_days: number;
}
