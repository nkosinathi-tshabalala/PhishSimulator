// The bar at the top of each page: back button, icon, title, description and actions

import type { ReactNode } from "react";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { Button } from "./ui/button";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  /** Tailwind classes that tint the icon tile, e.g. "bg-sky-500/15 text-sky-300". */
  tone?: string;
  onBack?: () => void;
  /** Buttons shown on the right. */
  actions?: ReactNode;
}

/** Shared page title bar, so every page looks and behaves the same. */
export function PageHeader({ title, description, icon: Icon, tone = "bg-sky-500/15 text-sky-300", onBack, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card/70 px-4 py-3 backdrop-blur-md sm:px-6">
      {onBack && (
        <Button variant="ghost" size="icon" onClick={onBack} title="Back" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
      )}
      {Icon && (
        <div className={`hidden sm:flex w-10 h-10 shrink-0 rounded-lg items-center justify-center ${tone}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
