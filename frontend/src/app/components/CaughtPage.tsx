// Public page shown after clicking the link in a training email, or after reporting it

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Fish, Flag, LogIn, Paperclip, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "./ui/button";
import CampaignService from "../../services/campaignService";

interface LandingInfo {
  email: string;
  scenario_title: string;
  sender: string | null;
  subject: string | null;
  is_phishing: boolean;
  cues: string[];
  xp: number | null;
  attachment: string | null;
  /** The locked result, if there is one: CLICKED, REPORTED or IGNORED. */
  outcome: "CLICKED" | "REPORTED" | "IGNORED" | null;
  via_attachment: boolean;
}

// The four ways a training email can end: {clicked or reported} x {phishing or genuine}
const OUTCOMES = {
  "caught-phishing": {
    tone: "red",
    icon: Fish,
    title: "You clicked a phishing link",
    text: "Good news: this was a safe training test from PhishSimulator, not a real attack. Nothing was installed and none of your details were taken.",
    tips: [
      { icon: TriangleAlert, tone: "text-amber-300", text: "In a real attack, that click could have opened a fake login page or downloaded malware." },
      { icon: ShieldCheck, tone: "text-green-300", text: "Next time, check the sender's real address and hover a link to see where it truly goes before clicking." },
    ],
  },
  "caught-genuine": {
    tone: "green",
    icon: CheckCircle2,
    title: "That link was safe",
    text: "This was a genuine email in a PhishSimulator training test, so opening its link was fine. Trusting real messages matters as much as spotting fake ones.",
    tips: [
      { icon: ShieldCheck, tone: "text-green-300", text: "The sender, the address and the link all matched who the email claimed to be from." },
    ],
  },
  "reported-phishing": {
    tone: "green",
    icon: ShieldCheck,
    title: "Well spotted: you reported it",
    text: "That email was a PhishSimulator training test, and reporting it was exactly the right move. In a real attack, your report warns IT before anyone else falls for it.",
    tips: [
      { icon: ShieldCheck, tone: "text-green-300", text: "Keep it up: when an email feels off, report it rather than clicking or just deleting it." },
    ],
  },
  "reported-genuine": {
    tone: "amber",
    icon: Flag,
    title: "False alarm: this one was genuine",
    text: "Thanks for being careful. This training email was actually real, so no harm done, but reporting genuine messages takes up IT's time.",
    tips: [
      { icon: ShieldCheck, tone: "text-green-300", text: "Before reporting, check the sender's full address and where the links go. If they match the real organisation, it is likely genuine." },
    ],
  },
  "attachment-phishing": {
    tone: "red",
    icon: Paperclip,
    title: "You opened the attachment",
    text: "Good news: this was a safe PhishSimulator training exercise. No file was downloaded and nothing on your device changed.",
    tips: [
      { icon: TriangleAlert, tone: "text-amber-300", text: "In a real attack, an unexpected attachment like this could carry malware." },
      { icon: ShieldCheck, tone: "text-green-300", text: "Next time, don't open attachments you weren't expecting. Confirm with the sender another way first." },
    ],
  },
  "attachment-genuine": {
    tone: "green",
    icon: CheckCircle2,
    title: "That attachment was safe",
    text: "This was a genuine email in a PhishSimulator training exercise, so opening its attachment was fine.",
    tips: [
      { icon: ShieldCheck, tone: "text-green-300", text: "The sender and the file matched what you'd expect from the real organisation." },
    ],
  },
  "ignored-phishing": {
    tone: "slate",
    icon: Clock,
    title: "This exercise has closed",
    text: "You didn't respond within the time window, so it counts as ignored. You didn't fall for it, which kept you safe.",
    tips: [
      { icon: ShieldCheck, tone: "text-green-300", text: "Reporting it would have been even better: a report warns everyone else too." },
    ],
  },
  "ignored-genuine": {
    tone: "slate",
    icon: Clock,
    title: "This exercise has closed",
    text: "You didn't respond within the time window, so it counts as ignored. This one was a genuine email, so no harm done.",
    tips: [
      { icon: ShieldCheck, tone: "text-green-300", text: "When unsure, check the sender and the link rather than ignoring an email outright." },
    ],
  },
} as const;

const TONES = {
  red: { card: "border-red-500/40 from-red-600/20", badge: "bg-red-500/25", icon: "text-red-300" },
  green: { card: "border-green-500/40 from-green-600/20", badge: "bg-green-500/25", icon: "text-green-300" },
  amber: { card: "border-amber-500/40 from-amber-600/20", badge: "bg-amber-500/25", icon: "text-amber-300" },
  slate: { card: "border-slate-500/40 from-slate-600/20", badge: "bg-slate-500/25", icon: "text-slate-300" },
};

/** Which page to show. The recorded result wins: the first response is the one that counts. */
function pageFor(variant: "caught" | "reported", info: LandingInfo | null) {
  const kind = info?.is_phishing === false ? "genuine" : "phishing";
  if (info?.outcome === "IGNORED") return `ignored-${kind}` as const;
  if (info?.outcome === "REPORTED") return `reported-${kind}` as const;
  if (info?.outcome === "CLICKED") return info.via_attachment ? `attachment-${kind}` as const : `caught-${kind}` as const;
  return `${variant}-${kind}` as const;
}

/** Where a training-email link lands: "caught" after a click, "reported" after using the report link. */
export function CaughtPage({ variant }: { variant: "caught" | "reported" }) {
  const [info, setInfo] = useState<LandingInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const token = new URLSearchParams(window.location.search).get("token");

  useEffect(() => {
    if (!token) {
      setLoaded(true);
      return;
    }
    CampaignService.getLanding(token)
      .then((response) => {
        if (response.ok && response.data.success) setInfo(response.data.data);
      })
      .finally(() => setLoaded(true));
  }, [token]);

  const page = pageFor(variant, info);
  const outcome = OUTCOMES[page];
  const tone = TONES[outcome.tone];
  // They used a second link after already responding: say the first response is the one that counts
  const alreadyCounted = Boolean(info?.outcome) && !page.startsWith(variant === "caught" ? "caught" : "reported")
    && !(variant === "caught" && page.startsWith("attachment"));

  // Send them to the login for the account the email was addressed to, not whoever is signed in here
  const goToLogin = () => {
    window.location.href = info ? `/?login=${encodeURIComponent(info.email)}` : "/";
  };

  if (!loaded) return <div className="min-h-screen bg-[#0a0e14]" />;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#0a0e14]">
      <div className={`max-w-lg w-full rounded-2xl border bg-linear-to-br to-slate-900/40 p-8 text-center ${tone.card}`}>
        <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${tone.badge}`}>
          <outcome.icon className={`w-8 h-8 ${tone.icon}`} />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-white">{outcome.title}</h1>
        <p className="mt-2 text-slate-300">{outcome.text}</p>
        {alreadyCounted && (
          <p className="mt-3 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
            Your first response was already recorded, and it's the one that counts. This exercise can't be changed.
          </p>
        )}

        {info && (
          <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4 text-left text-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400">The email</p>
            <p className="font-medium text-white">{info.subject || info.scenario_title}</p>
            {info.sender && <p className="text-xs text-slate-400">From {info.sender}</p>}
            {info.attachment && (
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                <Paperclip className="w-3 h-3" />
                {info.attachment}
              </p>
            )}
            {info.cues.length > 0 && (
              <>
                <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">
                  {page.startsWith("caught") || page.startsWith("attachment") ? "Warning signs you missed" : "Warning signs it had"}
                </p>
                <ul className="mt-1 space-y-1 text-slate-200">
                  {info.cues.map((cue) => (
                    <li key={cue} className="flex gap-2">
                      <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
                      {cue}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        <div className="mt-4 text-left space-y-3">
          {outcome.tips.map((tip) => (
            <div key={tip.text} className="flex gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
              <tip.icon className={`w-5 h-5 shrink-0 ${tip.tone}`} />
              <span>{tip.text}</span>
            </div>
          ))}
        </div>

        {info && info.xp !== null && (
          <p className={`mt-4 text-sm font-semibold ${info.xp > 0 ? "text-green-300" : info.xp < 0 ? "text-red-300" : "text-slate-300"}`}>
            {info.xp > 0 ? `+${info.xp}` : info.xp} XP. Sign in to see the full feedback in your inbox.
          </p>
        )}

        <Button className="mt-6 w-full" onClick={goToLogin}>
          <LogIn className="w-4 h-4" />
          {info ? `Sign in as ${info.email}` : "Sign in to practise spotting phishing"}
        </Button>
      </div>
    </div>
  );
}
