// State and actions for one training round

import { useEffect, useState } from "react";
import ScenarioService from "../../../services/scenarioService";
import type { AttemptResult, Channel, Decision, PlayerScenario, Trap } from "../../../types/catch";

/** The three steps of one round: look at the message, explain the decision, learn. */
export type RoundStage = "inspect" | "justify" | "feedback";

/** "adaptive" picks new scenarios; "review" brings back ones the player got wrong. */
export type RoundMode = "adaptive" | "review";

/** A link clicked or file opened instead of deciding. */
export interface TrapAction {
  kind: Trap;
  target: string;
}

/** State and actions for one training round. */
export function useSimulationRound(channel: Channel) {
  const [scenario, setScenario] = useState<PlayerScenario | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [allCompleted, setAllCompleted] = useState(false);
  const [focusCategory, setFocusCategory] = useState<string | null>(null);
  const [mode, setMode] = useState<RoundMode>("adaptive");

  const [stage, setStage] = useState<RoundStage>("inspect");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [trap, setTrap] = useState<TrapAction | null>(null);
  const [selectedClues, setSelectedClues] = useState<string[]>([]);
  const [justification, setJustification] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState<AttemptResult | null>(null);

  const [streak, setStreak] = useState(0);

  const resetRound = () => {
    setStage("inspect");
    setDecision(null);
    setTrap(null);
    setSelectedClues([]);
    setJustification("");
    setSubmitError("");
    setResult(null);
  };

  const loadScenario = async (includeCompleted = false, category = focusCategory, nextMode = mode) => {
    setIsLoading(true);
    resetRound();

    try {
      const response = nextMode === "review"
        ? await ScenarioService.getReviewScenario(channel)
        : await ScenarioService.getRandomScenario(channel, includeCompleted, category);
      if (response.ok && response.data.success) {
        setScenario(response.data.data);
        setLoadError("");
        setAllCompleted(false);
      } else {
        setScenario(null);
        setAllCompleted(Boolean(response.data?.data?.all_completed));
        setLoadError(response.data.message || "No scenarios are available yet.");
      }
    } catch {
      setScenario(null);
      setLoadError("We couldn't load a scenario right now. Please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadScenario();
  }, []);

  const chooseFocus = (category: string | null) => {
    setFocusCategory(category);
    setMode("adaptive");
    loadScenario(false, category, "adaptive");
  };

  const chooseMode = (nextMode: RoundMode) => {
    setMode(nextMode);
    loadScenario(false, focusCategory, nextMode);
  };

  /** Step 1: Report or Mark Safe. Nothing is sent yet. */
  const decide = (choice: Decision) => {
    setDecision(choice);
    setStage("justify");
  };

  /** Clicking a link or opening a file counts as trusting the message. */
  const springTrap = (kind: Trap, target: string) => {
    if (stage !== "inspect") return;
    setTrap({ kind, target });
    setDecision("SAFE");
    setStage("justify");
  };
  const clickLink = (url: string) => springTrap("LINK", url);
  const openAttachment = (name: string) => springTrap("ATTACHMENT", name);

  const toggleClue = (clue: string) => {
    setSelectedClues((current) =>
      current.includes(clue) ? current.filter((item) => item !== clue) : [...current, clue],
    );
  };

  const changeDecision = () => {
    setStage("inspect");
    setDecision(null);
    setSubmitError("");
  };

  /** Step 2: send the decision and the reasons. The server decides what was right. */
  const submit = async () => {
    if (!scenario || !decision || isSubmitting) return;

    if (!selectedClues.length && !justification.trim()) {
      setSubmitError("Pick at least one clue or write a short reason.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");
    try {
      const response = await ScenarioService.submitAttempt({
        scenario_id: scenario.scenario_id,
        player_answer: decision,
        selected_clues: selectedClues,
        justification: justification.trim(),
        clicked_link: trap?.kind === "LINK",
        opened_attachment: trap?.kind === "ATTACHMENT",
      });

      if (!response.ok || !response.data.success) {
        setSubmitError(response.data.message || "Unable to save your answer.");
        return;
      }

      const attempt: AttemptResult = response.data.data;
      setResult(attempt);
      setStreak((current) => (attempt.correct ? current + 1 : 0));
      setStage("feedback");
    } catch {
      setSubmitError("Unable to save your answer. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    scenario,
    isLoading,
    loadError,
    allCompleted,
    focusCategory,
    mode,
    stage,
    decision,
    trap,
    selectedClues,
    justification,
    isSubmitting,
    submitError,
    result,
    streak,
    loadScenario,
    chooseFocus,
    chooseMode,
    decide,
    clickLink,
    openAttachment,
    toggleClue,
    setJustification,
    changeDecision,
    submit,
  };
}

export type SimulationRound = ReturnType<typeof useSimulationRound>;
