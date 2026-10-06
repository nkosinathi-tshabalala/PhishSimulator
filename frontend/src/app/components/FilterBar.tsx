// Search and filter bar used above tables and lists

import type { ReactNode } from "react";
import { Filter, Search, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterField {
  key: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

interface FilterBarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterField[];
  onClear?: () => void;
  resultText?: string;
  /** Extra controls shown after the filters, such as a sort button. */
  children?: ReactNode;
}

/** Search box plus dropdown filters used above tables and lists. */
export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters = [],
  onClear,
  resultText,
  children,
}: FilterBarProps) {
  const isFiltered = Boolean(search) || filters.some((filter) => filter.value);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {onSearchChange && (
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search ?? ""}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8"
          />
        </div>
      )}

      {filters.length > 0 && <Filter className="w-4 h-4 text-muted-foreground" aria-hidden />}
      {filters.map((filter) => (
        <select
          key={filter.key}
          aria-label={filter.label}
          value={filter.value}
          onChange={(event) => filter.onChange(event.target.value)}
          className={`h-9 rounded-md border px-3 text-sm bg-input-background ${
            filter.value ? "border-sky-400/60 text-sky-200" : ""
          }`}
        >
          {/* "Any quality" reads as is; a plural label such as "Difficulties" becomes "All difficulties" */}
          <option value="">{filter.label.startsWith("Any ") ? filter.label : `All ${filter.label.toLowerCase()}`}</option>
          {filter.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ))}

      {children}
      {isFiltered && onClear && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="w-4 h-4 mr-1" />
          Clear
        </Button>
      )}
      {resultText && <span className="ml-auto text-xs text-muted-foreground">{resultText}</span>}
    </div>
  );
}

/** Turn a plain list of strings into dropdown options. */
export function toOptions(values: string[]): FilterOption[] {
  return values.map((value) => ({ value, label: value }));
}
