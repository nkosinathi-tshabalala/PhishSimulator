// Yearly activity calendar: one square per day, brighter means more practice that day

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AnalyticsService from "../../../services/analyticsService";
import type { YearActivity } from "../../../types/catch";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";

// Colour steps for a day's count (the key under the calendar uses the same steps)
const LEVELS = [
  { min: 0, label: "No activity", className: "bg-white/[0.04] ring-1 ring-inset ring-white/10" },
  { min: 1, label: "1–2", className: "bg-emerald-900" },
  { min: 3, label: "3–5", className: "bg-emerald-600" },
  { min: 6, label: "6 or more", className: "bg-emerald-400" },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "", "Wed", "", "Fri", "", ""];
const DAY_MS = 24 * 60 * 60 * 1000;

/** The colour step for a day's count. */
function levelFor(count: number) {
  return [...LEVELS].reverse().find((level) => count >= level.min) ?? LEVELS[0];
}

/** The days of a year as week columns starting on Monday, with blanks before 1 January. Dates are UTC,
 * like the server's. */
function weeksOf(year: number) {
  const first = new Date(Date.UTC(year, 0, 1));
  const days: Array<Date | null> = Array((first.getUTCDay() + 6) % 7).fill(null);
  for (let time = first.getTime(); new Date(time).getUTCFullYear() === year; time += DAY_MS) {
    days.push(new Date(time));
  }
  const weeks: Array<Array<Date | null>> = [];
  for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7));
  return weeks;
}

/** The month name above a week column that contains the 1st of that month. */
function monthLabel(week: Array<Date | null>) {
  const first = week.find((day) => day?.getUTCDate() === 1);
  return first ? MONTHS[first.getUTCMonth()] : "";
}

/** Yearly activity: decisions and finished baseline quizzes per day, with arrows to change the year. */
export function ActivityCalendar() {
  const [year, setYear] = useState<number | undefined>(undefined);
  const [activity, setActivity] = useState<YearActivity | null>(null);

  // `current` ignores a reply for a year the player has already moved away from
  useEffect(() => {
    let current = true;
    AnalyticsService.getMyActivity(year).then((response) => current && response.ok && setActivity(response.data.data));
    return () => {
      current = false;
    };
  }, [year]);

  if (!activity) return <Skeleton className="h-52" />;

  const today = new Date().toISOString().slice(0, 10);
  const weeks = weeksOf(activity.year);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Figure label="Total this year" value={activity.total} />
          <Figure label="Active days" value={activity.active_days} />
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Previous year" disabled={activity.year <= activity.first_year}
            onClick={() => setYear(activity.year - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="w-12 text-center font-semibold tabular-nums">{activity.year}</span>
          <Button variant="ghost" size="icon" aria-label="Next year" disabled={activity.year >= activity.last_year}
            onClick={() => setYear(activity.year + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* One column per week: the calendar fills the card's width, and scrolls sideways only on small phones */}
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[720px] gap-[3px]" style={{ gridTemplateColumns: `28px repeat(${weeks.length}, minmax(0, 1fr))` }}>
          <div className="grid grid-rows-[18px_repeat(7,minmax(0,1fr))] gap-[3px] text-[10px] text-muted-foreground">
            <span />
            {WEEKDAYS.map((label, index) => <span key={index} className="flex items-center">{label}</span>)}
          </div>
          {weeks.map((week, column) => (
            // minmax(0, 1fr): the month name may spill over its neighbours but never widens the column
            <div key={column} className="grid grid-cols-[minmax(0,1fr)] grid-rows-[18px_repeat(7,auto)] gap-[3px]">
              <span className="whitespace-nowrap text-[10px] leading-[18px] text-muted-foreground">{monthLabel(week)}</span>
              {Array.from({ length: 7 }, (_, row) => {
                const day = week[row];
                if (!day) return <span key={row} className="aspect-square w-full" />;
                const key = day.toISOString().slice(0, 10);
                const count = activity.days[key] ?? 0;
                const label = `${count} ${count === 1 ? "activity" : "activities"} on ${day.toLocaleDateString(undefined, {
                  weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
                })}`;
                return (
                  <span
                    key={row}
                    title={label}
                    aria-label={label}
                    className={`aspect-square w-full rounded-[3px] ${levelFor(count).className} ${key === today ? "outline outline-1 outline-sky-300" : ""}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium text-foreground">Key</span>
          {LEVELS.map((level) => (
            <span key={level.label} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded-[3px] ${level.className}`} />
              {level.label}
            </span>
          ))}
        </div>
        <span>Counts every decision (training and campaign emails) and each baseline quiz you finish.</span>
      </div>
    </div>
  );
}

/** A small labelled number in the calendar header. */
function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="ml-2 text-lg font-bold tabular-nums text-foreground">{value.toLocaleString()}</span>
    </div>
  );
}
