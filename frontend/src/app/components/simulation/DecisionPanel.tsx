// Decide and explain buttons for a training round (CATCH "Test")

import { useEffect } from "react";
import { AlertTriangle, ArrowLeft, Check, LoaderCircle, MousePointerClick, Paperclip, ShieldCheck } from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import type { SimulationRound } from "./useSimulationRound";

interface DecisionPanelProps {
  round: SimulationRound;
  reportLabel: string;
}

const MAX_REASON_LENGTH = 500;

/** CATCH "Test" stage: decide first, then justify with clues. */
export function DecisionPanel({ round, reportLabel }: DecisionPanelProps) {
  if (round.stage === "justify") {
    return <JustifyStep round={round} />;
  }
  return <DecideStep round={round} reportLabel={reportLabel} />;
}

/** Report or Mark Safe buttons (R and S keys). */
function DecideStep({ round, reportLabel }: DecisionPanelProps) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return;
      if (event.key.toLowerCase() === "r") round.decide("REPORT");
      if (event.key.toLowerCase() === "s") round.decide("SAFE");
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [round]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-center text-muted-foreground">
        Look at this message the way you would in your own inbox. What would you do?
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button variant="destructive" onClick={() => round.decide("REPORT")}>
          <AlertTriangle className="w-4 h-4 mr-2" />
          {reportLabel}
          <kbd className="ml-2 rounded bg-black/20 px-1.5 text-[10px]">R</kbd>
        </Button>
        <Button
          variant="outline"
          className="border-green-500/40 text-green-400 hover:bg-green-500/10"
          onClick={() => round.decide("SAFE")}
        >
          <ShieldCheck className="w-4 h-4 mr-2" />
          Mark as Safe
          <kbd className="ml-2 rounded bg-white/10 px-1.5 text-[10px]">S</kbd>
        </Button>
      </div>
    </div>
  );
}

/** Pick clues or write reasons, then submit. */
function JustifyStep({ round }: { round: SimulationRound }) {
  const scenario = round.scenario;
  if (!scenario) return null;

  const decisionText = round.decision === "REPORT" ? "reported this message" : "marked this message as safe";

  return (
    <div className="space-y-3">
      {round.trap ? (
        <TrapNotice kind={round.trap.kind} target={round.trap.target} />
      ) : (
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-semibold">
            You {decisionText}. <span className="text-sky-400">Why?</span>
          </h4>
          <Button variant="ghost" size="sm" onClick={round.changeDecision}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Change decision
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Pick the clues behind your decision, or write your own below.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {scenario.clue_options.map((clue) => {
          const isSelected = round.selectedClues.includes(clue);
          return (
            <button
              key={clue}
              type="button"
              aria-pressed={isSelected}
              onClick={() => round.toggleClue(clue)}
              className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors ${
                isSelected
                  ? "border-sky-400 bg-sky-400/15 text-white"
                  : "border-border bg-muted/40 text-muted-foreground hover:border-sky-400/50 hover:text-foreground"
              }`}
            >
              {isSelected && <Check className="w-3.5 h-3.5 text-sky-400" />}
              {clue}
            </button>
          );
        })}
      </div>

      <Textarea
        value={round.justification}
        onChange={(event) => round.setJustification(event.target.value.slice(0, MAX_REASON_LENGTH))}
        placeholder="Optional: write your own clues in your own words for more XP"
        rows={2}
      />

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {round.selectedClues.length} clue(s) selected
        </span>
        <Button onClick={round.submit} disabled={round.isSubmitting}>
          {round.isSubmitting && <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />}
          Submit answer
        </Button>
      </div>

      {round.submitError && (
        <p className="text-sm text-destructive" role="alert">{round.submitError}</p>
      )}
    </div>
  );
}

/** A click or an opened file can't be undone, just like in a real inbox. */
function TrapNotice({ kind, target }: { kind: "LINK" | "ATTACHMENT"; target: string }) {
  const isLink = kind === "LINK";
  const Icon = isLink ? MousePointerClick : Paperclip;
  const domain = target.replace(/^https?:\/\//, "").split("/")[0];

  return (
    <div className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 animate-in fade-in slide-in-from-bottom-2">
      <Icon className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
      <div>
        <h4 className="font-semibold text-amber-200">
          {isLink ? "You clicked a link to " : "You opened "}
          <span className="font-mono">{isLink ? domain : target}</span>
        </h4>
        <p className="text-xs text-amber-100/80">
          {isLink ? "Clicking" : "Opening a file"} means you trusted this message.{" "}
          <span className="text-sky-300">Why did you trust it?</span>
        </p>
      </div>
    </div>
  );
}
