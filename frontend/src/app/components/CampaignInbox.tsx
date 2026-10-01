// Player inbox on Home: results of the real training emails (campaigns) sent to them, with feedback

import { useEffect, useState } from "react";
import { Bell, CheckCircle2, ChevronDown, ChevronRight, EyeOff, Fish, Flag, Mail, MousePointerClick, Paperclip, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { MessageText } from "./simulation/MessageText";
import CampaignService from "../../services/campaignService";

interface InboxItem {
  id: number;
  outcome: "CLICKED" | "REPORTED" | "IGNORED";
  is_phishing: boolean;
  xp: number;
  seen: boolean;
  sent_at: string | null;
  acted_at: string | null;
  /** They opened the attachment rather than the link. */
  via_attachment: boolean;
  email: { title: string; sender: string | null; subject: string | null; message: string | null; attachment: string | null; cues: string[] };
}

// Headline, verdict and advice for each result
const RESULTS: Record<string, { headline: string; verdict: string; advice: string; good: boolean; icon: typeof Fish }> = {
  "phishing-CLICKED": {
    headline: "You fell for a phishing email",
    verdict: "This was a phishing test and you clicked its link. In a real attack that could have led to a fake login page or malware.",
    advice: "Check the sender's full address and hover links to see where they really go before clicking.",
    good: false,
    icon: MousePointerClick,
  },
  "phishing-CLICKED-attachment": {
    headline: "You opened a phishing attachment",
    verdict: "This was a phishing test and you opened its attachment. It was a safe placeholder, but in a real attack a file like this could have installed malware.",
    advice: "Don't open attachments you weren't expecting. Confirm with the sender another way first.",
    good: false,
    icon: Paperclip,
  },
  "genuine-CLICKED-attachment": {
    headline: "You opened a genuine attachment. Correct",
    verdict: "This training email was genuine, so opening its attachment was fine.",
    advice: "You checked the right things: the sender and the file matched what the real organisation would send.",
    good: true,
    icon: CheckCircle2,
  },
  "phishing-REPORTED": {
    headline: "You reported a phishing email. Well done!",
    verdict: "This was a phishing test and you reported it: the best possible response. Reports warn IT before others fall for it.",
    advice: "Keep reporting anything suspicious rather than just deleting it.",
    good: true,
    icon: Flag,
  },
  "phishing-IGNORED": {
    headline: "You ignored a phishing email. Well done",
    verdict: "This was a phishing test and you didn't click it. Reporting it would have been even better, because it warns others.",
    advice: "Next time, use the report link on a suspicious email for the full bonus.",
    good: true,
    icon: EyeOff,
  },
  "genuine-CLICKED": {
    headline: "You trusted a genuine email. Correct",
    verdict: "This training email was genuine, so opening its link was fine. Trusting real messages matters as much as spotting fake ones.",
    advice: "You checked the right things: the sender and the link matched the real organisation.",
    good: true,
    icon: CheckCircle2,
  },
  "genuine-REPORTED": {
    headline: "You reported a genuine email (false alarm)",
    verdict: "This training email was actually genuine. Caution is good, but reporting real messages takes up IT's time.",
    advice: "Before reporting, compare the sender's address and link domain with the real organisation's.",
    good: false,
    icon: Flag,
  },
  "genuine-IGNORED": {
    headline: "You ignored a genuine email",
    verdict: "This training email was genuine. Ignoring it did no harm, though in real life you might have missed something you needed.",
    advice: "When unsure, check the sender and link rather than ignoring it outright.",
    good: true,
    icon: EyeOff,
  },
};

const SHOWN = 3;

/** Which wording to use: opening the attachment gets its own, for phishing and genuine emails. */
function resultKey(item: InboxItem) {
  const kind = item.is_phishing ? "phishing" : "genuine";
  return item.outcome === "CLICKED" && item.via_attachment ? `${kind}-CLICKED-attachment` : `${kind}-${item.outcome}`;
}

/** Notifications for campaign results. Renders nothing until the player has at least one. */
export function CampaignInbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [open, setOpen] = useState<InboxItem | null>(null);
  const [showAll, setShowAll] = useState(false);
  // Open while there is something new; folds away once everything has been read
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    CampaignService.getInbox().then((response) => {
      if (response.ok && response.data.success) {
        const loaded: InboxItem[] = response.data.data.items;
        setItems(loaded);
        setIsExpanded(loaded.some((item) => !item.seen));
      }
    });
  }, []);

  if (!items.length) return null;

  // Unread first, then newest
  const sorted = [...items].sort((first, second) => Number(first.seen) - Number(second.seen));
  const visible = showAll ? sorted : sorted.slice(0, SHOWN);
  const unseen = items.filter((item) => !item.seen).length;
  const netXp = items.reduce((total, item) => total + item.xp, 0);

  const openFeedback = (item: InboxItem) => {
    setOpen(item);
    if (!item.seen) {
      CampaignService.markSeen(item.id);
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, seen: true } : entry)));
    }
  };

  const closeFeedback = () => {
    setOpen(null);
    if (unseen === 0) {
      setIsExpanded(false);
      setShowAll(false);
    }
  };

  return (
    <Card className="gap-4">
      <CardHeader className="p-0">
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          aria-expanded={isExpanded}
          className={`flex w-full items-center justify-between gap-3 px-6 text-left ${isExpanded ? "pt-6" : "py-5"}`}
        >
          <div className="space-y-1.5 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4 text-sky-300" />
              Inbox
              {unseen > 0 && <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-semibold text-white">{unseen} new</span>}
            </CardTitle>
            <CardDescription className="text-sm truncate">
              {isExpanded
                ? "Results from training emails sent to your real inbox"
                : `${items.length} campaign result${items.length === 1 ? "" : "s"}${unseen ? "" : ", all read"}`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {!isExpanded && <XpChip xp={netXp} />}
            <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
          </div>
        </button>
      </CardHeader>
      {isExpanded && (
      <CardContent className="space-y-2 pb-6">
        {visible.map((item) => {
          const result = RESULTS[resultKey(item)];
          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => openFeedback(item)}
              onKeyDown={(event) => event.key === "Enter" && openFeedback(item)}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:border-sky-500/40 ${
                item.seen ? "border-border" : result.good ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${result.good ? "bg-green-500/15" : "bg-red-500/15"}`}>
                <result.icon className={`w-5 h-5 ${result.good ? "text-green-300" : "text-red-300"}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {!item.seen && <span className="mr-1.5 inline-block w-2 h-2 rounded-full bg-sky-400 align-middle" />}
                  {result.headline}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  "{item.email.subject || item.email.title}" · {formatDay(item.acted_at ?? item.sent_at)}
                </p>
              </div>
              <XpChip xp={item.xp} />
              <Button size="sm" variant={item.seen ? "outline" : "default"} onClick={(event) => {
                event.stopPropagation();
                openFeedback(item);
              }}>
                Get feedback
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          );
        })}
        {items.length > SHOWN && (
          <Button size="sm" variant="ghost" className="w-full" onClick={() => setShowAll((current) => !current)}>
            {showAll ? "Show less" : `Show all ${items.length}`}
          </Button>
        )}
      </CardContent>
      )}

      <FeedbackDialog item={open} onClose={closeFeedback} />
    </Card>
  );
}

/** The email they received, what it really was, what they did and the XP. */
function FeedbackDialog({ item, onClose }: { item: InboxItem | null; onClose: () => void }) {
  const result = item ? RESULTS[resultKey(item)] : null;

  return (
    <Dialog open={Boolean(item)} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {item && result && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 pr-8">
                <result.icon className={`w-5 h-5 ${result.good ? "text-green-300" : "text-red-300"}`} />
                {result.headline}
              </DialogTitle>
              <DialogDescription>Training email received {formatDay(item.sent_at)}</DialogDescription>
            </DialogHeader>

            <div className={`rounded-lg border p-4 text-sm ${result.good ? "border-green-500/30 bg-green-500/10" : "border-red-500/30 bg-red-500/10"}`}>
              <div className="flex items-start justify-between gap-3">
                <p>{result.verdict}</p>
                <XpChip xp={item.xp} />
              </div>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <div className="p-4 bg-muted/40 space-y-1 text-sm">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    item.is_phishing ? "bg-red-500/15 text-red-300" : "bg-green-500/15 text-green-300"
                  }`}
                >
                  {item.is_phishing ? <Fish className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                  {item.is_phishing ? "IT WAS PHISHING" : "IT WAS GENUINE"}
                </span>
                <p className="truncate"><span className="text-muted-foreground">From: </span>{item.email.sender || "—"}</p>
                {item.email.attachment && (
                  <p className="flex items-center gap-1 truncate">
                    <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                    {item.email.attachment}
                  </p>
                )}
                <p><span className="text-muted-foreground">Subject: </span>{item.email.subject || item.email.title}</p>
              </div>
              <div className="p-4 max-h-64 overflow-y-auto">
                {item.email.message && <MessageText text={item.email.message} className="text-sm" />}
              </div>
            </div>

            {item.email.cues.length > 0 && (
              <div className="text-sm">
                <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Warning signs in this email</p>
                <ul className="space-y-1">
                  {item.email.cues.map((cue) => (
                    <li key={cue} className="flex gap-2">
                      <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
                      {cue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3 rounded-lg border p-3 text-sm">
              <ShieldCheck className="w-5 h-5 shrink-0 text-sky-300" />
              <span>{result.advice}</span>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** "+30 XP" in green, "-20 XP" in red, "0 XP" in grey. */
function XpChip({ xp }: { xp: number }) {
  const tone = xp > 0 ? "bg-green-500/15 text-green-300" : xp < 0 ? "bg-red-500/15 text-red-300" : "bg-muted text-muted-foreground";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{formatXp(xp)}</span>;
}

/** "+30 XP", "−20 XP" or "0 XP". */
export function formatXp(xp: number) {
  return xp > 0 ? `+${xp} XP` : xp < 0 ? `−${Math.abs(xp)} XP` : "0 XP";
}

/** Marks a decision that came from a real campaign email rather than in-app training. */
export function CampaignTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
      <Mail className="w-3 h-3" />
      Campaign
    </span>
  );
}

/** Local day and time. The backend stores UTC without a zone marker. */
function formatDay(value: string | null) {
  if (!value) return "";
  const date = new Date(value.endsWith("Z") ? value : `${value}Z`);
  return date.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
