// Filter bar for the metrics pages: a date range plus channel, difficulty, category, source and group

import { CalendarDays } from "lucide-react";
import { FilterBar, type FilterField } from "./FilterBar";
import { Input } from "./ui/input";

export interface MetricsFilterValues {
  range: string; // "7d", "30d", "90d", "all" or "custom"
  start: string; // YYYY-MM-DD, used when range is "custom"
  end: string;
  channel: string;
  difficulty: string;
  category: string;
  source: string;
  group: string;
}

export const DEFAULT_METRICS_FILTERS: MetricsFilterValues = {
  range: "30d", start: "", end: "", channel: "", difficulty: "", category: "", source: "", group: "",
};

const RANGES = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom" },
];

const DROPDOWNS = ["channel", "difficulty", "category", "source", "group"] as const;

/** The filters as URL parameters for the analytics API, e.g. "range=30d&channel=SMS". */
export function metricsQuery(filters: MetricsFilterValues) {
  const params = new URLSearchParams();
  if (filters.range === "custom") {
    if (filters.start) params.set("start", filters.start);
    if (filters.end) params.set("end", filters.end);
  } else if (filters.range !== "all") {
    params.set("range", filters.range);
  }
  DROPDOWNS.forEach((key) => filters[key] && params.set(key, filters[key]));
  return params.toString();
}

/** The chosen dates in words for chart descriptions, e.g. "last 30 days". */
export function rangeLabel(filters: MetricsFilterValues) {
  if (filters.range === "all") return "all time";
  if (filters.range === "custom") return `${filters.start || "the beginning"} to ${filters.end || "today"}`;
  return `last ${parseInt(filters.range)} days`;
}

/** Date-range buttons and dropdowns. `showGroup` adds the Students/Employees filter for admins. */
export function MetricsFilters({ value, onChange, categories, showGroup = false, loading = false }: {
  value: MetricsFilterValues;
  onChange: (filters: MetricsFilterValues) => void;
  categories: string[];
  showGroup?: boolean;
  loading?: boolean;
}) {
  const set = (key: keyof MetricsFilterValues, next: string) => onChange({ ...value, [key]: next });
  const dropdown = (key: keyof MetricsFilterValues, label: string, options: Array<[string, string]>): FilterField => ({
    key,
    label,
    value: value[key],
    options: options.map(([optionValue, optionLabel]) => ({ value: optionValue, label: optionLabel })),
    onChange: (next) => set(key, next),
  });

  const filters = [
    dropdown("channel", "Channels", [["EMAIL", "Email"], ["SMS", "SMS"]]),
    dropdown("difficulty", "Difficulties", [["Easy", "Easy"], ["Medium", "Medium"], ["Hard", "Hard"]]),
    dropdown("category", "Categories", categories.map((category) => [category, category])),
    dropdown("source", "Sources", [["TRAINING", "Training"], ["CAMPAIGN", "Email campaigns"]]),
    ...(showGroup ? [dropdown("group", "Groups", [["STUDENT", "Students"], ["EMPLOYEE", "Employees"], ["OTHER", "Other"]])] : []),
  ];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/70 p-3 backdrop-blur-md lg:flex-row lg:flex-wrap lg:items-center">
      <div role="group" aria-label="Date range" className="inline-flex w-fit items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
        <CalendarDays className="mx-1.5 w-4 h-4 text-muted-foreground" aria-hidden />
        {RANGES.map((range) => (
          <button
            key={range.value}
            type="button"
            aria-pressed={value.range === range.value}
            onClick={() => set("range", range.value)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              value.range === range.value ? "bg-sky-500/20 text-sky-200 shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>

      {value.range === "custom" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Input type="date" aria-label="From" value={value.start} max={value.end || undefined}
            onChange={(event) => set("start", event.target.value)} className="h-9 w-40" />
          <span>to</span>
          <Input type="date" aria-label="To" value={value.end} min={value.start || undefined}
            onChange={(event) => set("end", event.target.value)} className="h-9 w-40" />
        </div>
      )}

      <div className="flex-1">
        <FilterBar
          filters={filters}
          onClear={() => onChange({ ...value, channel: "", difficulty: "", category: "", source: "", group: "" })}
          resultText={loading ? "Updating…" : undefined}
        />
      </div>
    </div>
  );
}
