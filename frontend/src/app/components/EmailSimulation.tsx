import { useEffect, useState } from "react";
import {
  Archive,
  Trash2,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
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

interface EmailSimulationProps {
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

export function EmailSimulation({ onBack, onNavigate }: EmailSimulationProps) {
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

      const response = await ScenarioService.getRandomScenario("EMAIL", includeCompleted);

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
        setLoadError(response.data.message || "No email scenarios are available.");
      }
    } catch {
      setScenario(null);
      setAllCompleted(false);
      setLoadError("Unable to load an email scenario.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScenario();
  }, []);

  const currentEmail = scenario;

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
          simulation_type: "EMAIL",
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

  if (loading || allCompleted || !scenario) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 bg-muted/30 text-center px-6">
        <p className="text-muted-foreground max-w-md">
          {loading
            ? "Loading email scenario..."
            : allCompleted
            ? "You've completed every available email scenario. Retake one to keep sharpening your skills."
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

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b p-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-semibold">Email Phishing Simulation</h2>
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
          <Badge variant="secondary">{scenario.category}</Badge>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r overflow-y-auto">
          <div className="p-3 border-b bg-muted/30">
            <h3 className="font-semibold text-sm">Inbox</h3>
          </div>

          <div>
            <div className={`p-4 border-b bg-muted`}>
              <div className="flex items-start justify-between mb-1">
                <span className="font-medium text-sm truncate flex-1">
                  {scenario?.sender}
                </span>
              </div>

              <div className="font-medium text-sm mb-1">
                {scenario?.subject}
              </div>

              <div className="text-xs text-muted-foreground truncate">
                {scenario?.message}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {currentEmail && (
            <>
              <div className="p-6 border-b">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">
                      {currentEmail.subject}
                    </h3>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">From:</span>
                      <span className="text-muted-foreground">
                        {currentEmail.sender}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon">
                      <Archive className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-6 overflow-y-auto">
                <Card className="p-6">
                  <div className="space-y-4">
                    <pre className="whitespace-pre-wrap font-sans">
                      {scenario?.message}
                    </pre>
                  </div>
                </Card>
              </div>

              <div className="border-t p-4 bg-muted/30">
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={() => handleAction("report")}
                    variant="destructive"
                    disabled={submittingAnswer}
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Report as Phishing
                  </Button>
                  <Button
                    onClick={() => handleAction("ignore")}
                    variant="outline"
                    disabled={submittingAnswer}
                  >
                    Mark as Safe
                  </Button>
                </div>
                {actionError && <p className="mt-3 text-center text-sm text-destructive">{actionError}</p>}
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {feedbackType === "correct" ? "Correct! Well Done" : "Incorrect"}
            </DialogTitle>

            <DialogDescription>{feedback}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {scenario && (
              <div>
                <h4 className="font-semibold mb-2">Phishing Indicators:</h4>

                <ul className="space-y-2">
                  {phishingCues.map((cue, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />

                      <span>{cue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
