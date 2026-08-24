import { useEffect, useState } from "react";

import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Badge } from "./ui/badge";
import ScenarioService from "../../services/scenarioService";

interface SMSSimulationProps {
  onBack: () => void;
  onNavigate: (page: string) => void;
}

interface Scenario {
  scenario_id: number;

  title: string;

  simulation_type: string;

  category: string;

  difficulty: string;

  sender: string;

  subject: string;

  message: string;

  correct_answer: string;

  feedback: string;

  phishing_cues: string[];

  status: string;

  already_completed?: boolean;

  completed_count?: number;

  total_active?: number;
}

export function SMSSimulation({ onBack, onNavigate }: SMSSimulationProps) {
  const [showFeedback, setShowFeedback] = useState(false);

  const [feedbackType, setFeedbackType] = useState<
    "correct" | "incorrect" | null
  >(null);

  const [feedback, setFeedback] = useState("");

  const [phishingCues, setPhishingCues] = useState<string[]>([]);

  const [scenario, setScenario] = useState<Scenario | null>(null);

  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState("");

  const [allCompleted, setAllCompleted] = useState(false);

  const [submittingAnswer, setSubmittingAnswer] = useState(false);

  const [actionError, setActionError] = useState("");

  const loadScenario = async (includeCompleted = false) => {
    try {
      setLoading(true);

      const response = await ScenarioService.getRandomScenario("SMS", includeCompleted);

      if (response.ok && response.data.success) {
        setScenario(response.data.data);
        setLoadError("");
        setAllCompleted(false);
      } else if (response.data?.data?.all_completed) {
        setScenario(null);
        setAllCompleted(true);
      } else {
        setScenario(null);
        setAllCompleted(false);
        setLoadError(response.data.message || "No SMS scenarios are available.");
      }
    } catch {
      setScenario(null);
      setAllCompleted(false);
      setLoadError("Unable to load an SMS scenario.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScenario();
  }, []);

  if (loading || allCompleted || !scenario) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 bg-muted/30 text-center px-6">
        <p className="text-muted-foreground max-w-md">
          {loading
            ? "Loading SMS scenario..."
            : allCompleted
            ? "You've completed every available SMS scenario. Retake one to keep sharpening your skills."
            : loadError}
        </p>
        {!loading && allCompleted && (
          <Button onClick={() => loadScenario(true)}>Retake a Scenario</Button>
        )}
        {!loading && !allCompleted && loadError && (
          <Button onClick={() => loadScenario()}>Try Again</Button>
        )}
        {!loading && (
          <Button variant="secondary" onClick={() => onNavigate("performance")}>View Performance</Button>
        )}
        <Button variant="outline" onClick={onBack}>Back to Simulations</Button>
      </div>
    );
  }

  const handleAction = async (action: "report" | "ignore") => {
    if (!scenario || submittingAnswer) return;

    try {
      setSubmittingAnswer(true);
      setActionError("");
      const answer = action === "report" ? "REPORT" : "SAFE";

      const response = await ScenarioService.evaluateAnswer({
        scenario_id: scenario.scenario_id,
        answer,
      });

      if (response.ok && response.data.success) {
        const correct = response.data.data.correct;

        const savedAttempt = await ScenarioService.saveAttempt({
          scenario_id: scenario.scenario_id,
          simulation_type: "SMS",
          player_answer: answer,
          correct,
          score: correct ? 10 : 0,
        });

        if (!savedAttempt.ok || !savedAttempt.data.success) {
          setActionError(savedAttempt.data.message || "Unable to save your answer.");
          return;
        }

        setFeedbackType(correct ? "correct" : "incorrect");
        setFeedback(response.data.data.feedback);
        setPhishingCues(response.data.data.phishing_cues);
        setShowFeedback(true);
      } else {
        setActionError(response.data.message || "Unable to evaluate your answer.");
      }
    } catch {
      setActionError("Unable to save your answer. Please try again.");
    } finally {
      setSubmittingAnswer(false);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b p-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-semibold">SMS Phishing Simulation</h2>

        <div className="ml-auto flex items-center gap-2">
          {typeof scenario.completed_count === "number" &&
            typeof scenario.total_active === "number" && (
              <Badge variant="secondary">
                {scenario.completed_count} of {scenario.total_active} completed
              </Badge>
            )}
          {scenario.already_completed && (
            <Badge variant="outline">Retake</Badge>
          )}
          <Badge variant="outline">{scenario.difficulty}</Badge>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-muted/30">
        <div className="w-full max-w-md">
          <Card className="border-2">
            <div className="bg-primary text-primary-foreground p-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Messages</h3>
                <span className="text-sm">{scenario.category}</span>
              </div>
            </div>

            <div className="p-6 space-y-4 bg-background min-h-100">
              <div className="flex flex-col items-start">
                <div className="bg-muted rounded-2xl rounded-tl-none p-4 max-w-[85%]">
                  <div className="text-xs text-muted-foreground mb-1">
                    {scenario.sender || "Unknown sender"}
                  </div>
                  <p className="text-sm">{scenario.message}</p>
                  <div className="text-xs text-muted-foreground mt-2">
                    {scenario.title}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t p-4 space-y-3">
              <p className="text-sm text-center text-muted-foreground mb-2">
                What should you do with this message?
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => handleAction("report")}
                  variant="destructive"
                  className="w-full"
                  disabled={submittingAnswer}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Report as Smishing
                </Button>
                <Button
                  onClick={() => handleAction("ignore")}
                  variant="outline"
                  className="w-full"
                  disabled={submittingAnswer}
                >
                  Mark as Safe
                </Button>
              </div>
              {actionError && <p className="text-center text-sm text-destructive">{actionError}</p>}
            </div>
          </Card>

        </div>
      </div>

      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {feedbackType === "correct"
                ? "Excellent Work!"
                : "Not Quite Right"}
            </DialogTitle>

            <DialogDescription>{feedback}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Smishing Indicators:</h4>

              <ul className="space-y-2">
                {phishingCues.map((cue, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />

                    <span>{cue}</span>
                  </li>
                ))}
              </ul>
            </div>
            {scenario.feedback && <div className="bg-muted p-3 rounded"><p className="text-sm">{scenario.feedback}</p></div>}

            <Button
              className="w-full"
              onClick={() => {
                setShowFeedback(false);

                loadScenario();
              }}
            >
              Next Scenario
            </Button>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                setShowFeedback(false);
                onNavigate("performance");
              }}
            >
              View Performance
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
