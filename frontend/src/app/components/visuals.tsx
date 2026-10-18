// Small coloured labels (badges) used across the app

import {
  AtSign,
  Briefcase,
  Building2,
  Gift,
  GraduationCap,
  KeyRound,
  Landmark,
  LayoutGrid,
  Mail,
  MessageSquare,
  Package,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
} from "lucide-react";
import type { ScenarioStatus } from "../../types/catch";

export const CATEGORY_STYLES: Record<string, { icon: typeof Tag; className: string }> = {
  "Banking & Money": { icon: Landmark, className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  Delivery: { icon: Package, className: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
  Government: { icon: Building2, className: "bg-yellow-500/15 text-yellow-200 border-yellow-500/30" },
  Employment: { icon: Briefcase, className: "bg-teal-500/15 text-teal-300 border-teal-500/30" },
  University: { icon: GraduationCap, className: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" },
  "Account Security": { icon: KeyRound, className: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  "Email & IT": { icon: LayoutGrid, className: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  "Social Media": { icon: AtSign, className: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30" },
  "Prizes & Offers": { icon: Gift, className: "bg-pink-500/15 text-pink-300 border-pink-500/30" },
};

const DIFFICULTY_STYLES: Record<string, string> = {
  Easy: "bg-green-500/15 text-green-300 border-green-500/30",
  Medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Hard: "bg-red-500/15 text-red-300 border-red-500/30",
};

export const STATUS_STYLES: Record<ScenarioStatus, string> = {
  DRAFT: "bg-slate-500/20 text-slate-200 border-slate-500/30",
  APPROVED: "bg-green-500/20 text-green-300 border-green-500/30",
  ACTIVE: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  ARCHIVED: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  REJECTED: "bg-red-500/20 text-red-300 border-red-500/30",
};

const PILL = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap";

/** Category label. */
export function CategoryBadge({ category }: { category: string }) {
  const style = CATEGORY_STYLES[category] ?? { icon: Tag, className: "bg-muted text-foreground border-border" };
  const Icon = style.icon;
  return (
    <span className={`${PILL} ${style.className}`}>
      <Icon className="w-3 h-3" />
      {category}
    </span>
  );
}

/** Easy, Medium or Hard label. */
export function DifficultyBadge({ difficulty, title }: { difficulty: string; title?: string }) {
  const bars = { Easy: 1, Medium: 2, Hard: 3 }[difficulty] ?? 1;
  return (
    <span className={`${PILL} ${DIFFICULTY_STYLES[difficulty] ?? ""}`} title={title}>
      <span className="flex items-end gap-px" aria-hidden>
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={`w-0.5 rounded-sm ${bar <= bars ? "bg-current" : "bg-current/25"}`}
            style={{ height: `${4 + bar * 2}px` }}
          />
        ))}
      </span>
      {difficulty}
    </span>
  );
}

/** Email or SMS label. */
export function ChannelBadge({ channel }: { channel: string }) {
  const isEmail = channel.toUpperCase() === "EMAIL";
  const Icon = isEmail ? Mail : MessageSquare;
  return (
    <span
      className={`${PILL} ${
        isEmail ? "bg-sky-500/15 text-sky-300 border-sky-500/30" : "bg-purple-500/15 text-purple-300 border-purple-500/30"
      }`}
    >
      <Icon className="w-3 h-3" />
      {isEmail ? "Email" : "SMS"}
    </span>
  );
}

/** Review status label. */
export function StatusBadge({ status }: { status: ScenarioStatus }) {
  return <span className={`${PILL} ${STATUS_STYLES[status]}`}>{status}</span>;
}

/** Phishing or Safe label. */
export function AnswerBadge({ answer }: { answer: "REPORT" | "SAFE" }) {
  const isPhishing = answer === "REPORT";
  const Icon = isPhishing ? ShieldAlert : ShieldCheck;
  return (
    <span
      className={`${PILL} ${
        isPhishing ? "bg-red-500/15 text-red-300 border-red-500/30" : "bg-green-500/15 text-green-300 border-green-500/30"
      }`}
    >
      <Icon className="w-3 h-3" />
      {isPhishing ? "Phishing" : "Genuine"}
    </span>
  );
}

/** Automatic 0-100 quality score of a generated scenario (higher is better). */
export function QualityBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return <span className={`${PILL} bg-muted text-muted-foreground border-border`}>Not scored</span>;
  }
  const tone = score >= 80
    ? "bg-green-500/15 text-green-300 border-green-500/30"
    : score >= 60
      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
      : "bg-red-500/15 text-red-300 border-red-500/30";
  return (
    <span className={`${PILL} ${tone}`} title="Automatic quality score">
      <Sparkles className="w-3 h-3" />
      {score}
    </span>
  );
}
