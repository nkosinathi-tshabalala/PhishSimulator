// Stat card used across the app: a tinted gradient tile with a label, big value, icon and hint

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "./ui/skeleton";

export type StatTone = "sky" | "green" | "violet" | "blue" | "amber" | "red" | "orange" | "pink" | "slate";

const TONES: Record<StatTone, { card: string; icon: string; accent: string }> = {
  sky: { card: "from-sky-500/20 via-sky-500/5 border-sky-500/25", icon: "bg-sky-500/20 text-sky-300", accent: "text-sky-300" },
  green: { card: "from-green-500/20 via-green-500/5 border-green-500/25", icon: "bg-green-500/20 text-green-300", accent: "text-green-300" },
  violet: { card: "from-violet-500/20 via-violet-500/5 border-violet-500/25", icon: "bg-violet-500/20 text-violet-300", accent: "text-violet-300" },
  blue: { card: "from-blue-500/20 via-blue-500/5 border-blue-500/25", icon: "bg-blue-500/20 text-blue-300", accent: "text-blue-300" },
  amber: { card: "from-amber-500/20 via-amber-500/5 border-amber-500/25", icon: "bg-amber-500/20 text-amber-300", accent: "text-amber-300" },
  red: { card: "from-red-500/20 via-red-500/5 border-red-500/25", icon: "bg-red-500/20 text-red-300", accent: "text-red-300" },
  orange: { card: "from-orange-500/20 via-orange-500/5 border-orange-500/25", icon: "bg-orange-500/20 text-orange-300", accent: "text-orange-300" },
  pink: { card: "from-pink-500/20 via-pink-500/5 border-pink-500/25", icon: "bg-pink-500/20 text-pink-300", accent: "text-pink-300" },
  slate: { card: "from-slate-500/20 via-slate-500/5 border-slate-500/25", icon: "bg-slate-500/20 text-slate-300", accent: "text-slate-300" },
};

/** One figure: label, big value, icon and an optional hint line. Clickable when onClick is given. */
export function StatCard({ label, value, hint, icon: Icon, tone, onClick }: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone: StatTone;
  onClick?: () => void;
}) {
  const style = TONES[tone];
  const body = (
    <>
      <div aria-hidden className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-white/5 blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          {value === undefined || value === null ? (
            // No value yet: the figure is still loading
            <Skeleton aria-label="Loading" className="mt-2 h-8 w-16 bg-white/10" />
          ) : (
            <p className="mt-1 text-3xl font-bold text-white tabular-nums">{value}</p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${style.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {hint && <p className={`relative mt-2 text-xs font-medium truncate ${style.accent}`}>{hint}</p>}
    </>
  );
  const className = `relative overflow-hidden rounded-xl border bg-linear-to-br to-transparent p-4 text-left ${style.card}`;

  return onClick ? (
    <button type="button" onClick={onClick} className={`${className} transition-transform hover:-translate-y-0.5 hover:shadow-lg`}>
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}
