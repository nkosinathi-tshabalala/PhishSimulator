// Line and bar charts that show patterns and trends on the analytics pages

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface DailyPoint {
  label: string;
  decisions: number;
  accuracy: number | null;
  new_users?: number;
}

export interface WeeklyPoint {
  label: string;
  decisions: number;
  accuracy: number | null;
  missed_phishing: number | null;
  false_alarms: number | null;
}

export interface CurvePoint {
  decision: number;
  accuracy: number | null;
}

export interface CategoryPoint {
  category: string;
  decisions: number;
  accuracy: number | null;
}

export interface DifficultyPoint {
  difficulty: string;
  decisions: number;
  accuracy: number | null;
}

// Colours that match the rest of the app's dark theme
const COLORS = {
  decisions: "#38bdf8",
  accuracy: "#4ade80",
  missed: "#f87171",
  falseAlarm: "#fbbf24",
  newUsers: "#a78bfa",
  grid: "rgba(255,255,255,0.06)",
  axis: "#94a3b8",
};

const AXIS_PROPS = { stroke: COLORS.axis, fontSize: 11, tickLine: false, axisLine: false };
const TOOLTIP_PROPS = {
  contentStyle: { background: "#0d1422", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#e2e8f0", fontWeight: 600 },
  separator: ": ",
  cursor: { fill: "rgba(255,255,255,0.04)" },
};
const HEIGHT = 260;

/** Formats a percentage for tooltips, or a dash when there was no data. */
function percent(value: unknown) {
  return value === null || value === undefined ? "–" : `${value}%`;
}

/** Shows a friendly message instead of an empty chart. */
function ChartFrame({ hasData, children }: { hasData: boolean; children: ReactNode }) {
  if (!hasData) {
    return (
      <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: HEIGHT }}>
        Not enough data yet. Complete a few scenarios to see this chart.
      </div>
    );
  }
  return <div style={{ height: HEIGHT }}>{children}</div>;
}

/** Bars for decisions per day with a line for accuracy (and new users for admins). */
export function ActivityChart({ data, showNewUsers = false }: { data: DailyPoint[]; showNewUsers?: boolean }) {
  return (
    <ChartFrame hasData={data.some((day) => day.decisions > 0)}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={COLORS.grid} vertical={false} />
          <XAxis dataKey="label" {...AXIS_PROPS} minTickGap={16} />
          <YAxis yAxisId="count" {...AXIS_PROPS} allowDecimals={false} />
          <YAxis yAxisId="percent" orientation="right" domain={[0, 100]} {...AXIS_PROPS} unit="%" />
          <Tooltip {...TOOLTIP_PROPS} formatter={(value, name) => (name === "Accuracy" ? percent(value) : value)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="count" dataKey="decisions" name="Decisions" fill={COLORS.decisions} fillOpacity={0.55} radius={[4, 4, 0, 0]} />
          {showNewUsers && (
            <Bar yAxisId="count" dataKey="new_users" name="New users" fill={COLORS.newUsers} fillOpacity={0.7} radius={[4, 4, 0, 0]} />
          )}
          <Line
            yAxisId="percent"
            dataKey="accuracy"
            name="Accuracy"
            stroke={COLORS.accuracy}
            strokeWidth={2.5}
            dot={{ r: 2 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Weekly mistakes: lines for missed phishing and false alarms over bars of decisions. */
export function ErrorTrendChart({ data }: { data: WeeklyPoint[] }) {
  const firstActive = data.findIndex((week) => week.decisions > 0);
  const weeks = firstActive === -1 ? [] : data.slice(firstActive);

  return (
    <ChartFrame hasData={weeks.length > 0}>
      <ResponsiveContainer>
        <ComposedChart data={weeks} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={COLORS.grid} vertical={false} />
          <XAxis dataKey="label" {...AXIS_PROPS} />
          <YAxis yAxisId="count" {...AXIS_PROPS} allowDecimals={false} />
          <YAxis yAxisId="percent" orientation="right" domain={[0, "auto"]} {...AXIS_PROPS} unit="%" />
          <Tooltip {...TOOLTIP_PROPS} formatter={(value, name) => (name === "Decisions" ? value : percent(value))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="count" dataKey="decisions" name="Decisions" fill={COLORS.axis} fillOpacity={0.25} radius={[4, 4, 0, 0]} />
          <Line yAxisId="percent" dataKey="missed_phishing" name="Missed phishing" stroke={COLORS.missed} strokeWidth={2.5} connectNulls />
          <Line yAxisId="percent" dataKey="false_alarms" name="False alarms" stroke={COLORS.falseAlarm} strokeWidth={2.5} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Rolling accuracy over the player's decisions, compared with their baseline score. */
export function LearningCurveChart({ data, baseline }: { data: CurvePoint[]; baseline: number | null }) {
  return (
    <ChartFrame hasData={data.length >= 2}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={COLORS.grid} vertical={false} />
          <XAxis dataKey="decision" {...AXIS_PROPS} />
          <YAxis domain={[0, 100]} {...AXIS_PROPS} unit="%" />
          <Tooltip {...TOOLTIP_PROPS} labelFormatter={(value) => `Decision ${value}`} formatter={(value) => percent(value)} />
          {baseline !== null && (
            <ReferenceLine
              y={baseline}
              stroke={COLORS.newUsers}
              strokeDasharray="4 4"
              label={{ value: `Baseline ${baseline}%`, fill: COLORS.newUsers, fontSize: 11, position: "insideBottomRight" }}
            />
          )}
          <Line dataKey="accuracy" name="Accuracy (last 5)" stroke={COLORS.accuracy} strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Bars for decisions per category with a line for accuracy, to show weak areas. */
export function CategoryChart({ data }: { data: CategoryPoint[] }) {
  return (
    <ChartFrame hasData={data.length > 0}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={COLORS.grid} vertical={false} />
          <XAxis dataKey="category" {...AXIS_PROPS} interval={0} angle={-25} textAnchor="end" height={60} />
          <YAxis yAxisId="count" {...AXIS_PROPS} allowDecimals={false} />
          <YAxis yAxisId="percent" orientation="right" domain={[0, 100]} {...AXIS_PROPS} unit="%" />
          <Tooltip {...TOOLTIP_PROPS} formatter={(value, name) => (name === "Accuracy" ? percent(value) : value)} />
          <Legend wrapperStyle={{ fontSize: 12 }} verticalAlign="top" />
          <Bar yAxisId="count" dataKey="decisions" name="Decisions" fill={COLORS.decisions} fillOpacity={0.55} radius={[4, 4, 0, 0]} />
          <Line yAxisId="percent" dataKey="accuracy" name="Accuracy" stroke={COLORS.accuracy} strokeWidth={2.5} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Accuracy for each difficulty level: it should drop as scenarios get harder. */
export function DifficultyChart({ data }: { data: DifficultyPoint[] }) {
  const barColors = [COLORS.accuracy, COLORS.falseAlarm, COLORS.missed];

  return (
    <ChartFrame hasData={data.some((row) => row.decisions > 0)}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={COLORS.grid} vertical={false} />
          <XAxis dataKey="difficulty" {...AXIS_PROPS} />
          <YAxis domain={[0, 100]} {...AXIS_PROPS} unit="%" />
          {/* Bars are coloured per cell, so the tooltip gets no series colour and would fall back to black text */}
          <Tooltip {...TOOLTIP_PROPS} itemStyle={{ color: "#e2e8f0" }} formatter={(value) => percent(value)} />
          <Bar dataKey="accuracy" name="Accuracy" radius={[6, 6, 0, 0]}>
            {data.map((row, index) => <Cell key={row.difficulty} fill={barColors[index]} fillOpacity={0.75} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
