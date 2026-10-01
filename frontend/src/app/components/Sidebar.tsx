// Player navigation menu with the rank card

import { useEffect, useState } from "react";
import { Activity, ClipboardList, Home, Mail, Sparkles, Target, User } from "lucide-react";
import { NavSidebar, type NavItem, type SidebarLayoutProps } from "./NavSidebar";
import { StreakFlame, TierEmblem, tierStyle } from "./progress/ProgressWidgets";
import AnalyticsService from "../../services/analyticsService";
import type { Progress } from "../../types/catch";

interface SidebarProps extends SidebarLayoutProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

const PLAYER_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Home", icon: Home, description: "Your progress at a glance", color: "text-sky-400" },
  { id: "quiz", label: "Baseline Quiz", icon: ClipboardList, description: "Measure your starting level", color: "text-amber-400" },
  { id: "simulations", label: "Training", icon: Mail, description: "Email, SMS and Inbox Rush", color: "text-purple-400" },
  { id: "performance", label: "My Progress", icon: Activity, description: "XP, badges, skill rank and history", color: "text-green-400" },
  { id: "profile", label: "Profile", icon: User, description: "Manage your account details", color: "text-slate-300" },
];

/** Navigation for players, with the rank card at the bottom. */
export function Sidebar(props: SidebarProps) {
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    AnalyticsService.getMyPerformance().then((response) => {
      if (response.ok) setProgress(response.data.data);
    });
  }, [props.currentPage]);

  return (
    <NavSidebar
      subtitle="Learner workspace"
      items={PLAYER_ITEMS}
      footer={progress && <RankCard progress={progress} onOpen={() => props.onNavigate("performance")} />}
      compactFooter={progress && (
        <button
          type="button"
          onClick={() => props.onNavigate("performance")}
          title={`${progress.skill.tier} · Level ${progress.level} · ${progress.xp} XP`}
          className="rounded-xl p-1 hover:bg-white/10"
        >
          <TierEmblem tier={progress.skill.tier} size="sm" />
        </button>
      )}
      {...props}
    />
  );
}

/** Always-visible summary of the player's private rank, level and daily habit. */
function RankCard({ progress, onOpen }: { progress: Progress; onOpen: () => void }) {
  const { skill } = progress;
  const isRated = skill.attempts_until_rated === 0;
  const style = tierStyle(skill.tier);
  const percent = progress.xp_for_next_level
    ? Math.round((progress.xp_into_level / progress.xp_for_next_level) * 100)
    : 100;
  const goalDone = Math.min(progress.today_attempts, progress.daily_goal);

  return (
    <button
      onClick={onOpen}
      title="Private skill rank: only you can see it"
      className="w-full rounded-xl border border-white/10 bg-linear-to-br from-white/[0.07] to-transparent p-3 text-left transition-colors hover:border-white/25"
    >
      <div className="flex items-center gap-3">
        <TierEmblem tier={skill.tier} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Skill rank</div>
          <div className={`text-sm font-semibold truncate ${style.text}`}>
            {skill.tier}
            {isRated && <span className="ml-1 text-slate-400 font-normal">· {skill.rating}</span>}
          </div>
        </div>
        <StreakFlame days={progress.daily_streak} className="text-sm" />
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-300" />
          Level {progress.level}
        </span>
        <span>{progress.xp.toLocaleString()} XP</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-amber-300 transition-all duration-700" style={{ width: `${percent}%` }} />
      </div>

      <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
        <Target className={`w-3 h-3 ${goalDone >= progress.daily_goal ? "text-green-400" : "text-orange-300"}`} />
        Daily goal: {goalDone}/{progress.daily_goal} decisions
      </div>
    </button>
  );
}
