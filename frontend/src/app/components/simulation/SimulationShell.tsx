// Shared layout for one email or SMS training round

import type { ReactNode } from "react";
import { ArrowLeft, Flame, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Skeleton } from "../ui/skeleton";
import { CategoryBadge, DifficultyBadge } from "../visuals";
import { DecisionPanel } from "./DecisionPanel";
import { FeedbackPanel } from "./FeedbackPanel";
import { useSimulationRound, type RoundStage, type SimulationRound } from "./useSimulationRound";
import type { Channel, PlayerScenario } from "../../../types/catch";

interface SimulationShellProps {
  channel: Channel;
  title: string;
  reportLabel: string;
  onBack: () => void;
  onNavigate: (page: string) => void;
  renderMessage: (scenario: PlayerScenario, actions?: MessageActions) => ReactNode;
}

/** Clicking a link or opening the attachment counts as trusting the message. */
export interface MessageActions {
  onLinkClick: (url: string) => void;
  onOpenAttachment: (name: string) => void;
}

/** One training round: look, decide, explain, then feedback. */
export function SimulationShell({
  channel,
  title,
  reportLabel,
  onBack,
  onNavigate,
  renderMessage,
}: SimulationShellProps) {
  const round = useSimulationRound(channel);
  const { scenario } = round;

  if (round.isLoading || !scenario) {
    return (
      <SimulationStatus
        isLoading={round.isLoading}
        allCompleted={round.allCompleted}
        message={round.loadError}
        onRetry={() => round.loadScenario()}
        onRetake={() => round.loadScenario(true)}
        onAdaptiveMix={round.focusCategory || round.mode === "review" ? () => round.chooseFocus(null) : null}
        onBack={onBack}
        onViewProgress={() => onNavigate("performance")}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b p-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} title="Back to simulations">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {round.streak >= 2 && (
            <Badge className="bg-amber-500/20 text-amber-300 border-0">
              <Flame className="w-3 h-3" />
              {round.streak} streak
            </Badge>
          )}
          {round.mode === "review" && (
            <Badge className="bg-violet-500/20 text-violet-200 border-0">
              <RotateCcw className="w-3 h-3" />
              Second chance
            </Badge>
          )}
          {round.mode !== "review" && scenario.already_completed && <Badge variant="outline">Retake</Badge>}
          <DifficultyBadge
            difficulty={scenario.difficulty}
            title={scenario.adaptive_context.difficulty_reason}
          />
          <CategoryBadge category={scenario.category} />
        </div>
      </div>

      <PracticeTrack round={round} />
      <CatchSteps stage={round.stage} />

      <div className="flex-1 overflow-y-auto">
        {renderMessage(
          scenario,
          round.stage === "inspect"
            ? { onLinkClick: round.clickLink, onOpenAttachment: round.openAttachment }
            : undefined,
        )}
      </div>

      <div className="border-t p-4 bg-muted/30">
        <div className="max-w-3xl mx-auto">
          <DecisionPanel round={round} reportLabel={reportLabel} />
        </div>
      </div>

      <Dialog open={round.stage === "feedback" && Boolean(round.result)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto [&>button]:hidden">
          <DialogHeader>
            <DialogTitle>Feedback</DialogTitle>
            <DialogDescription>{round.result?.feedback.summary}</DialogDescription>
          </DialogHeader>
          {round.result && (
            <FeedbackPanel
              result={round.result}
              streak={round.streak}
              onNext={() => round.loadScenario()}
              onViewProgress={() => onNavigate("performance")}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const STEPS: Array<{ key: string; label: string }> = [
  { key: "inspect", label: "1 · Inspect & decide" },
  { key: "justify", label: "2 · Justify with clues" },
  { key: "feedback", label: "3 · Feedback & XP" },
];

/** Step indicator for the current stage of the round. */
function CatchSteps({ stage }: { stage: RoundStage }) {
  const currentIndex = STEPS.findIndex((step) => step.key === stage);

  return (
    <div className="border-b px-4 py-2 flex gap-2 text-xs">
      {STEPS.map((step, index) => (
        <div
          key={step.key}
          className={`flex-1 rounded px-2 py-1 text-center transition-colors ${
            index === currentIndex
              ? "bg-sky-500/20 text-sky-200 font-semibold"
              : index < currentIndex
                ? "bg-green-500/10 text-green-300"
                : "bg-muted/40 text-muted-foreground"
          }`}
        >
          {step.label}
        </div>
      ))}
    </div>
  );
}

/** Choose adaptive mix, a category or review mistakes. */
function PracticeTrack({ round }: { round: SimulationRound }) {
  const scenario = round.scenario;
  if (!scenario) return null;

  if (round.mode === "review") {
    return (
      <div className="border-b px-4 py-2 flex flex-wrap items-center gap-2 bg-violet-500/10">
        <RotateCcw className="w-4 h-4 text-violet-300" />
        <span className="text-sm text-violet-100">
          Reviewing a scenario you got wrong before. Spot what you missed last time.
        </span>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => round.chooseFocus(null)}>
          Back to Adaptive mix
        </Button>
      </div>
    );
  }
  if (scenario.practice_categories.length === 0) return null;

  return (
    <div className="border-b px-4 py-2 flex flex-wrap items-center gap-2 bg-muted/20">
      <span className="text-xs font-medium text-muted-foreground">Practice track:</span>
      <Button
        size="sm"
        variant={round.focusCategory ? "outline" : "default"}
        onClick={() => round.chooseFocus(null)}
      >
        <Sparkles className="w-3.5 h-3.5" />
        Adaptive mix
      </Button>
      {scenario.mistakes_to_review > 0 && (
        <Button
          size="sm"
          variant="outline"
          className="border-violet-400/40 text-violet-200 hover:bg-violet-500/15"
          onClick={() => round.chooseMode("review")}
          title="Scenarios you answered wrong come back for a second try"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Review mistakes
          <span className="rounded-full bg-violet-500/30 px-1.5 text-[10px]">{scenario.mistakes_to_review}</span>
        </Button>
      )}
      {scenario.practice_categories.map((category) => (
        <Button
          key={category.name}
          size="sm"
          variant={round.focusCategory === category.name ? "default" : "outline"}
          onClick={() => round.chooseFocus(category.name)}
          title={`${category.available} available${
            category.accuracy === null ? "" : ` · ${category.accuracy}% accuracy`
          }`}
        >
          {category.name}
        </Button>
      ))}
      <span className="text-xs text-muted-foreground ml-auto">
        {round.focusCategory
          ? "Focused practice"
          : `${scenario.practice_category}: ${scenario.category_reason}`}
      </span>
    </div>
  );
}

interface SimulationStatusProps {
  isLoading: boolean;
  allCompleted: boolean;
  message: string;
  onRetry: () => void;
  onRetake: () => void;
  onAdaptiveMix: (() => void) | null;
  onBack: () => void;
  onViewProgress: () => void;
}

/** Loading, error and all-done screens. */
function SimulationStatus(props: SimulationStatusProps) {
  if (props.isLoading) {
    return (
      <div className="h-screen flex flex-col">
        <div className="border-b p-4 flex items-center gap-3">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-6 w-24 ml-auto rounded-full" />
        </div>
        <div className="flex-1 p-6 space-y-4 max-w-3xl w-full mx-auto">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-48 w-full" />
          <p className="text-center text-sm text-muted-foreground animate-pulse">Finding your next scenario...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
      <p className="text-muted-foreground max-w-md">
        {props.message}
      </p>
      {props.allCompleted
        ? <Button onClick={props.onRetake}>Retake a scenario</Button>
        : <Button onClick={props.onRetry}>Try again</Button>}
      {props.onAdaptiveMix && (
        <Button variant="secondary" onClick={props.onAdaptiveMix}>Switch to Adaptive mix</Button>
      )}
      <Button variant="secondary" onClick={props.onViewProgress}>View my progress</Button>
      <Button variant="outline" onClick={props.onBack}>Back to simulations</Button>
    </div>
  );
}
