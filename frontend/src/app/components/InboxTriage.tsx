// Player page: Inbox Rush, sort a whole inbox against the clock

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Inbox,
  LoaderCircle,
  Mail,
  MessageSquare,
  MousePointerClick,
  Paperclip,
  Play,
  RotateCcw,
  ShieldCheck,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Skeleton } from "./ui/skeleton";
import { Confetti } from "./progress/Celebration";
import { EmailReader } from "./EmailSimulation";
import { PhoneView } from "./SMSSimulation";
import { parseSender } from "./simulation/EmailParts";
import { DifficultyBadge } from "./visuals";
import ScenarioService from "../../services/scenarioService";
import type { AttemptResult, Channel, Decision, MessageView, Trap, TriageBatch } from "../../types/catch";

interface InboxTriageProps {
  onBack: () => void;
  onNavigate: (page: string) => void;
}

/** How the player sorted one message. */
interface Sorting {
  decision: Decision | null;
  trap: Trap | null;
  clues: string[];
  note: string;
}

interface ScoredMessage {
  message: MessageView;
  sorting: Sorting;
  result: AttemptResult;
}

type Phase = "intro" | "sorting" | "submitting" | "results";

const EMPTY_SORTING: Sorting = { decision: null, trap: null, clues: [], note: "" };

/** Browser storage key for the best time on a channel. */
function bestTimeKey(channel: Channel) {
  return `inbox_rush_best_${channel}`;
}

/** The saved best time, if any. */
function readBestTime(channel: Channel) {
  try {
    const value = Number(localStorage.getItem(bestTimeKey(channel)));
    return value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Save a new best time. */
function saveBestTime(channel: Channel, seconds: number) {
  try {
    localStorage.setItem(bestTimeKey(channel), String(seconds));
  } catch {
  }
}

/** Seconds as m:ss. */
function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** A message is sorted once it has a decision and at least one reason. */
function isSorted(sorting?: Sorting) {
  if (!sorting || !sorting.decision) return false;
  return sorting.clues.length > 0 || sorting.note.trim().length >= 3;
}

/** Inbox Rush: sort a small inbox against the clock, then see the score. */
export function InboxTriage({ onBack, onNavigate }: InboxTriageProps) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [channel, setChannel] = useState<Channel>("EMAIL");
  const [batch, setBatch] = useState<TriageBatch | null>(null);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState(0);
  const [sortings, setSortings] = useState<Record<number, Sorting>>({});
  const [results, setResults] = useState<ScoredMessage[]>([]);
  const [submitError, setSubmitError] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [bestTime, setBestTime] = useState<number | null>(null);

  useEffect(() => {
    if (phase !== "sorting" || !batch) return;
    const timer = window.setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [phase, batch, startedAt]);

  const startRush = async () => {
    setPhase("sorting");
    setBatch(null);
    setLoadError("");
    setSortings({});
    setResults([]);
    setSubmitError("");
    setSelected(0);
    setElapsed(0);
    setBestTime(readBestTime(channel));

    const response = await ScenarioService.getTriageBatch(channel);
    if (response.ok && response.data.success) {
      setBatch(response.data.data);
      setStartedAt(Date.now());
    } else {
      setLoadError(response.data.message || "Unable to load the inbox.");
    }
  };

  const messages = batch?.messages ?? [];
  const current = messages[selected];
  const currentSorting = current ? sortings[current.scenario_id] ?? EMPTY_SORTING : EMPTY_SORTING;
  const sortedCount = messages.filter((message) => isSorted(sortings[message.scenario_id])).length;
  const allSorted = messages.length > 0 && sortedCount === messages.length;

  const updateCurrent = (change: Partial<Sorting>) => {
    if (!current) return;
    setSortings((all) => ({
      ...all,
      [current.scenario_id]: { ...(all[current.scenario_id] ?? EMPTY_SORTING), ...change },
    }));
  };

  /** Clicking a link or opening a file means the player trusted the message. */
  const springTrap = (trap: Trap) => {
    if (currentSorting.trap) return;
    updateCurrent({ decision: "SAFE", trap });
  };

  const toggleClue = (clue: string) => {
    const clues = currentSorting.clues;
    updateCurrent({ clues: clues.includes(clue) ? clues.filter((item) => item !== clue) : [...clues, clue] });
  };

  /** Jump to the next message that still needs sorting. */
  const goToNextUnsorted = () => {
    for (let step = 1; step <= messages.length; step++) {
      const index = (selected + step) % messages.length;
      if (!isSorted(sortings[messages[index].scenario_id])) {
        setSelected(index);
        return;
      }
    }
  };

  /** Send every decision to the server to be scored. */
  const submitInbox = async () => {
    setPhase("submitting");
    setSubmitError("");
    const scored: ScoredMessage[] = [];

    for (const message of messages) {
      const sorting = sortings[message.scenario_id];
      const response = await ScenarioService.submitAttempt({
        scenario_id: message.scenario_id,
        player_answer: sorting.decision ?? "SAFE",
        selected_clues: sorting.clues,
        justification: sorting.note.trim(),
        clicked_link: sorting.trap === "LINK",
        opened_attachment: sorting.trap === "ATTACHMENT",
      });
      if (response.ok && response.data.success) {
        scored.push({ message, sorting, result: response.data.data });
      }
    }

    if (!scored.length) {
      setSubmitError("Your answers could not be saved. Please try again.");
      setPhase("sorting");
      return;
    }

    if (!bestTime || elapsed < bestTime) {
      saveBestTime(channel, elapsed);
      setBestTime(elapsed);
    }
    setResults(scored);
    setPhase("results");
  };

  if (phase === "intro") {
    return (
      <RushIntro
        channel={channel}
        bestTime={readBestTime(channel)}
        onChannelChange={setChannel}
        onStart={startRush}
        onBack={onBack}
      />
    );
  }

  if (phase === "results") {
    return (
      <TriageResults
        results={results}
        total={messages.length}
        seconds={elapsed}
        bestTime={bestTime}
        onPlayAgain={startRush}
        onChangeMode={() => setPhase("intro")}
        onViewProgress={() => onNavigate("performance")}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      <RushHeader
        channel={channel}
        batch={batch}
        elapsed={elapsed}
        sortedCount={sortedCount}
        total={messages.length}
        onQuit={() => setPhase("intro")}
      />

      {!batch && !loadError && (
        <div className="flex-1 grid md:grid-cols-[18rem_1fr]">
          <div className="border-r p-3 space-y-2">
            {[1, 2, 3, 4, 5].map((row) => <Skeleton key={row} className="h-16" />)}
          </div>
          <div className="p-6 space-y-3">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-64" />
          </div>
        </div>
      )}

      {loadError && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-6">
          <p className="text-muted-foreground">{loadError}</p>
          <Button onClick={startRush}>Try again</Button>
        </div>
      )}

      {batch && current && (
        <div className="flex-1 flex min-h-0 flex-col md:flex-row">
          <aside className="md:w-72 border-b md:border-b-0 md:border-r flex md:flex-col overflow-x-auto md:overflow-y-auto shrink-0 bg-black/10">
            <div className="hidden md:flex items-center gap-2 p-3 border-b text-sm font-semibold">
              <Inbox className="w-4 h-4 text-sky-300" />
              Inbox
              <span className="ml-auto text-xs font-normal text-muted-foreground">{messages.length} messages</span>
            </div>
            {messages.map((message, index) => (
              <InboxRow
                key={message.scenario_id}
                message={message}
                isSorted={isSorted(sortings[message.scenario_id])}
                isSelected={index === selected}
                onClick={() => setSelected(index)}
              />
            ))}
          </aside>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto">
              {current.simulation_type === "SMS" ? (
                <PhoneView
                  scenario={current}
                  actions={{ onLinkClick: () => springTrap("LINK"), onOpenAttachment: () => springTrap("ATTACHMENT") }}
                />
              ) : (
                <EmailReader
                  scenario={current}
                  actions={{ onLinkClick: () => springTrap("LINK"), onOpenAttachment: () => springTrap("ATTACHMENT") }}
                />
              )}
            </div>
            <SortingPanel
              message={current}
              sorting={currentSorting}
              onDecide={(decision) => updateCurrent({ decision })}
              onToggleClue={toggleClue}
              onNoteChange={(note) => updateCurrent({ note })}
              onNext={goToNextUnsorted}
              remaining={messages.length - sortedCount}
              canSubmit={allSorted}
              isSubmitting={phase === "submitting"}
              submitError={submitError}
              onSubmit={submitInbox}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Start screen: pick a channel and read the rules. */
function RushIntro({ channel, bestTime, onChannelChange, onStart, onBack }: {
  channel: Channel;
  bestTime: number | null;
  onChannelChange: (channel: Channel) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  const rules = [
    { icon: Inbox, text: "You get a small inbox of mixed messages. Some are real, some are not." },
    { icon: ShieldCheck, text: "Report or mark each one safe, and say why with a clue or your own words." },
    { icon: Trophy, text: "Submit when every message is sorted to see your score, time and XP." },
  ];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
          <ArrowLeft className="w-4 h-4" />
          Back to training
        </Button>

        <div className="relative overflow-hidden rounded-2xl border border-orange-400/30 bg-linear-to-br from-orange-500/25 via-pink-500/15 to-violet-600/15 p-8 text-center">
          <div className="absolute inset-0 shine opacity-60" aria-hidden />
          <div className="relative mx-auto w-16 h-16 rounded-2xl bg-black/25 flex items-center justify-center">
            <Zap className="w-8 h-8 text-orange-300" />
          </div>
          <h1 className="relative mt-4 text-3xl font-extrabold text-white">Inbox Rush</h1>
          <p className="relative mt-2 text-sm text-slate-200/80">
            Sort a whole inbox against the clock.
          </p>
          {bestTime && (
            <p className="relative mt-3 inline-flex items-center gap-1 rounded-full bg-black/25 px-3 py-1 text-xs text-amber-200">
              <Trophy className="w-3.5 h-3.5" />
              Your best {channel === "EMAIL" ? "email" : "SMS"} time: {formatTime(bestTime)}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Choose your inbox</p>
          <div className="grid grid-cols-2 gap-3">
            <ChannelOption
              label="Email"
              icon={Mail}
              isSelected={channel === "EMAIL"}
              tone="border-sky-400 bg-sky-500/15 text-sky-200"
              onClick={() => onChannelChange("EMAIL")}
            />
            <ChannelOption
              label="SMS"
              icon={MessageSquare}
              isSelected={channel === "SMS"}
              tone="border-purple-400 bg-purple-500/15 text-purple-200"
              onClick={() => onChannelChange("SMS")}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/70 p-4 space-y-3">
          <p className="text-sm font-semibold">How it works</p>
          {rules.map((rule, index) => (
            <div key={index} className="flex items-start gap-3 text-sm text-muted-foreground">
              <span className="w-7 h-7 rounded-lg bg-orange-400/15 flex items-center justify-center shrink-0">
                <rule.icon className="w-4 h-4 text-orange-300" />
              </span>
              {rule.text}
            </div>
          ))}
        </div>

        <Button size="lg" className="w-full bg-white text-slate-900 hover:bg-orange-50" onClick={onStart}>
          <Play className="w-4 h-4" />
          Start the clock
        </Button>
      </div>
    </div>
  );
}

/** Email or SMS choice button. */
function ChannelOption({ label, icon: Icon, isSelected, tone, onClick }: {
  label: string;
  icon: typeof Mail;
  isSelected: boolean;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl border p-4 font-semibold transition-colors ${
        isSelected ? tone : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );
}

/** Title, timer and sorting progress bar. */
function RushHeader({ channel, batch, elapsed, sortedCount, total, onQuit }: {
  channel: Channel;
  batch: TriageBatch | null;
  elapsed: number;
  sortedCount: number;
  total: number;
  onQuit: () => void;
}) {
  const percent = total ? Math.round((sortedCount / total) * 100) : 0;

  return (
    <div className="border-b">
      <div className="p-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onQuit} title="Quit this rush">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="w-10 h-10 rounded-lg bg-linear-to-br from-orange-500/30 to-pink-500/20 flex items-center justify-center">
          <Zap className="w-5 h-5 text-orange-300" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Inbox Rush</h2>
          <p className="text-xs text-muted-foreground">{channel === "EMAIL" ? "Email" : "SMS"} inbox</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {batch && <DifficultyBadge difficulty={batch.difficulty} title={batch.difficulty_reason} />}
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm font-mono">
            <Clock className="w-3.5 h-3.5 text-sky-300" />
            {formatTime(elapsed)}
          </span>
        </div>
      </div>
      <div className="px-4 pb-3">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{sortedCount} of {total} sorted</span>
          <span>{percent}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-linear-to-r from-orange-400 to-pink-400 transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/** One message in the inbox list. */
function InboxRow({ message, isSorted, isSelected, onClick }: {
  message: MessageView;
  isSorted: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const preview = message.message.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-56 md:min-w-0 w-full text-left p-3 border-b border-l-2 transition-colors ${
        isSelected ? "bg-sky-500/10 border-l-sky-400" : "border-l-transparent hover:bg-white/5"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`text-sm truncate ${isSorted ? "text-muted-foreground" : "font-semibold"}`}>
          {parseSender(message.sender).name}
        </span>
        <span className="ml-auto shrink-0">
          {isSorted
            ? <CheckCircle2 className="w-4 h-4 text-green-400" />
            : <span className="block w-2 h-2 rounded-full bg-sky-400" />}
        </span>
      </div>
      {message.subject && <div className="text-xs truncate">{message.subject}</div>}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {message.attachment && <Paperclip className="w-3 h-3 shrink-0" />}
        <span className="truncate">{preview}</span>
      </div>
    </button>
  );
}

/** Report or Safe, the reasons, and the submit button. */
function SortingPanel({
  message, sorting, onDecide, onToggleClue, onNoteChange, onNext,
  remaining, canSubmit, isSubmitting, submitError, onSubmit,
}: {
  message: MessageView;
  sorting: Sorting;
  onDecide: (decision: Decision) => void;
  onToggleClue: (clue: string) => void;
  onNoteChange: (note: string) => void;
  onNext: () => void;
  remaining: number;
  canSubmit: boolean;
  isSubmitting: boolean;
  submitError: string;
  onSubmit: () => void;
}) {
  const sorted = isSorted(sorting);

  return (
    <div className="border-t bg-card/80 p-4 space-y-3">
      {sorting.trap && (
        <p className="text-xs text-amber-200 flex items-center gap-1">
          {sorting.trap === "LINK" ? <MousePointerClick className="w-3.5 h-3.5" /> : <Paperclip className="w-3.5 h-3.5" />}
          You {sorting.trap === "LINK" ? "clicked a link in" : "opened the attachment of"} this message,
          so you trusted it. What made you trust it?
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={sorting.decision === "REPORT" ? "destructive" : "outline"}
          disabled={Boolean(sorting.trap)}
          onClick={() => onDecide("REPORT")}
        >
          <AlertTriangle className="w-4 h-4" />
          Report
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={sorting.decision === "SAFE" ? "border-green-500/60 bg-green-500/15 text-green-300" : ""}
          disabled={Boolean(sorting.trap)}
          onClick={() => onDecide("SAFE")}
        >
          <ShieldCheck className="w-4 h-4" />
          Safe
        </Button>
        {!sorting.decision && (
          <span className="text-xs text-muted-foreground">Is this message safe?</span>
        )}
      </div>

      {sorting.decision && (
        <div className="space-y-2 animate-in fade-in">
          <p className="text-xs text-muted-foreground">Why? Pick a clue or write your own:</p>
          <div className="flex flex-wrap gap-2">
            {message.clue_options.map((clue) => {
              const isOn = sorting.clues.includes(clue);
              return (
                <button
                  key={clue}
                  type="button"
                  aria-pressed={isOn}
                  onClick={() => onToggleClue(clue)}
                  className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors ${
                    isOn ? "border-sky-400 bg-sky-400/15 text-white" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isOn && <Check className="w-3 h-3 text-sky-400" />}
                  {clue}
                </button>
              );
            })}
          </div>
          <Input
            value={sorting.note}
            maxLength={500}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="Optional: write your own clues for more XP"
            className="h-8 text-sm"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
        {submitError && <span className="mr-auto text-xs text-destructive">{submitError}</span>}
        {!canSubmit && (
          <span className="mr-auto text-xs text-muted-foreground">
            Sort {remaining} more {remaining === 1 ? "message" : "messages"} to submit
          </span>
        )}
        {sorted && !canSubmit && (
          <Button size="sm" variant="outline" onClick={onNext}>
            Next message
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
        <Button
          size="sm"
          disabled={!canSubmit || isSubmitting}
          onClick={onSubmit}
          className={canSubmit ? "bg-linear-to-r from-orange-500 to-pink-500 text-white shadow-lg shadow-orange-500/20" : ""}
        >
          {isSubmitting && <LoaderCircle className="w-4 h-4 animate-spin" />}
          {canSubmit ? "Submit inbox and see my score" : "Submit inbox"}
        </Button>
      </div>
    </div>
  );
}

/** Score, time, XP and every answer after submitting. */
function TriageResults({ results, total, seconds, bestTime, onPlayAgain, onChangeMode, onViewProgress }: {
  results: ScoredMessage[];
  total: number;
  seconds: number;
  bestTime: number | null;
  onPlayAgain: () => void;
  onChangeMode: () => void;
  onViewProgress: () => void;
}) {
  const correct = results.filter((item) => item.result.correct).length;
  const xp = results.reduce((sum, item) => sum + item.result.xp_earned, 0);
  const isPerfect = correct === results.length;
  const isNewBest = bestTime === seconds;
  const levelUp = results.some((item) => item.result.changes.level_up);
  const score = Math.round((correct / results.length) * 100);

  return (
    <div className="h-full overflow-y-auto p-6">
      {correct >= results.length - 1 && <Confetti pieces={isPerfect ? 90 : 50} />}
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="relative overflow-hidden rounded-2xl border border-orange-400/30 bg-linear-to-br from-orange-500/25 via-pink-500/15 to-violet-600/15 p-6 text-center">
          <div className="absolute inset-0 shine" aria-hidden />
          <Trophy className="relative w-12 h-12 mx-auto text-amber-300" />
          <div className="relative mt-2 text-5xl font-extrabold text-white">{score}%</div>
          <h2 className="relative mt-1 text-lg font-semibold text-white">
            {isPerfect ? "Perfect inbox!" : `${correct} of ${results.length} sorted correctly`}
          </h2>
          <div className="relative mt-4 flex flex-wrap justify-center gap-3 text-sm">
            <span className="rounded-full bg-black/25 px-3 py-1 text-amber-200">+{xp} XP</span>
            <span className="rounded-full bg-black/25 px-3 py-1 text-sky-200">
              <Clock className="inline w-3.5 h-3.5 mr-1" />
              {formatTime(seconds)}{isNewBest && " · new best!"}
            </span>
            {levelUp && <span className="rounded-full bg-black/25 px-3 py-1 text-green-200">Level up!</span>}
          </div>
          {results.length < total && (
            <p className="relative mt-3 text-xs text-amber-200">
              {total - results.length} answer(s) could not be saved and are not counted.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Your answers</h3>
          {results.map(({ message, sorting, result }) => (
            <ResultRow key={message.scenario_id} message={message} sorting={sorting} result={result} />
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button className="flex-1" onClick={onPlayAgain}>
            <RotateCcw className="w-4 h-4" />
            New inbox
          </Button>
          <Button className="flex-1" variant="outline" onClick={onViewProgress}>View my progress</Button>
          <Button className="flex-1" variant="ghost" onClick={onChangeMode}>Change inbox</Button>
        </div>
      </div>
    </div>
  );
}

/** One message's answer compared with the right one. */
function ResultRow({ message, sorting, result }: ScoredMessage) {
  const answerLabel = (decision: Decision) => (decision === "REPORT" ? "Phishing" : "Safe");
  const yourAnswer = sorting.trap
    ? (sorting.trap === "LINK" ? "Clicked the link" : "Opened the file")
    : answerLabel(sorting.decision ?? "SAFE");

  return (
    <div
      className={`rounded-lg border-l-4 border border-border bg-card/70 p-3 ${
        result.correct ? "border-l-green-500" : "border-l-red-500"
      }`}
    >
      <div className="flex items-start gap-2">
        {result.correct
          ? <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
          : <XCircle className="w-5 h-5 text-red-400 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">
            {message.subject || parseSender(message.sender).name}
          </div>
          <div className="text-xs text-muted-foreground">
            You said: {yourAnswer} · Answer: {answerLabel(result.correct_answer)}
          </div>
          <div className="text-xs mt-1">{result.feedback.headline}</div>
          {result.feedback.clues_missed.length > 0 && (
            <div className="mt-1 text-xs text-amber-200">
              Missed: {result.feedback.clues_missed.map((clue) => clue.name).join(", ")}
            </div>
          )}
        </div>
        <span className="text-xs font-semibold text-amber-300">+{result.xp_earned} XP</span>
      </div>
    </div>
  );
}
