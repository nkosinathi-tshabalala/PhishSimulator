// Public home page

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Fish,
  Mail,
  MessageSquare,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "./ui/button";
import AnalyticsService from "../../services/analyticsService";

interface LandingPageProps {
  onNavigate: (page: string) => void;
}

/** Public home page with the sign-in and register links. */
export function LandingPage({ onNavigate }: LandingPageProps) {
  const [platformSummary, setPlatformSummary] = useState({
    registered_players: 0,
    simulation_attempts: 0,
    platform_accuracy: 0,
  });

  useEffect(() => {
    const loadPlatformSummary = async () => {
      const response = await AnalyticsService.getPublicPlatformSummary();
      if (response.ok && response.data.success) {
        setPlatformSummary(response.data.data);
      }
    };

    loadPlatformSummary();
  }, []);

  const capabilities = [
    {
      icon: Mail,
      title: "Email simulations",
      description: "Analyze sender identity, message content, and social-engineering signals in realistic inbox scenarios.",
      tone: "bg-sky-500/15 text-sky-300",
    },
    {
      icon: MessageSquare,
      title: "SMS simulations",
      description: "Practice identifying smishing attempts built around the urgency and link patterns used in mobile attacks.",
      tone: "bg-purple-500/15 text-purple-300",
    },
    {
      icon: Target,
      title: "Adaptive training",
      description: "Difficulty responds to learner performance so every scenario remains relevant and useful.",
      tone: "bg-amber-500/15 text-amber-300",
    },
    {
      icon: BarChart3,
      title: "Evidence-led progress",
      description: "Track accuracy, missed cues, false positives, and simulation history in one operational view.",
      tone: "bg-green-500/15 text-green-300",
    },
  ];

  return (
    <main className="min-h-screen bg-[#05080c] text-slate-200">
      <section
        className="relative isolate min-h-190 overflow-hidden bg-[#05080c]"
        style={{
          backgroundImage: "linear-gradient(90deg, rgba(5, 8, 12, 0.97) 0%, rgba(5, 8, 12, 0.88) 42%, rgba(5, 8, 12, 0.55) 100%), url('/assets/IMG_5599.jpeg')",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(rgba(56,189,248,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.06)_1px,transparent_1px)] bg-size-[48px_48px] opacity-30" />
        <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
          <button className="flex items-center gap-3 text-left" onClick={() => onNavigate("landing")}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-sky-400 to-indigo-500 shadow-lg shadow-sky-500/20">
              <Fish className="h-5 w-5 text-white" />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-[0.12em] text-white">PHISHSIMULATOR</span>
              <span className="block text-xs text-sky-400">Security awareness training</span>
            </span>
          </button>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => onNavigate("login")}
              className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              Sign in
            </Button>
            <Button onClick={() => onNavigate("register")} className="bg-sky-400 text-[#04121c] hover:bg-sky-300">
              Create account
            </Button>
          </div>
        </nav>

        <div className="relative mx-auto flex min-h-152.5 max-w-7xl flex-col justify-center px-6 pb-36 pt-16 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-xs font-medium tracking-[0.14em] text-sky-300">
              <Sparkles className="h-3.5 w-3.5" />
              LIVE TRAINING ENVIRONMENT
            </div>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-normal text-white md:text-7xl">
              Learn to spot the signals before an attack becomes an incident.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">
              Scenario-based phishing awareness training for email and SMS. Build practical judgment through adaptive simulations and immediate, evidence-based feedback.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => onNavigate("register")} className="bg-sky-400 px-6 text-[#04121c] hover:bg-sky-300">
                Begin training
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => onNavigate("login")} className="border-white/25 bg-black/10 px-6 text-white hover:bg-white/10 hover:text-white">
                Access workspace
              </Button>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-[#05080c]/85 backdrop-blur-sm">
          <div className="mx-auto grid max-w-7xl grid-cols-3 divide-x divide-white/10 px-6 lg:px-8">
            {[
              [platformSummary.registered_players.toLocaleString(), "Learners enrolled"],
              [platformSummary.simulation_attempts.toLocaleString(), "Simulations completed"],
              [`${platformSummary.platform_accuracy}%`, "Verified decisions"],
            ].map(([value, label]) => (
              <div key={label} className="py-6 text-center sm:text-left sm:pl-8 first:sm:pl-0">
                <p className="text-2xl font-semibold text-white sm:text-3xl">{value}</p>
                <p className="mt-1 text-xs tracking-[0.08em] text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        className="relative isolate overflow-hidden border-b border-white/10 bg-[#080b11] px-6 py-20 lg:px-8"
        style={{
          backgroundImage:
            "linear-gradient(rgba(8,11,17,0.94), rgba(8,11,17,0.97)), url('/assets/IMG_5597.jpeg')",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="relative mx-auto max-w-7xl">
          <div className="grid gap-8 border-b border-white/10 pb-12 lg:grid-cols-[1fr_2fr]">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-sky-400">TRAINING SYSTEM</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight text-white">Built for practice, not passive compliance.</h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-slate-400">
              Every exercise connects a decision to the phishing cues behind it. Learners see what they missed, then return to a performance record that shows where to focus next.
            </p>
          </div>
          <div className="grid divide-y divide-white/10 md:grid-cols-2 md:divide-x md:divide-y-0">
            {capabilities.map((capability) => (
              <article key={capability.title} className="group flex gap-5 py-8 md:px-8 md:first:pl-0 md:nth-[2n+1]:pl-0">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${capability.tone}`}>
                  <capability.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-white">{capability.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{capability.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className="relative isolate overflow-hidden bg-[#05080c] px-6 py-16 lg:px-8"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(5,8,12,0.95) 0%, rgba(5,8,12,0.75) 55%, rgba(5,8,12,0.9) 100%), url('/assets/IMG_5598.jpeg')",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="relative mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.14em] text-sky-400">READY TO TRAIN</p>
            <h2 className="mt-4 text-3xl font-semibold text-white">Turn every suspicious message into a stronger decision.</h2>
          </div>
          <Button size="lg" onClick={() => onNavigate("register")} className="bg-sky-400 px-6 text-[#04121c] hover:bg-sky-300">
            Create learner account
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      <footer className="bg-[#05080c] px-6 py-6 text-sm text-slate-500 lg:px-8 border-t border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <span>PhishSimulator</span>
          <span>Scenario-based phishing awareness training</span>
        </div>
      </footer>
    </main>
  );
}
