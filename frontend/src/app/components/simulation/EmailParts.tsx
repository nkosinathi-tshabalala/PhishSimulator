// Email sender line and attachment chip

import { useState } from "react";
import { ChevronDown, ChevronUp, FileArchive, FileCode2, FileSpreadsheet, FileText, Paperclip } from "lucide-react";
import { useViewer } from "../../viewer";

/** Split "Display Name <address>" into its parts. */
export function parseSender(sender: string | null) {
  const value = (sender ?? "").trim();
  const match = value.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim() || match[2], address: match[2] };
  return { name: value || "Unknown sender", address: value };
}

const AVATAR_COLOURS = ["bg-sky-600", "bg-violet-600", "bg-emerald-600", "bg-amber-600", "bg-rose-600", "bg-indigo-600"];

/** Up to two initials for the sender avatar. */
function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, "").split(" ").filter(Boolean);
  return (words[0]?.[0] ?? "?").toUpperCase() + (words[1]?.[0] ?? "").toUpperCase();
}

/** Sender display name; the details (real from address, and the player as the recipient) show when opened. */
export function SenderLine({ sender, compact = false }: { sender: string | null; compact?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const viewer = useViewer();
  const { name, address } = parseSender(sender);
  const colour = AVATAR_COLOURS[name.length % AVATAR_COLOURS.length];
  const hasAddress = Boolean(address) && address !== name;
  const Chevron = isOpen ? ChevronUp : ChevronDown;
  const toggle = () => setIsOpen((current) => !current);

  return (
    <div className="flex items-start gap-3 min-w-0">
      <div className={`${compact ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm"} ${colour} rounded-full flex items-center justify-center font-semibold text-white shrink-0`}>
        {initials(name)}
      </div>
      <div className="min-w-0">
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-1 font-semibold text-foreground hover:underline text-left"
          title="Show sender details"
        >
          <span className="truncate">{name}</span>
          {(hasAddress || !compact) && <Chevron className="w-4 h-4 shrink-0" />}
        </button>
        {!compact && !isOpen && (
          <button type="button" onClick={toggle} className="text-xs text-muted-foreground hover:underline">
            to me
          </button>
        )}
        {isOpen && (
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs text-muted-foreground animate-in fade-in slide-in-from-top-1">
            <dt>from:</dt>
            <dd className="break-all">
              <span className="text-foreground">{name}</span>
              {hasAddress
                ? <span className="font-mono"> &lt;{address}&gt;</span>
                : <span className="italic"> (no address shown)</span>}
            </dd>
            {!compact && (
              <>
                <dt>to:</dt>
                <dd className="break-all">
                  {viewer
                    ? <><span className="text-foreground">{viewer.name}</span> <span className="font-mono">&lt;{viewer.email}&gt;</span></>
                    : "me"}
                </dd>
              </>
            )}
          </dl>
        )}
      </div>
    </div>
  );
}

/** Icon matching the attachment's file type. */
function fileIcon(name: string) {
  const lower = name.toLowerCase();
  if (/\.(zip|iso|rar|7z)$/.test(lower)) return FileArchive;
  if (/\.(htm|html|js)$/.test(lower)) return FileCode2;
  if (/\.(xlsx|xls|csv)$/.test(lower)) return FileSpreadsheet;
  return FileText;
}

/** A believable, stable file size for an attachment. */
function fakeSize(name: string) {
  const total = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return `${(total % 900) + 60} KB`;
}

/** An attachment chip. Opening it (when allowed) counts as trusting the message. */
export function AttachmentChip({ name, onOpen }: { name: string; onOpen?: (name: string) => void }) {
  const Icon = fileIcon(name);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(name)}
      disabled={!onOpen}
      title={onOpen ? `Open ${name}` : name}
      className="group inline-flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-left transition-colors enabled:hover:border-sky-400/60 enabled:hover:bg-sky-500/10 disabled:cursor-default"
    >
      <span className="w-9 h-9 rounded-md bg-background flex items-center justify-center">
        <Icon className="w-5 h-5 text-sky-300" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium truncate max-w-56">{name}</span>
        <span className="block text-[11px] text-muted-foreground">{fakeSize(name)}</span>
      </span>
      <Paperclip className="w-4 h-4 text-muted-foreground group-enabled:group-hover:text-sky-300" />
    </button>
  );
}
