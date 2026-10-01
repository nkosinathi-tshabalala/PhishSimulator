// Confetti for correct answers and level ups

import { useMemo } from "react";

const COLOURS = ["#38bdf8", "#a78bfa", "#fbbf24", "#34d399", "#f472b6", "#fb923c"];

/** A short burst of confetti. Re-mount it (change `key`) to play it again. */
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

  return (
    <div aria-hidden>
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
    </div>
  );
}
