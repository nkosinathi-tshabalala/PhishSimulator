// Feedback after answering: what was right, clues and XP (CATCH "Correct" and "Help")

import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Fish,
  Flame,
  Info,
  Lightbulb,
  PartyPopper,
  ShieldAlert,
  Target,
  XCircle,
} from "lucide-react";
import { Button } from "../ui/button";
import { Confetti } from "../progress/Celebration";
import { BadgeTile, XpProgress } from "../progress/ProgressWidgets";
import type { AttemptResult, ClueWithTip, Trap } from "../../../types/catch";

interface FeedbackPanelProps {
  result: AttemptResult;
  streak: number;
  onNext: () => void;
  onViewProgress: () => void;
}

/** CATCH "Correct" + "Help": explain the result, then show progress. */
export function FeedbackPanel({ result, streak, onNext, onViewProgress }: FeedbackPanelProps) {
  const { feedback, changes, progress } = result;
  const xpShown = useCountUp(result.xp_earned);
  const isCelebration = result.correct || changes.level_up || changes.new_badges.length > 0;

  return (
    <div className="space-y-4">
      {isCelebration && <Confetti pieces={changes.level_up ? 90 : 50} />}
      {changes.level_up && <LevelUpBanner level={progress.level} multiplier={progress.multiplier} />}

      <div
        className={`flex items-center justify-between gap-3 rounded-lg px-4 py-3 animate-in zoom-in-95 duration-300 ${
          result.correct
            ? "bg-linear-to-r from-green-500/25 to-green-500/5 text-green-200"
            : "bg-linear-to-r from-red-500/25 to-red-500/5 text-red-200"
        }`}
      >
        <div className="flex items-center gap-2 font-semibold">
          {result.correct ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
          {feedback.headline}
        </div>
        <span className={`text-2xl font-extrabold whitespace-nowrap xp-pop ${result.xp_earned ? "text-amber-300" : ""}`}>
          +{xpShown} XP
        </span>
      </div>

      {feedback.trap && feedback.trap_warning && <PhishedAlert trap={feedback.trap} warning={feedback.trap_warning} />}

      <div className="grid md:grid-cols-2 gap-4">
        <ClueList
          title="Clues you spotted"
          clues={feedback.clues_spotted}
          empty="You didn't match any real clue this time."
          good
        />
        <ClueList
          title="Clues you missed"
          clues={[...feedback.clues_missed, ...feedback.also_present]}
          empty="None: you found every clue on offer."
        />
      </div>

      <div className="rounded-md bg-muted/60 p-3 space-y-2 text-sm">
        <p className="flex gap-2">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-sky-400" />
          {feedback.threat_explanation}
        </p>
        <p className="flex gap-2">
          <Lightbulb className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
          <span><span className="font-medium">Safe habit:</span> {feedback.safe_tip}</span>
        </p>
        {feedback.admin_note && (
          <p className="flex gap-2 text-muted-foreground">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            {feedback.admin_note}
          </p>
        )}
      </div>

      <ProgressChanges result={result} streak={streak} />

      <div className="rounded-md border border-border p-3">
        <XpProgress progress={progress} />
      </div>

      {changes.new_badges.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-amber-300">New badge unlocked!</p>
          <div className="grid grid-cols-2 gap-2">
            {changes.new_badges.map((badge) => (
              <BadgeTile key={badge.key} badge={badge} highlight />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <Button className="flex-1" onClick={onNext} autoFocus>
          Next scenario
        </Button>
        <Button className="flex-1" variant="outline" onClick={onViewProgress}>
          View my progress
        </Button>
      </div>
    </div>
  );
}

/** Celebration when the player levels up. */
function LevelUpBanner({ level, multiplier }: { level: number; multiplier: number }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-400/50 bg-linear-to-r from-amber-500/30 via-orange-500/20 to-pink-500/20 p-4 text-center animate-in zoom-in-90 duration-500">
      <div className="absolute inset-0 shine" aria-hidden />
      <PartyPopper className="relative w-8 h-8 mx-auto text-amber-300" />
      <p className="relative text-2xl font-extrabold text-white">Level {level}!</p>
      <p className="relative text-sm text-amber-100/90">Your XP multiplier is now ×{multiplier.toFixed(2)}.</p>
    </div>
  );
}

/** Shown when the player clicked a phishing link or opened a malicious file. */
function PhishedAlert({ trap, warning }: { trap: Trap; warning: string }) {
  return (
    <div className="flex gap-4 rounded-lg border-2 border-red-500/60 bg-linear-to-br from-red-600/25 to-red-900/10 p-4 animate-in zoom-in-95 duration-300">
      <div className="w-12 h-12 rounded-full bg-red-500/25 flex items-center justify-center shrink-0">
        <Fish className="w-6 h-6 text-red-300" />
      </div>
      <div>
        <p className="text-lg font-bold text-red-200">Hooked! You've been phished.</p>
        <p className="text-sm text-red-100/80">{warning}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Don't worry: this was a safe training {trap === "LINK" ? "link" : "file"} and nothing was opened.
        </p>
      </div>
    </div>
  );
}

/** A list of clues with their tips. */
function ClueList({ title, clues, empty, good = false }: {
  title: string;
  clues: ClueWithTip[];
  empty: string;
  good?: boolean;
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">{title}</h4>
      {clues.length === 0 && <p className="text-xs text-muted-foreground">{empty}</p>}
      <ul className="space-y-2">
        {clues.map((clue) => (
          <li key={clue.name} className="text-sm">
            <span className={`flex items-center gap-1.5 ${good ? "text-green-300" : "text-red-300"}`}>
              {good ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {clue.name}
            </span>
            {!good && clue.tip && <span className="block pl-6 text-xs text-muted-foreground">{clue.tip}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Level, rank, badge and streak changes from this answer. */
function ProgressChanges({ result, streak }: { result: AttemptResult; streak: number }) {
  const { changes, progress } = result;
  const messages: Array<{ key: string; text: string; icon: typeof ArrowUp; tone: string }> = [];

  if (changes.level_up) {
    messages.push({ key: "level", text: `Level up! You reached Level ${progress.level}.`, icon: ArrowUp, tone: "text-sky-300" });
  }
  if (changes.rank_change === "up") {
    messages.push({ key: "rank", text: `Skill rank up: you're now ${progress.skill.tier}.`, icon: ArrowUp, tone: "text-green-300" });
  }
  if (changes.rank_change === "down") {
    messages.push({ key: "rank", text: `Skill rank dropped to ${progress.skill.tier}. You can win it back.`, icon: ArrowDown, tone: "text-amber-300" });
  }
  if (streak >= 3) {
    messages.push({ key: "streak", text: `${streak} correct in a row. Keep it going!`, icon: Flame, tone: "text-orange-300" });
  }
  if (progress.today_attempts === progress.daily_goal) {
    messages.push({ key: "goal", text: "Daily goal complete! Your practice streak is safe today.", icon: Target, tone: "text-green-300" });
  } else if (progress.today_attempts < progress.daily_goal) {
    const left = progress.daily_goal - progress.today_attempts;
    messages.push({ key: "goal", text: `${left} more today to hit your daily goal.`, icon: Target, tone: "text-sky-300" });
  }

  if (!messages.length) return null;

  return (
    <div className="space-y-1">
      {messages.map(({ key, text, icon: Icon, tone }) => (
        <p key={key} className={`flex items-center gap-2 text-sm font-medium ${tone}`}>
          <Icon className="w-4 h-4" />
          {text}
        </p>
      ))}
    </div>
  );
}

/** Animate a number from 0 up to `target` for a small reward moment. */
function useCountUp(target: number) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      return;
    }
    const step = Math.max(1, Math.ceil(target / 20));
    const timer = window.setInterval(() => {
      setValue((current) => {
        const next = Math.min(current + step, target);
        if (next === target) window.clearInterval(timer);
        return next;
      });
    }, 30);
    return () => window.clearInterval(timer);
  }, [target]);

  return value;
}
