// Message text with safe links that never open

import { useState } from "react";

const LINK_PATTERN = /\[([^\]\n]{1,80})\]\(((?:https?:\/\/|www\.)[^\s)]+)\)|((?:https?:\/\/|www\.)[^\s<>"'\]]+)/g;
const TRAILING_PUNCTUATION = /[.,;:!?)]+$/;

interface MessageTextProps {
  text: string;
  className?: string;
  onLinkClick?: (url: string) => void;
}

type Part = { kind: "text"; text: string } | { kind: "link"; label: string; href: string };

/** Split message text into plain text and links (masked or bare). */
function toParts(text: string): Part[] {
  const parts: Part[] = [];
  let last = 0;

  for (const match of text.matchAll(LINK_PATTERN)) {
    const start = match.index ?? 0;
    let raw = match[0];
    let href = match[2] ?? match[3];
    let label = match[1] ?? href;

    if (!match[1]) {
      const trailing = raw.match(TRAILING_PUNCTUATION)?.[0] ?? "";
      raw = raw.slice(0, raw.length - trailing.length);
      href = raw;
      label = raw;
    }

    parts.push({ kind: "text", text: text.slice(last, start) });
    parts.push({ kind: "link", label, href });
    last = start + raw.length;
  }
  parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}

/** Every real address in a message, masked or not (for the admin review screen). */
export function linkTargets(text: string) {
  return toParts(text).flatMap((part) => (part.kind === "link" ? [part.href] : []));
}

/** Message text with safe links that show their address on hover. */
export function MessageText({ text, className = "", onLinkClick }: MessageTextProps) {
  return (
    <p className={`whitespace-pre-wrap break-words leading-relaxed ${className}`}>
      {toParts(text).map((part, index) =>
        part.kind === "link"
          ? <SafeLink key={index} label={part.label} url={part.href} onClick={onLinkClick} />
          : part.text,
      )}
    </p>
  );
}

/** A link that never opens; clicking it is reported instead. */
function SafeLink({ label, url, onClick }: { label: string; url: string; onClick?: (url: string) => void }) {
  const [isHovered, setIsHovered] = useState(false);
  const href = url.startsWith("www.") ? `http://${url}` : url;

  return (
    <span className="relative inline-block">
      <button
        type="button"
        className="text-sky-400 underline underline-offset-2 hover:text-sky-300 cursor-pointer text-left"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
        onClick={() => onClick?.(url)}
      >
        {label}
      </button>
      {isHovered && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-20 mt-1 w-max max-w-sm rounded-sm border border-slate-400/40 bg-[#f4f4f4] px-2 py-1 text-xs text-slate-900 shadow-md break-all"
        >
          {href}
          {onClick && <span className="block text-[10px] text-slate-500">Click to follow link</span>}
        </span>
      )}
    </span>
  );
}
