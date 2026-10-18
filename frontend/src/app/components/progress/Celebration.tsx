// Confetti for correct answers and level ups

import { useMemo } from "react";
import { createPortal } from "react-dom";

const COLOURS = ["#38bdf8", "#a78bfa", "#fbbf24", "#34d399", "#f472b6", "#fb923c"];

/** A short burst of confetti. Re-mount it (change `key`) to play it again.
 *  Drawn straight into the page body: inside a dialog, "position: fixed" is measured from the dialog (it is
 *  moved with a CSS transform), so the falling pieces stayed below it and left empty space to scroll through. */
export function Confetti({ pieces = 60 }: { pieces?: number }) {
  const layout = useMemo(
    () => Array.from({ length: pieces }, (_, index) => ({
      left: `${(index * 37) % 100}%`,
      delay: `${(index % 12) * 0.05}s`,
      duration: `${2 + (index % 5) * 0.35}s`,
      drift: `${((index * 53) % 160) - 80}px`,
      colour: COLOURS[index % COLOURS.length],
    })),
    [pieces],
  );

  return createPortal(
    <div aria-hidden className="fixed inset-0 overflow-hidden pointer-events-none z-60">
      {layout.map((piece, index) => (
        <span
          key={index}
          className="confetti-piece"
          style={{
            left: piece.left,
            background: piece.colour,
            animationDelay: piece.delay,
            ["--duration" as string]: piece.duration,
            ["--drift" as string]: piece.drift,
          }}
        />
      ))}
    </div>,
    document.body,
  );
}
