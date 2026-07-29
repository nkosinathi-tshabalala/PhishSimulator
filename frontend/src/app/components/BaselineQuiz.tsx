import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Info,
  ChevronRight,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import BaselineService from "../../services/baselineService";

interface BaselineQuizProps {
  onBack: () => void;
}

interface Question {
  id: number;
  question: string;
  instruction: string;
  expectedKeywords: string[];
  exampleAnswer: string;
  feedback: string;
  confidenceThreshold: number;
}

interface QuestionResult {
  questionId: number;
  userAnswer: string;
  matchedKeywords: string[];
  score: number;
  maxScore: number;
  passed: boolean;
}

export function BaselineQuiz({ onBack }: BaselineQuizProps) {
  const [assessmentId, setAssessmentId] = useState<number | null>(null);

  const [questions, setQuestions] = useState<Question[]>([]);

  const [currentIndex, setCurrentIndex] = useState(0);

  const [userAnswer, setUserAnswer] = useState("");

  const [results, setResults] = useState<QuestionResult[]>([]);

  const [summary, setSummary] = useState<any>(null);

  const [showResults, setShowResults] = useState(false);

  const [loading, setLoading] = useState(true);

  const currentQuestion = questions[currentIndex];
  const progress = (currentIndex / questions.length) * 100;

  useEffect(() => {
    const loadBaseline = async () => {
      try {
        /*
         * STEP 1:
         * Check whether this player already has
         * a completed baseline assessment.
         */
        const latestResponse = await BaselineService.getLatestResult();

        if (
          latestResponse.ok &&
          latestResponse.data.success &&
          latestResponse.data.data
        ) {
          const latestResult = latestResponse.data.data;

          /*
           * A completed assessment exists.
           * Restore the result instead of creating
           * another assessment.
           */
          setAssessmentId(latestResult.assessmentId);

          setSummary(latestResult);

          setResults(latestResult.results || []);

          /*
           * We still need the question information
           * for question text, expected keywords
           * and feedback on the results screen.
           */
          const questionsResponse = await BaselineService.getQuestions();

          if (questionsResponse.ok && questionsResponse.data.success) {
            setQuestions(questionsResponse.data.data || []);
          }

          setShowResults(true);

          return;
        }

        /*
         * STEP 2:
         * No completed assessment exists.
         * Start the player's first assessment.
         */
        const startResponse = await BaselineService.startAssessment({});

        if (startResponse.ok && startResponse.data.success) {
          setAssessmentId(startResponse.data.data.assessment_id);

          setQuestions(startResponse.data.data.questions || []);

          setShowResults(false);

          return;
        }

        alert(startResponse.data.message || "Failed to start assessment.");
      } catch (error) {
        console.error("Failed to load baseline assessment:", error);

        alert("Unable to load baseline assessment.");
      } finally {
        setLoading(false);
      }
    };

    loadBaseline();
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        Loading assessment...
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        No baseline questions found.
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!assessmentId) return;

    try {
      // Submit the current answer to the backend
      const response = await BaselineService.submitResponse({
        assessment_id: assessmentId,

        question_id: currentQuestion.id,

        answer_text: userAnswer,
      });

      if (!response.ok || !response.data.success) {
        alert(response.data.message);

        return;
      }

      const newResults = [...results, response.data.data];

      setResults(newResults);

      // More questions remaining
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(currentIndex + 1);

        setUserAnswer("");

        return;
      }

      // Last question → Complete assessment
      const completeResponse = await BaselineService.completeAssessment({
        assessment_id: assessmentId,
      });

      if (!completeResponse.ok || !completeResponse.data.success) {
        alert(completeResponse.data.message);

        return;
      }

      setSummary(completeResponse.data.data);

      setResults(completeResponse.data.data.results);

      setShowResults(true);
    } catch (error) {
      console.error(error);

      alert("Unable to submit assessment.");
    }
  };

  const handleRetake = async () => {
    try {
      setLoading(true);

      /*
       * Create a completely new assessment attempt.
       * The previous completed assessment remains
       * stored in the database.
       */
      const response = await BaselineService.startAssessment({});

      if (!response.ok || !response.data.success) {
        alert(response.data.message || "Unable to start a new assessment.");

        return;
      }

      // Use the NEW assessment
      setAssessmentId(response.data.data.assessment_id);

      setQuestions(response.data.data.questions || []);

      // Reset quiz state
      setCurrentIndex(0);

      setUserAnswer("");

      setResults([]);

      setSummary(null);

      setShowResults(false);
    } catch (error) {
      console.error("Failed to retake baseline assessment:", error);

      alert("Unable to start a new assessment.");
    } finally {
      setLoading(false);
    }
  };

  const overallPercent = summary?.overallScore ?? 0;

  const passed = summary?.questionsPassed ?? 0;

  const totalScore = summary?.totalKeywordsMatched ?? 0;

  const confidenceLevel = summary?.confidenceLevel ?? "Novice";

  const startingDifficulty = summary?.startingDifficulty ?? "Easy";

  if (showResults) {
    return (
      <div
        className="h-full overflow-y-auto"
        style={{ backgroundColor: "#f0f4f8" }}
      >
        <div className="border-b p-4 flex items-center gap-4 bg-white">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-xl font-semibold" style={{ color: "#0f2240" }}>
              Baseline Assessment Results
            </h2>
            <p className="text-sm" style={{ color: "#64748b" }}>
              Open-text evaluation complete
            </p>
          </div>
        </div>

        <div className="p-6 max-w-3xl mx-auto space-y-6">
          {/* Score Summary */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div
                    className="text-5xl font-bold"
                    style={{ color: "#1e3a5f" }}
                  >
                    {overallPercent}%
                  </div>
                  <div className="text-sm mt-1" style={{ color: "#64748b" }}>
                    Overall Score
                  </div>
                </div>
                <div
                  className="h-16 w-px"
                  style={{ backgroundColor: "#e2e8f0" }}
                />
                <div className="grid grid-cols-2 gap-4 flex-1">
                  <div>
                    <div
                      className="text-2xl font-bold"
                      style={{ color: "#16a34a" }}
                    >
                      {passed}/{questions.length}
                    </div>
                    <div className="text-xs" style={{ color: "#64748b" }}>
                      Questions Passed
                    </div>
                  </div>
                  <div>
                    <div
                      className="text-2xl font-bold"
                      style={{ color: "#0ea5e9" }}
                    >
                      {totalScore}
                    </div>
                    <div className="text-xs" style={{ color: "#64748b" }}>
                      Keywords Matched
                    </div>
                  </div>
                  <div>
                    <div
                      className="text-2xl font-bold"
                      style={{ color: "#0f2240" }}
                    >
                      {confidenceLevel}
                    </div>
                    <div className="text-xs" style={{ color: "#64748b" }}>
                      Confidence Level
                    </div>
                  </div>
                  <div>
                    <div
                      className="text-2xl font-bold"
                      style={{ color: "#1e3a5f" }}
                    >
                      {startingDifficulty}
                    </div>
                    <div className="text-xs" style={{ color: "#64748b" }}>
                      Starting Difficulty
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Progress value={overallPercent} className="h-3" />
              </div>
            </CardContent>
          </Card>

          {/* Per-question results */}
          <div className="space-y-4">
            {results.map((result, i) => {
              const q = questions[i];
              return (
                <Card key={i} className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-start gap-3">
                      {result.passed ? (
                        <CheckCircle2
                          className="w-5 h-5 mt-0.5 flex-shrink-0"
                          style={{ color: "#16a34a" }}
                        />
                      ) : (
                        <XCircle
                          className="w-5 h-5 mt-0.5 flex-shrink-0"
                          style={{ color: "#dc2626" }}
                        />
                      )}
                      <div className="flex-1">
                        <div
                          className="font-medium text-sm"
                          style={{ color: "#0f2240" }}
                        >
                          {q.question}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span
                            className="text-xs"
                            style={{ color: "#64748b" }}
                          >
                            {result.score} / {result.maxScore} keywords matched
                          </span>
                          <Badge
                            className="text-xs"
                            style={{
                              backgroundColor: result.passed
                                ? "rgba(22,163,74,0.1)"
                                : "rgba(220,38,38,0.1)",
                              color: result.passed ? "#16a34a" : "#dc2626",
                            }}
                          >
                            {result.passed ? "Passed" : "Needs Review"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div
                      className="p-3 rounded-lg"
                      style={{ backgroundColor: "#f0f4f8" }}
                    >
                      <div
                        className="text-xs font-medium mb-1"
                        style={{ color: "#64748b" }}
                      >
                        Your answer:
                      </div>
                      <div className="text-sm" style={{ color: "#0f2240" }}>
                        {result.userAnswer || "(no answer provided)"}
                      </div>
                    </div>
                    {result.matchedKeywords.length > 0 && (
                      <div>
                        <div
                          className="text-xs font-medium mb-1.5"
                          style={{ color: "#64748b" }}
                        >
                          Matched keywords:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {result.matchedKeywords.map((kw) => (
                            <span
                              key={kw}
                              className="px-2 py-0.5 rounded text-xs font-medium"
                              style={{
                                backgroundColor: "rgba(22,163,74,0.1)",
                                color: "#16a34a",
                              }}
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <div
                        className="text-xs font-medium mb-1.5"
                        style={{ color: "#64748b" }}
                      >
                        Expected keywords:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {q.expectedKeywords.map((kw) => (
                          <span
                            key={kw}
                            className="px-2 py-0.5 rounded text-xs"
                            style={{
                              backgroundColor: result.matchedKeywords.includes(
                                kw,
                              )
                                ? "rgba(22,163,74,0.1)"
                                : "rgba(220,38,38,0.08)",
                              color: result.matchedKeywords.includes(kw)
                                ? "#16a34a"
                                : "#dc2626",
                            }}
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div
                      className="flex items-start gap-2 p-3 rounded-lg"
                      style={{
                        backgroundColor: "rgba(14,165,233,0.06)",
                        border: "1px solid rgba(14,165,233,0.15)",
                      }}
                    >
                      <Info
                        className="w-4 h-4 flex-shrink-0 mt-0.5"
                        style={{ color: "#0ea5e9" }}
                      />
                      <p className="text-xs" style={{ color: "#0f2240" }}>
                        {q.feedback}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex gap-3 pb-6">
            <Button
              onClick={onBack}
              className="flex-1 text-white"
              style={{ backgroundColor: "#1e3a5f" }}
            >
              Return to Dashboard
            </Button>

            <Button onClick={handleRetake} variant="outline" className="flex-1">
              Retake Assessment
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-full flex flex-col"
      style={{ backgroundColor: "#f0f4f8" }}
    >
      {/* Header */}
      <div className="border-b p-4 flex items-center gap-4 bg-white">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-semibold" style={{ color: "#0f2240" }}>
            Baseline Assessment
          </h2>
          <p className="text-sm" style={{ color: "#64748b" }}>
            Open-text knowledge evaluation
          </p>
        </div>
        <Badge
          variant="outline"
          className="font-medium"
          style={{ color: "#1e3a5f", borderColor: "#1e3a5f" }}
        >
          Question {currentIndex + 1} of {questions.length}
        </Badge>
      </div>

      {/* Progress */}
      <div className="bg-white px-6 pb-4">
        <div
          className="flex justify-between text-xs mb-2"
          style={{ color: "#94a3b8" }}
        >
          <span>Progress</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Instruction Panel */}
          <div
            className="flex items-start gap-3 p-4 rounded-xl"
            style={{
              backgroundColor: "rgba(30,58,95,0.06)",
              border: "1px solid rgba(30,58,95,0.12)",
            }}
          >
            <Info
              className="w-4 h-4 flex-shrink-0 mt-0.5"
              style={{ color: "#1e3a5f" }}
            />
            <div>
              <div
                className="text-sm font-medium mb-1"
                style={{ color: "#1e3a5f" }}
              >
                Instructions
              </div>
              <p className="text-sm" style={{ color: "#64748b" }}>
                This assessment uses open-text responses. Write your answers in
                your own words. Your response will be evaluated based on key
                concepts and terminology.
              </p>
            </div>
          </div>

          {/* Question Card */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: "#1e3a5f" }}
                >
                  {currentIndex + 1}
                </div>
                <div>
                  <CardTitle
                    className="text-base leading-normal"
                    style={{ color: "#0f2240" }}
                  >
                    {currentQuestion.question}
                  </CardTitle>
                  <p className="text-sm mt-2" style={{ color: "#64748b" }}>
                    {currentQuestion.instruction}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Type your answer here..."
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                className="min-h-[160px] resize-none text-sm"
                style={{ borderColor: "#e2e8f0" }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "#94a3b8" }}>
                  {userAnswer.length} characters — try to be thorough
                </span>
                <Button
                  onClick={handleSubmit}
                  disabled={userAnswer.trim().length < 10}
                  className="text-white"
                  style={{ backgroundColor: "#1e3a5f" }}
                >
                  {currentIndex < questions.length - 1
                    ? "Next Question"
                    : "Submit Assessment"}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
