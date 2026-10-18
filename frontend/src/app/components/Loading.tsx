// Loading indicators shared by every page: a spinner with a short label, announced to screen readers

import { Loader2 } from "lucide-react";

/** A spinning icon. Sized by className (default 20 px); the theme's primary colour unless className sets one
 * (e.g. text-current inside a button, which is itself the primary colour). */
export function Spinner({ className = "w-5 h-5" }: { className?: string }) {
  const colour = /\btext-(?!xs|sm|base|lg|xl|\d)/.test(className) ? "" : "text-primary";
  return <Loader2 aria-hidden className={`animate-spin ${colour} ${className}`} />;
}

/** Fills the page area (or the whole screen) while a page or its data loads. */
export function PageLoader({ label = "Loading...", fullScreen = false }: { label?: string; fullScreen?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 text-muted-foreground ${
        fullScreen ? "min-h-screen" : "h-full min-h-[50vh]"
      }`}
    >
      <Spinner className="w-8 h-8" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

/** A small spinner and label for one panel, list or table that is still loading. */
export function InlineLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
      <Spinner className="w-4 h-4" />
      {label}
    </div>
  );
}
