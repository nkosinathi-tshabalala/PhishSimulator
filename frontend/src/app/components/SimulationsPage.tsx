// Player page: Training, choose email, SMS or Inbox Rush

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Eye,
  Lightbulb,
  ListChecks,
  Mail,
  MessageSquare,
  ShieldQuestion,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { DifficultyBadge } from "./visuals";
import AnalyticsService from "../../services/analyticsService";

interface SimulationsPageProps {
  onNavigate: (page: string) => void;
}

interface TrainingSummary {
  by_type: Array<{ type: string; attempts: number; accuracy: number }>;
  overall_accuracy: number;
  difficulty: string;
  adaptive_reason: string;
}

const STEPS = [
  { icon: Eye, title: "Look", text: "Read the message the way you would in your own inbox.", color: "text-sky-300 bg-sky-500/15" },
  { icon: ShieldQuestion, title: "Decide", text: "Report it, mark it safe, or act on it if you trust it.", color: "text-red-300 bg-red-500/15" },
  { icon: ListChecks, title: "Explain", text: "Say what made you decide. Your own words earn extra XP.", color: "text-amber-300 bg-amber-500/15" },
  { icon: Lightbulb, title: "Learn", text: "See what you spotted and missed, earn XP and level up.", color: "text-green-300 bg-green-500/15" },
];

/** Training page: pick email, SMS or Inbox Rush. */
export function SimulationsPage({ onNavigate }: SimulationsPageProps) {
  const [summary, setSummary] = useState<TrainingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AnalyticsService.getMyPerformance()
      .then((response) => {
        if (response.ok) setSummary(response.data.data);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const statsFor = (type: string) => summary?.by_type.find((item) => item.type === type);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Choose your training</h1>
            <p className="text-muted-foreground mt-1">
              Short, realistic scenarios. The difficulty adapts to you as you improve.
            </p>
          </div>
          {summary && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              Next difficulty:
              <DifficultyBadge difficulty={summary.difficulty} title={summary.adaptive_reason} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChannelCard
            title="Email phishing"
            text="Work through a realistic inbox. Watch for look-alike senders and fake login links."
            icon={Mail}
            gradient="from-sky-500/35 via-sky-600/15 to-transparent border-sky-500/30"
            accent="text-sky-300"
            stats={statsFor("EMAIL")}
            isLoading={isLoading}
            onStart={() => onNavigate("email")}
          />
          <ChannelCard
            title="SMS smishing"
            text="Texts about parcels, prizes and banks. Can you tell which ones are real?"
            icon={MessageSquare}
            gradient="from-purple-500/35 via-purple-600/15 to-transparent border-purple-500/30"
            accent="text-purple-300"
            stats={statsFor("SMS")}
            isLoading={isLoading}
            onStart={() => onNavigate("sms")}
          />
        </div>

        <button
          type="button"
          onClick={() => onNavigate("triage")}
          className="group w-full relative overflow-hidden rounded-2xl border border-orange-400/30 bg-linear-to-r from-orange-500/25 via-pink-500/15 to-violet-600/15 p-5 text-left transition-transform hover:-translate-y-0.5"
        >
          <div className="absolute inset-0 shine opacity-60" aria-hidden />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-black/25 flex items-center justify-center shrink-0">
              <Zap className="w-7 h-7 text-orange-300" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white">Inbox Rush</h3>
                <span className="rounded-full bg-orange-400/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-100">
                  Challenge
                </span>
              </div>
              <p className="text-sm text-slate-200/80">
                A full inbox of mixed messages. Sort them all against the clock and beat your best time.
              </p>
            </div>
            <ArrowRight className="w-6 h-6 text-orange-200 transition-transform group-hover:translate-x-1" />
          </div>
        </button>

        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300" />
            How each round works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((step, index) => (
              <div key={step.title} className="relative rounded-xl border border-border bg-card p-4">
                <span className="absolute top-3 right-3 text-xs text-muted-foreground">{index + 1}</span>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${step.color}`}>
                  <step.icon className="w-5 h-5" />
                </div>
                <div className="font-semibold">{step.title}</div>
                <p className="text-sm text-muted-foreground mt-1">{step.text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Nothing in a scenario is real, but acting on a message counts as trusting it, just like in a real inbox.
        </p>
      </div>
    </div>
  );
}

/** Start card for one channel with the player's stats. */
function ChannelCard({ title, text, icon: Icon, gradient, accent, stats, isLoading, onStart }: {
  title: string;
  text: string;
  icon: typeof Mail;
  gradient: string;
  accent: string;
  stats?: { attempts: number; accuracy: number };
  isLoading: boolean;
  onStart: () => void;
}) {
  return (
    <div className={`group relative overflow-hidden rounded-2xl border bg-linear-to-br p-6 ${gradient}`}>
      <Icon className={`absolute -right-4 -bottom-4 w-32 h-32 opacity-10 ${accent}`} aria-hidden />
      <div className={`w-12 h-12 rounded-xl bg-black/25 flex items-center justify-center mb-4 ${accent}`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-xl font-bold text-white">{title}</h3>
      <p className="text-sm text-slate-200/80 mt-1 max-w-sm">{text}</p>

      <div className="flex gap-6 mt-5 text-sm">
        {isLoading ? (
          <Skeleton className="h-10 w-40" />
        ) : (
          <>
            <div>
              <div className="text-2xl font-bold text-white">{stats?.attempts ?? 0}</div>
              <div className="text-xs text-slate-300/70">completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats?.attempts ? `${stats.accuracy}%` : "–"}</div>
              <div className="text-xs text-slate-300/70">accuracy</div>
            </div>
          </>
        )}
      </div>

      <Button className="mt-5 bg-white text-slate-900 hover:bg-slate-100" onClick={onStart}>
        Start {title.split(" ")[0].toLowerCase()} training
        <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
      </Button>
    </div>
  );
}
