import {
  Award,
  Mail,
  MessageSquare,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Activity,
  ChevronRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import AnalyticsService from "../../services/analyticsService";

interface CurrentUser {
  user_id: number;
  full_name: string;
  email: string;
  age: number | null;
  occupation: string | null;
  it_background: boolean | null;
  role: string;
}

interface DashboardProps {
  user: CurrentUser | null;
  onNavigate: (page: string) => void;
}

interface PlayerPerformance {
  overall_accuracy: number;
  false_positive_rate: number;
  false_negative_rate: number;
  total_attempts: number;
  correct_attempts: number;
  baseline_score: number | null;
  difficulty: string;
  xp_into_level: number;
  level: number;
  rank: number;
  recent_attempts: Array<{ scenario: string; type: string; correct: boolean; attempted_at: string }>;
}

export function Dashboard({ user, onNavigate }: DashboardProps) {
  const [performance, setPerformance] = useState<PlayerPerformance | null>(null);

  useEffect(() => {
    AnalyticsService.getMyPerformance().then((response) => {
      if (response.ok) setPerformance(response.data.data);
    }).catch((error) => console.error("Unable to load player dashboard.", error));
  }, []);

  const stats = [
    {
      label: "Overall Accuracy",
      value: performance ? `${performance.overall_accuracy}%` : "...",
      icon: Target,
      color: "#38bdf8",
      bg: "rgba(56,189,248,0.12)",
    },
    {
      label: "False Positives",
      value: performance ? `${performance.false_positive_rate}%` : "...",
      icon: AlertTriangle,
      color: "#f2cc60",
      bg: "rgba(242,204,96,0.12)",
    },
    {
      label: "False Negatives",
      value: performance ? `${performance.false_negative_rate}%` : "...",
      icon: AlertTriangle,
      color: "#f85149",
      bg: "rgba(248,81,73,0.12)",
    },
    {
      label: "Simulations Done",
      value: performance?.total_attempts ?? "...",
      icon: CheckCircle2,
      color: "#3fb950",
      bg: "rgba(63,185,80,0.12)",
    },
  ];

  const quickActions = [
    {
      label: "Start Baseline Assessment",
      icon: ClipboardList,
      page: "quiz",
      description: "Evaluate your current knowledge",
    },
    {
      label: "Email Simulation",
      icon: Mail,
      page: "email",
      description: "Identify phishing emails",
    },
    {
      label: "SMS Simulation",
      icon: MessageSquare,
      page: "sms",
      description: "Detect smishing attacks",
    },
    {
      label: "View Performance",
      icon: Activity,
      page: "performance",
      description: "Track your progress",
    },
  ];

  const formatTime = (value: string) => new Date(value).toLocaleString();

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, {user?.full_name ?? "Player"}
          </h1>

          <p className="text-sm mt-1 text-muted-foreground">
            {user?.occupation} • Ready for today's phishing awareness training.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="text-xs px-3 py-1">
            Level {performance?.level ?? "..."}
          </Badge>
          <Badge variant="outline" className="text-xs px-3 py-1">
            Rank #{performance?.rank ?? "..."}
          </Badge>
        </div>
      </div>

      {/* Profile Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-md bg-secondary border border-border">
        {[
          { label: "Current Level", value: performance?.level ?? "..." },
          { label: "Baseline Score", value: performance?.baseline_score !== null && performance ? `${performance.baseline_score}%` : "Not assessed" },
          { label: "Current Difficulty", value: performance?.difficulty ?? "..." },
          { label: "Current Rank", value: performance ? `#${performance.rank}` : "..." },
        ].map((item) => (
          <div key={item.label} className="text-center">
            <div className="text-2xl font-bold text-foreground">{item.value}</div>
            <div className="text-xs mt-0.5 text-muted-foreground">
              {item.label}
            </div>
          </div>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-9 h-9 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: stat.bg }}
                >
                  <stat.icon
                    className="w-4 h-4"
                    style={{ color: stat.color }}
                  />
                </div>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {stat.value}
              </div>
              <div className="text-xs mt-0.5 text-muted-foreground">
                {stat.label}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-foreground">
                Quick Actions
              </CardTitle>
              <CardDescription>Jump into a training session</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => onNavigate(action.page)}
                  className="w-full flex items-center justify-between p-3 rounded-md border border-border transition-colors text-left hover:border-primary hover:bg-primary/5 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md flex items-center justify-center bg-muted">
                      <action.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {action.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {action.description}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Progress & Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Adaptive Progress */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-foreground">
                  Adaptive Learning Progress
                </CardTitle>
                <Badge className="text-xs bg-primary/10 text-primary border-0">
                  {performance?.difficulty ?? "..."} Difficulty
                </Badge>
              </div>
              <CardDescription>Progress toward next level</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Level {performance?.level ?? "..."} Progress</span>
                  <span className="font-medium text-foreground">
                    {performance?.xp_into_level ?? 0} / 100 XP
                  </span>
                </div>
                <Progress value={performance?.xp_into_level ?? 0} className="h-2.5" />
              </div>
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="text-center p-3 rounded-md bg-muted">
                  <div className="font-bold text-lg" style={{ color: "#3fb950" }}>
                    {performance?.correct_attempts ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Correct
                  </div>
                </div>
                <div className="text-center p-3 rounded-md bg-muted">
                  <div className="font-bold text-lg" style={{ color: "#f2cc60" }}>
                    {performance ? Math.round((performance.false_positive_rate / 100) * performance.total_attempts) : 0}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    False +
                  </div>
                </div>
                <div className="text-center p-3 rounded-md bg-muted">
                  <div className="font-bold text-lg" style={{ color: "#f85149" }}>
                    {performance ? Math.round((performance.false_negative_rate / 100) * performance.total_attempts) : 0}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    False -
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-foreground">
                  Recent Simulations
                </CardTitle>
                <button
                  onClick={() => onNavigate("performance")}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  View All
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-2">
                {performance?.recent_attempts.map((activity) => (
                  <div
                    key={`${activity.scenario}-${activity.attempted_at}`}
                    className="flex items-center justify-between py-2.5 border-b border-border last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center"
                        style={{
                          backgroundColor:
                            activity.type === "EMAIL"
                              ? "rgba(56,189,248,0.12)"
                              : "rgba(188,140,255,0.12)",
                        }}
                      >
                        {activity.type === "EMAIL" ? (
                          <Mail
                            className="w-3.5 h-3.5"
                            style={{ color: "#38bdf8" }}
                          />
                        ) : (
                          <MessageSquare
                            className="w-3.5 h-3.5"
                            style={{ color: "#bc8cff" }}
                          />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {activity.scenario}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatTime(activity.attempted_at)}
                        </div>
                      </div>
                    </div>
                    <Badge
                      className="text-xs border-0"
                      style={{
                        backgroundColor: activity.correct
                          ? "rgba(63,185,80,0.12)"
                          : "rgba(248,81,73,0.12)",
                        color: activity.correct ? "#3fb950" : "#f85149",
                      }}
                    >
                      {activity.correct ? "Correct" : "Incorrect"}
                    </Badge>
                  </div>
                ))}
                {!performance?.recent_attempts.length && (
                  <p className="text-sm text-muted-foreground">No simulations completed yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
