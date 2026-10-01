// Player page: the baseline quiz and its results (CATCH "Check")

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Info,
  LoaderCircle,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { Textarea } from "./ui/textarea";
import BaselineService from "../../services/baselineService";

interface BaselineQuizProps {
  onBack: () => void;
}

/** Players only get the question text. The marking guide arrives with the result. */
interface Question {
  id: number;
  question: string;
}

interface QuestionResult {
  questionId: number;
  question: string;
  expectedKeywords: string[];
  exampleAnswer: string;
  feedback: string;
  userAnswer: string;
  matchedKeywords: string[];
  score: number;
  maxScore: number;
  passed: boolean;
}

interface QuizSummary {
  overallScore: number;
  questionsPassed: number;
  confidenceLevel: string;
  startingDifficulty: string;
  results: QuestionResult[];
}

const MIN_ANSWER_LENGTH = 10;

/** CATCH "Check": a short open-text quiz that sets the starting difficulty. */
export function BaselineQuiz({ onBack }: BaselineQuizProps) {
  const [assessmentId, setAssessmentId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [summary, setSummary] = useState<QuizSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      const latest = await BaselineService.getLatestResult();
      if (latest.ok && latest.data.success && latest.data.data) {
        setSummary(latest.data.data);
        setIsLoading(false);
        return;
      }
      await startQuiz();
    };
    load();
  }, []);

  const startQuiz = async () => {
    setIsLoading(true);
    setError("");
    const response = await BaselineService.startAssessment({});
    if (response.ok && response.data.success) {
      setAssessmentId(response.data.data.assessment_id);
      setQuestions(response.data.data.questions || []);
      setCurrentIndex(0);
      setAnswer("");
      setSummary(null);
    } else {
      setError(response.data.message || "Unable to start the quiz.");
    }
    setIsLoading(false);
  };

  const submitAnswer = async () => {
    if (!assessmentId) return;
    setIsSubmitting(true);
    setError("");

    const response = await BaselineService.submitResponse({
      assessment_id: assessmentId,
      question_id: questions[currentIndex].id,
      answer_text: answer,
    });
    if (!response.ok || !response.data.success) {
      setError(response.data.message || "Your answer could not be saved.");
      setIsSubmitting(false);
      return;
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setAnswer("");
      setIsSubmitting(false);
      return;
    }

    const complete = await BaselineService.completeAssessment({ assessment_id: assessmentId });
    if (complete.ok && complete.data.success) {
      setSummary(complete.data.data);
    } else {
      setError(complete.data.message || "The quiz could not be completed.");
    }
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center gap-2 text-muted-foreground">
        <LoaderCircle className="w-4 h-4 animate-spin" />
        Loading quiz...
      </div>
    );
  }

  if (summary) {
    return <QuizResults summary={summary} onBack={onBack} onRetake={startQuiz} />;
  }

  if (!questions.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
        {error || "No baseline questions found."}
        <Button variant="outline" onClick={onBack}>Back to home</Button>
      </div>
    );
  }

  const isLast = currentIndex === questions.length - 1;
  const percent = (currentIndex / questions.length) * 100;

  return (
    <div className="h-full flex flex-col">
      <QuizHeader
        title="Baseline Quiz"
        subtitle={`Question ${currentIndex + 1} of ${questions.length}`}
        onBack={onBack}
      />
      <div className="px-6 py-3 border-b">
        <Progress value={percent} className="h-1.5" />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-sky-500/25 bg-sky-500/10 p-4 text-sm text-sky-100/90">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-sky-300" />
            Answer in your own words. There are no trick questions and no time limit.
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-full bg-linear-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                  {currentIndex + 1}
                </span>
                <CardTitle className="text-base leading-normal">{questions[currentIndex].question}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Type your answer here..."
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                className="min-h-40 resize-none text-sm"
              />
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">{answer.length} characters</span>
                <Button onClick={submitAnswer} disabled={answer.trim().length < MIN_ANSWER_LENGTH || isSubmitting}>
                  {isSubmitting && <LoaderCircle className="w-4 h-4 animate-spin" />}
                  {isLast ? "Finish quiz" : "Next question"}
                  {!isSubmitting && <ChevronRight className="w-4 h-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Page header with a back button. */
function QuizHeader({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) {
  return (
    <div className="border-b p-4 flex items-center gap-4">
      <Button variant="ghost" size="icon" onClick={onBack} title="Back to home">
        <ArrowLeft className="w-5 h-5" />
      </Button>
      <div className="w-10 h-10 rounded-lg bg-amber-400/15 flex items-center justify-center">
        <ClipboardList className="w-5 h-5 text-amber-300" />
      </div>
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

/** Overall quiz score and every marked answer. */
function QuizResults({ summary, onBack, onRetake }: {
  summary: QuizSummary;
  onBack: () => void;
  onRetake: () => void;
}) {
  const stats = [
    { label: "Questions passed", value: `${summary.questionsPassed}/${summary.results.length}`, tone: "text-green-400" },
    { label: "Confidence level", value: summary.confidenceLevel, tone: "text-foreground" },
    { label: "Starting difficulty", value: summary.startingDifficulty, tone: "text-sky-400" },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <QuizHeader title="Baseline Quiz Results" subtitle="Your training starts from here" onBack={onBack} />

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Card className="border-sky-500/25 bg-linear-to-br from-sky-600/20 via-indigo-600/10 to-card">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="text-center">
                <div className="text-5xl font-bold text-sky-400">{summary.overallScore}%</div>
                <div className="text-sm mt-1 text-muted-foreground">Overall score</div>
              </div>
              <div className="grid grid-cols-3 gap-4 flex-1">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <div className={`text-xl font-bold ${stat.tone}`}>{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <Progress value={summary.overallScore} className="h-2" />
          </CardContent>
        </Card>

        <div className="space-y-4">
          {summary.results.map((result) => <ResultCard key={result.questionId} result={result} />)}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pb-6">
          <Button onClick={onBack} className="flex-1">Back to home</Button>
          <Button onClick={onRetake} variant="outline" className="flex-1">
            <RotateCcw className="w-4 h-4" />
            Retake quiz
          </Button>
        </div>
      </div>
    </div>
  );
}

/** One marked answer with the key ideas found and missed. */
function ResultCard({ result }: { result: QuestionResult }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          {result.passed
            ? <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-green-400" />
            : <XCircle className="w-5 h-5 mt-0.5 shrink-0 text-red-400" />}
          <div className="flex-1">
            <div className="font-medium text-sm">{result.question}</div>
            <div className="flex items-center gap-3 mt-1 text-xs">
              <span className="text-muted-foreground">{result.score} / {result.maxScore} key ideas</span>
              <span className={`rounded px-2 py-0.5 ${result.passed ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                {result.passed ? "Passed" : "Needs review"}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="p-3 rounded-lg bg-muted">
          <div className="text-xs font-medium mb-1 text-muted-foreground">Your answer</div>
          <div className="text-sm">{result.userAnswer || "(no answer provided)"}</div>
        </div>
        <div>
          <div className="text-xs font-medium mb-1.5 text-muted-foreground">Key ideas</div>
          <div className="flex flex-wrap gap-1.5">
            {result.expectedKeywords.map((keyword) => {
              const isMatched = result.matchedKeywords.includes(keyword);
              return (
                <span
                  key={keyword}
                  className={`px-2 py-0.5 rounded text-xs ${isMatched ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}
                >
                  {keyword}
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 rounded-lg border border-sky-500/20 bg-sky-500/10">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-300" />
          <p className="text-xs">{result.feedback}</p>
        </div>
      </CardContent>
    </Card>
  );
}
