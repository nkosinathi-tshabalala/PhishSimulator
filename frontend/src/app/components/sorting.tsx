// Click-to-sort columns: the first click sorts A→Z (or low→high), the next click reverses it

import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export type SortDirection = "asc" | "desc";
export type SortValue = string | number | boolean | null | undefined;

export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

/** True for a blank cell, which always sorts to the bottom. */
const isEmpty = (value: SortValue) => value === null || value === undefined || value === "";

/** Compare two cell values: numbers by size, text naturally ("2" before "10"). */
function compareValues(a: SortValue, b: SortValue) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Keeps which column a table is sorted by and returns its rows in that order.
 * `columns` says how to read each sortable column's value from a row.
 */
export function useSort<T, K extends string>(
  rows: T[],
  columns: Record<K, (row: T) => SortValue>,
  initial: SortState<NoInfer<K>>,
) {
  const [sort, setSort] = useState<SortState<K>>(initial);

  const toggle = (key: K) =>
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));

  const read = columns[sort.key];
  const sign = sort.direction === "asc" ? 1 : -1;
  const sorted = [...rows].sort((a, b) => {
    const [first, second] = [read(a), read(b)];
    // Blank cells stay at the bottom whichever way the column is sorted
    if (isEmpty(first) || isEmpty(second)) return Number(isEmpty(first)) - Number(isEmpty(second));
    return compareValues(first, second) * sign;
  });

  return { sorted, sort, toggle };
}

/** A column heading that sorts the table when clicked and shows which way it is sorted. */
export function SortButton<K extends string>({ label, column, sort, onSort }: {
  label: string;
  column: K;
  sort: SortState<K>;
  onSort: (column: K) => void;
}) {
  const active = sort.key === column;
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  const next = active && sort.direction === "asc" ? "descending" : "ascending";

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      title={`Sort by ${label.toLowerCase()} (${next})`}
      className={`inline-flex items-center gap-1 rounded font-medium transition-colors hover:text-foreground ${
        active ? "text-sky-300" : ""
      }`}
    >
      {label}
      <Icon className={`w-3.5 h-3.5 ${active ? "" : "opacity-50"}`} aria-hidden />
    </button>
  );
}
