// Admin page: send phishing email campaigns to your own inboxes

import { useEffect, useState } from "react";
import {
  Clock,
  Eye,
  EyeOff,
  FileText,
  Fish,
  Flag,
  Layers,
  Lock,
  Mail,
  MousePointerClick,
  PenLine,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  CheckCircle2,
  Paperclip,
} from "lucide-react";
import { Button } from "./ui/button";
import { FilterBar } from "./FilterBar";
import { PageHeader } from "./PageHeader";
import { SortButton, useSort } from "./sorting";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Skeleton } from "./ui/skeleton";
import { toast } from "sonner";
import { confirmToast } from "./confirmToast";
import { CategoryBadge, DifficultyBadge } from "./visuals";
import { MessageText } from "./simulation/MessageText";
import CampaignService, { type CustomEmail } from "../../services/campaignService";

interface Scenario {
  scenario_id: number;
  title: string;
  sender: string;
  subject: string;
  message: string;
  category: string;
  difficulty: string;
  is_phishing: boolean;
  cues: string[];
  attachment: string | null;
  /** Has a link or an attachment. Without one there is nothing to click or track, so it can't be sent. */
  clickable: boolean;
}

interface Campaign {
  campaign_id: number;
  name: string;
  /** DRAFT, LAUNCHED, COMPLETED (every result is final, so it is closed) or FAILED. */
  status: string;
  scenario_title: string;
  /** Written by the admin rather than taken from a scenario. */
  is_custom: boolean;
  is_phishing: boolean;
  attachment: string | null;
  /** When the response window ends for this campaign's emails. */
  closes_at: string | null;
  /** Only on the detailed report: exactly what was sent. */
  email?: { sender: string | null; subject: string | null; message: string | null; attachment: string | null; cues: string[] };
  created_at: string;
  launched_at: string | null;
  recipients: number;
  sent: number;
  opened: number;
  clicked: number;
  reported: number;
  /** Delivered, no click or report within ignore_minutes. */
  ignored: number;
  /** Delivered, still inside the ignore window. */
  waiting: number;
  ignore_minutes: number;
  /** One outcome per recipient: REPORTED, IGNORED, WAITING, CLICKED or NOT_SENT. */
  outcomes: Record<string, number>;
  click_rate: number;
  report_rate: number;
  recipient_details?: Recipient[];
}

/** One recipient's delivery and result, shown in the campaign details. */
interface Recipient {
  email: string;
  delivery_status: string;
  outcome: string;
  /** They opened the attachment rather than the link. */
  via_attachment: boolean;
  /** XP the player won or lost, once their result is final. */
  xp_awarded: number | null;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  click_count: number;
  reported_at: string | null;
}

interface PlayerOption {
  player_id: number;
  full_name: string;
  email: string;
  occupation: string;
  /** True when the player agreed to campaign emails (on registration or in their profile). */
  consented: boolean;
  /** True when the address is on the safety allow-list. */
  allowed: boolean;
  /** Only consenting, allow-listed players can be picked. */
  selectable: boolean;
  /** Why a player cannot be picked, or null. */
  blocked_reason: string | null;
}

interface Context {
  sending_enabled: boolean;
  allowed_recipients: string[];
  ignore_minutes: number;
  /** Suggested look-alike attachment names for custom emails. */
  attachment_presets: string[];
  /** XP per result, e.g. phishing_reported: 30. */
  points: Record<string, number>;
  players: PlayerOption[];
  scenarios: Scenario[];
  campaigns: Campaign[];
}

const OCCUPATIONS = ["All", "Student", "Employee", "Other"];

interface EmailDispatcherPageProps {
  onBack: () => void;
}

/** Admin page to send a phishing email campaign to your own inboxes. */
export function EmailDispatcherPage({ onBack }: EmailDispatcherPageProps) {
  const [context, setContext] = useState<Context | null>(null);
  const [source, setSource] = useState<"scenario" | "custom">("scenario");
  const [scenarioId, setScenarioId] = useState<number | null>(null);
  const [custom, setCustom] = useState<CustomDraft>(EMPTY_CUSTOM);
  const [name, setName] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  // The campaign opened in the details dialog
  const [report, setReport] = useState<Campaign | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const loadContext = async () => {
    const response = await CampaignService.getContext();
    if (response.ok && response.data.success) {
      const data = response.data.data as Context;
      setContext(data);
      setScenarioId((current) => current ?? data.scenarios.find((item) => item.clickable)?.scenario_id ?? null);
    } else {
      toast.error(response.data.message || "Unable to load campaigns.");
    }
  };

  useEffect(() => {
    loadContext();
  }, []);

  const scenario = context?.scenarios.find((item) => item.scenario_id === scenarioId);
  const customEmail = toCustomEmail(custom);
  const customReady = Boolean(custom.senderName.trim() && custom.senderAddress.trim() && custom.subject.trim() && custom.message.trim());
  const emailReady = source === "scenario" ? Boolean(scenario?.clickable) : customReady;
  const unclickable = context?.scenarios.filter((item) => !item.clickable).length ?? 0;

  // What the preview shows: the chosen scenario, or the custom email as it is being written
  const preview: EmailPreviewData | null = source === "scenario"
    ? scenario ? { ...scenario } : null
    : { sender: customEmail.sender, subject: customEmail.subject, message: customEmail.message, attachment: customEmail.attachment,
        is_phishing: customEmail.is_phishing, cues: customEmail.cues };

  const createCampaign = async () => {
    if (!emailReady) return;
    setIsBusy(true);
    const response = await CampaignService.createCampaign(
      source === "scenario" ? { scenarioId: scenarioId! } : { custom: customEmail },
      name,
      recipients,
    );
    setIsBusy(false);
    if (response.ok && response.data.success) {
      toast.success(response.data.message);
      setName("");
      setRecipients([]);
      setCustom(EMPTY_CUSTOM);
      await loadContext();
      await viewReport(response.data.data.campaign_id);
    } else {
      toast.error(response.data.message || "Could not create the campaign.");
    }
  };

  const launchCampaign = async (campaignId: number) => {
    setIsBusy(true);
    const response = await CampaignService.launchCampaign(campaignId);
    setIsBusy(false);
    if (response.ok && response.data.success) {
      // The launch ran, but Gmail may still have refused some or all of the emails
      const { sent, recipients } = response.data.data as Campaign;
      if (sent === recipients) toast.success(response.data.message);
      else if (sent > 0) toast.warning(response.data.message, { duration: 10000 });
      else toast.error(response.data.message, { duration: 10000 });
      await loadContext();
      await viewReport(campaignId);
    } else {
      toast.error(response.data.message || "Could not launch the campaign.");
    }
  };

  const viewReport = async (campaignId: number) => {
    const response = await CampaignService.getReport(campaignId);
    if (response.ok && response.data.success) setReport(response.data.data);
  };

  const confirmDelete = (campaign: Campaign) => {
    confirmToast({
      id: `confirm-delete-campaign-${campaign.campaign_id}`,
      title: `Delete "${campaign.name}"?`,
      description: "This also removes its recipient tracking. It cannot be undone.",
      onConfirm: () => deleteCampaign(campaign),
    });
  };

  const deleteCampaign = async (campaign: Campaign) => {
    setIsBusy(true);
    const response = await CampaignService.deleteCampaign(campaign.campaign_id);
    setIsBusy(false);
    if (response.ok && response.data.success) {
      toast.success(response.data.message);
      setReport((current) => (current?.campaign_id === campaign.campaign_id ? null : current));
      await loadContext();
    } else {
      toast.error(response.data.message || "Could not delete the campaign.");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Email Campaigns"
        description="Send a real phishing test to your own inboxes and track it"
        icon={Send}
        tone="bg-sky-500/20 text-sky-300"
        onBack={onBack}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-5xl w-full mx-auto">
        {!context ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-64" />
          </>
        ) : (
          <>
            <SafetyBanner context={context} />

            <Card>
              <CardHeader>
                <CardTitle>Build a campaign</CardTitle>
                <CardDescription>
                  Use one of the email scenarios, or write your own and mark it phishing or genuine. Then pick recipients.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Campaign name (e.g. September Microsoft 365 test)" maxLength={150} />
                <div className="grid gap-4 md:grid-cols-2 items-start">
                  <div className="space-y-4 min-w-0">
                    <div className="grid grid-cols-2 gap-1 rounded-lg border p-1 text-sm">
                      {([["scenario", "From a scenario", Layers], ["custom", "Write your own", PenLine]] as const).map(([value, label, Icon]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setSource(value)}
                          className={`flex items-center justify-center gap-2 rounded-md py-1.5 transition-colors ${
                            source === value ? "bg-sky-500/20 text-sky-200" : "text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {label}
                        </button>
                      ))}
                    </div>

                    {source === "scenario" ? (
                      <label className="block space-y-2 text-sm font-medium">
                        Email scenario
                        <select
                          className="w-full h-9 rounded-md border bg-input-background px-3 text-sm font-normal"
                          value={scenarioId ?? ""}
                          onChange={(event) => setScenarioId(Number(event.target.value))}
                        >
                          {!context.scenarios.length && <option value="">No active email scenarios</option>}
                          {context.scenarios.map((item) => (
                            <option key={item.scenario_id} value={item.scenario_id} disabled={!item.clickable}>
                              {item.is_phishing ? "Phishing" : "Genuine"} · {item.title} · {item.category}
                              {item.clickable ? "" : " · nothing to click"}
                            </option>
                          ))}
                        </select>
                        {unclickable > 0 && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {unclickable} email(s) are greyed out: they have no link and no attachment, so a click
                            could not be tracked. Write a custom email to test clicking on one of them.
                          </span>
                        )}
                      </label>
                    ) : (
                      <CustomEmailForm value={custom} presets={context.attachment_presets} onChange={setCustom} />
                    )}

                    {preview && <EmailPreview email={preview} category={source === "scenario" ? scenario : undefined} />}
                  </div>
                  <RecipientPicker players={context.players} selected={recipients} onChange={setRecipients} />
                </div>

                <Button className="w-full" disabled={!emailReady || !recipients.length || isBusy} onClick={createCampaign}>
                  {recipients.length ? `Create draft for ${recipients.length} recipient(s)` : "Create draft"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Eye className="w-4 h-4" /> Campaigns</CardTitle>
                <CardDescription>
                  Click a campaign to see the email that was sent and each recipient's result. No click or report
                  within {context.ignore_minutes} minutes counts as ignored.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CampaignList
                  campaigns={context.campaigns}
                  canSend={context.sending_enabled && !isBusy}
                  isBusy={isBusy}
                  onOpen={(campaign) => viewReport(campaign.campaign_id)}
                  onSend={(campaign) => launchCampaign(campaign.campaign_id)}
                  onDelete={confirmDelete}
                />
              </CardContent>
            </Card>

            <CampaignDetails
              report={report}
              points={context.points}
              onClose={() => setReport(null)}
              onRefresh={() => report && viewReport(report.campaign_id)}
            />
          </>
        )}
      </div>
    </div>
  );
}

/** Pick campaign recipients from the registered players: search, filter by occupation, tick people. */
function RecipientPicker({
  players,
  selected,
  onChange,
}: {
  players: PlayerOption[];
  selected: string[];
  onChange: (emails: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [occupation, setOccupation] = useState("All");

  const term = search.trim().toLowerCase();
  const visible = players.filter((player) => {
    if (occupation !== "All" && player.occupation !== occupation) return false;
    if (!term) return true;
    return player.full_name.toLowerCase().includes(term) || player.email.toLowerCase().includes(term);
  });

  // "Select all" only ever picks players who consented and whose address the allow-list permits
  const selectableHere = visible.filter((player) => player.selectable);
  const allChosen = selectableHere.length > 0 && selectableHere.every((player) => selected.includes(player.email));

  const toggle = (email: string) => {
    onChange(selected.includes(email) ? selected.filter((item) => item !== email) : [...selected, email]);
  };

  const toggleAll = () => {
    const emails = selectableHere.map((player) => player.email);
    onChange(allChosen ? selected.filter((email) => !emails.includes(email)) : [...new Set([...selected, ...emails])]);
  };

  return (
    <div className="space-y-2 text-sm font-medium">
      <div className="flex items-center justify-between">
        <span>Recipients</span>
        <span className="text-xs font-normal text-muted-foreground">
          {selected.length} selected · {players.filter((player) => player.consented).length} of {players.length} opted in
        </span>
      </div>

      <div className="rounded-md border overflow-hidden">
        <div className="p-2 space-y-2 border-b bg-muted/30">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search players by name or email"
              className="pl-8 h-8 font-normal"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {OCCUPATIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setOccupation(option)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-normal border transition-colors ${
                  occupation === option
                    ? "bg-sky-500/20 border-sky-400/50 text-sky-200"
                    : "border-transparent text-muted-foreground hover:bg-muted"
                }`}
              >
                {option}
              </button>
            ))}
            <button
              type="button"
              onClick={toggleAll}
              disabled={!selectableHere.length}
              className="ml-auto text-xs font-normal text-sky-300 hover:underline disabled:opacity-40 disabled:no-underline"
            >
              {allChosen ? "Clear these" : `Select all (${selectableHere.length})`}
            </button>
          </div>
        </div>

        <div className="max-h-56 overflow-y-auto divide-y">
          {visible.map((player) => {
            const checked = selected.includes(player.email);
            return (
              <label
                key={player.player_id}
                title={player.blocked_reason ?? player.email}
                className={`flex items-center gap-3 px-3 py-2 ${
                  player.selectable ? "cursor-pointer hover:bg-muted/40" : "opacity-45 cursor-not-allowed"
                }`}
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-sky-500 shrink-0"
                  checked={checked}
                  disabled={!player.selectable}
                  onChange={() => toggle(player.email)}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-normal truncate">{player.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{player.email}</p>
                  {player.blocked_reason && <p className="text-xs text-amber-300/90 truncate">{player.blocked_reason}</p>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{player.occupation}</span>
                {!player.selectable && <Lock className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
              </label>
            );
          })}
          {!visible.length && (
            <p className="px-3 py-6 text-center text-sm font-normal text-muted-foreground">
              {players.length ? "No players match that search." : "No registered players yet."}
            </p>
          )}
        </div>
      </div>

      <p className="text-xs font-normal text-muted-foreground">
        Only players who agreed to campaign emails, and whose address is on the safety allow-list, can be picked.
        Players can give or withdraw consent in their profile at any time.
      </p>
    </div>
  );
}

/** Shows whether sending is on and which addresses are allowed. */
/** The campaign cards with a search, filters and a sort order. */
function CampaignList({ campaigns, canSend, isBusy, onOpen, onSend, onDelete }: {
  campaigns: Campaign[];
  canSend: boolean;
  isBusy: boolean;
  onOpen: (campaign: Campaign) => void;
  onSend: (campaign: Campaign) => void;
  onDelete: (campaign: Campaign) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");

  const query = search.toLowerCase();
  const matching = campaigns.filter((campaign) =>
    `${campaign.name} ${campaign.scenario_title ?? ""}`.toLowerCase().includes(query)
    && (!status || campaign.status === status)
    && (!kind || (kind === "PHISHING") === campaign.is_phishing),
  );
  const list = useSort(matching, {
    date: (campaign) => campaign.launched_at ?? campaign.created_at,
    name: (campaign) => campaign.name,
    clickRate: (campaign) => campaign.click_rate,
    reportRate: (campaign) => campaign.report_rate,
  }, { key: "date", direction: "desc" });

  if (!campaigns.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        <Send className="w-8 h-8 mx-auto mb-2 opacity-60" />
        No campaigns yet. Build one above to send your first test.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search campaigns"
        filters={[
          {
            key: "status",
            label: "Statuses",
            value: status,
            options: Object.keys(STATUS_STYLES).map((value) => ({ value, label: value.charAt(0) + value.slice(1).toLowerCase() })),
            onChange: setStatus,
          },
          {
            key: "kind",
            label: "Kinds",
            value: kind,
            options: [{ value: "PHISHING", label: "Phishing" }, { value: "GENUINE", label: "Genuine" }],
            onChange: setKind,
          },
        ]}
        onClear={() => {
          setSearch("");
          setStatus("");
          setKind("");
        }}
        resultText={`${matching.length} campaign(s)`}
      >
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Sort:</span>
          <SortButton label="Date" column="date" sort={list.sort} onSort={list.toggle} />
          <SortButton label="Name" column="name" sort={list.sort} onSort={list.toggle} />
          <SortButton label="Click rate" column="clickRate" sort={list.sort} onSort={list.toggle} />
          <SortButton label="Report rate" column="reportRate" sort={list.sort} onSort={list.toggle} />
        </div>
      </FilterBar>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.sorted.map((campaign) => (
          <CampaignCard
            key={campaign.campaign_id}
            campaign={campaign}
            canSend={canSend}
            isBusy={isBusy}
            onOpen={() => onOpen(campaign)}
            onSend={() => onSend(campaign)}
            onDelete={() => onDelete(campaign)}
          />
        ))}
      </div>
      {!matching.length && <p className="py-4 text-center text-sm text-muted-foreground">No campaigns match these filters.</p>}
    </div>
  );
}

function SafetyBanner({ context }: { context: Context }) {
  if (!context.sending_enabled) {
    return (
      <div className="flex gap-3 rounded-lg border border-amber-400/40 bg-amber-400/10 p-4 text-sm">
        <TriangleAlert className="w-5 h-5 text-amber-300 shrink-0" />
        <div>
          <p className="font-medium text-amber-100">Sending is off</p>
          <p className="text-amber-100/80">
            Add <code>SMTP_USERNAME</code> and <code>SMTP_PASSWORD</code> (a Gmail app password) to <code>backend/.env</code>.
            You can still create drafts. Sending stays disabled until then.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm">
      <ShieldCheck className="w-5 h-5 text-green-300 shrink-0" />
      <div>
        <p className="font-medium text-green-100">Sending is on, with a safety allow-list</p>
      </div>
    </div>
  );
}

// Colours per campaign status, in the same tinted-gradient style as the player cards
const STATUS_STYLES: Record<string, { card: string; pill: string; icon: typeof Send }> = {
  LAUNCHED: { card: "from-sky-500/20 via-indigo-500/10 to-transparent border-sky-500/30", pill: "bg-sky-500/20 text-sky-200", icon: Send },
  DRAFT: { card: "from-slate-500/20 to-transparent border-slate-500/30", pill: "bg-slate-500/25 text-slate-200", icon: FileText },
  FAILED: { card: "from-red-500/20 to-transparent border-red-500/30", pill: "bg-red-500/20 text-red-300", icon: TriangleAlert },
  // Every result is final: the campaign is closed and nothing can change it
  COMPLETED: { card: "from-green-500/15 via-emerald-500/5 to-transparent border-green-500/30", pill: "bg-green-500/20 text-green-300", icon: CheckCircle2 },
};

interface OutcomeStyle {
  label: string;
  tone: string;
  bar: string;
  icon: typeof Send;
}

/** How a result looks. For a genuine email, clicking is fine and reporting is a false alarm. */
function outcomeStyle(outcome: string, isPhishing: boolean): OutcomeStyle {
  const good = "bg-green-500/15 text-green-300 border-green-500/30";
  const bad = "bg-red-500/15 text-red-300 border-red-500/30";
  const styles: Record<string, OutcomeStyle> = {
    REPORTED: isPhishing
      ? { label: "Reported", tone: good, bar: "bg-green-400", icon: Flag }
      : { label: "False alarm", tone: "bg-amber-500/15 text-amber-300 border-amber-500/30", bar: "bg-amber-400", icon: Flag },
    CLICKED: isPhishing
      ? { label: "Clicked", tone: bad, bar: "bg-red-400", icon: MousePointerClick }
      : { label: "Clicked (safe)", tone: good, bar: "bg-green-400", icon: MousePointerClick },
    IGNORED: { label: "Ignored", tone: "bg-slate-500/15 text-slate-300 border-slate-500/30", bar: "bg-slate-400", icon: EyeOff },
    WAITING: { label: "Waiting", tone: "bg-sky-500/15 text-sky-300 border-sky-500/30", bar: "bg-sky-400/60", icon: Clock },
    NOT_SENT: { label: "Not sent", tone: "bg-amber-500/15 text-amber-300 border-amber-500/30", bar: "bg-amber-400/60", icon: TriangleAlert },
  };
  return styles[outcome] ?? styles.WAITING;
}

/** "Phishing" or "Genuine" label. */
function KindBadge({ isPhishing }: { isPhishing: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
        isPhishing ? "bg-red-500/15 text-red-300" : "bg-green-500/15 text-green-300"
      }`}
    >
      {isPhishing ? <Fish className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
      {isPhishing ? "PHISHING" : "GENUINE"}
    </span>
  );
}

/** Stacked bar: how the recipients turned out. */
function OutcomeBar({ campaign }: { campaign: Campaign }) {
  if (!campaign.recipients) return <div className="h-2 rounded-full bg-muted" />;
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-muted">
      {Object.entries(campaign.outcomes).map(([key, value]) => {
        if (!value || key === "NOT_SENT") return null;
        const style = outcomeStyle(key, campaign.is_phishing);
        return (
          <div
            key={key}
            className={style.bar}
            style={{ width: `${(value / campaign.recipients) * 100}%` }}
            title={`${style.label}: ${value}`}
          />
        );
      })}
    </div>
  );
}

/** One campaign as a card. Clicking it opens the details of what was sent. */
function CampaignCard({ campaign, canSend, isBusy, onOpen, onSend, onDelete }: {
  campaign: Campaign;
  canSend: boolean;
  isBusy: boolean;
  onOpen: () => void;
  onSend: () => void;
  onDelete: () => void;
}) {
  const style = STATUS_STYLES[campaign.status] ?? STATUS_STYLES.DRAFT;
  const stats = [
    { label: "Opened", value: campaign.opened, icon: Eye },
    { label: "Clicked", value: campaign.clicked, icon: MousePointerClick },
    { label: "Reported", value: campaign.reported, icon: Flag },
    { label: "Ignored", value: campaign.ignored, icon: EyeOff },
  ];
  const date = new Date(campaign.launched_at ?? campaign.created_at).toLocaleDateString();
  // The Send and Delete buttons sit inside the card, so they must not also open it
  const stop = (action: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation();
    action();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && (event.preventDefault(), onOpen())}
      title="Open the details"
      className={`flex flex-col cursor-pointer rounded-xl border bg-linear-to-br p-4 text-left transition-all outline-none hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-sky-400 ${style.card}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
          <style.icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white truncate" title={campaign.name}>{campaign.name}</p>
          <p className="text-xs text-muted-foreground truncate" title={campaign.scenario_title}>
            {campaign.is_custom ? <PenLine className="inline w-3 h-3 mr-1 -mt-0.5" /> : <Mail className="inline w-3 h-3 mr-1 -mt-0.5" />}
            {campaign.scenario_title}
          </p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${style.pill}`}>{campaign.status}</span>
      </div>

      <div className="mt-3">
        <KindBadge isPhishing={campaign.is_phishing} />
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{campaign.sent} of {campaign.recipients} delivered</span>
          <span>{campaign.launched_at ? `Sent ${date}` : `Created ${date}`}</span>
        </div>
        <OutcomeBar campaign={campaign} />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg bg-black/20 px-2 py-1.5 text-center">
            <p className="text-base font-bold text-white">{stat.value}</p>
            <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
              <stat.icon className="w-3.5 h-3.5" />
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {campaign.status === "COMPLETED" && (
        <p className="mt-4 flex items-center gap-1.5 border-t border-white/10 pt-3 text-xs text-green-300">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Closed: every result is final and can't be changed
        </p>
      )}
      {campaign.status === "LAUNCHED" && campaign.closes_at && (
        <p className="mt-4 flex items-center gap-1.5 border-t border-white/10 pt-3 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          Open for responses until {formatTime(campaign.closes_at)}
        </p>
      )}
      {(campaign.status === "DRAFT" || campaign.status === "FAILED") && (
        <div className="mt-4 flex gap-2 pt-3 border-t border-white/10">
          {campaign.status === "DRAFT" && (
            <Button size="sm" className="flex-1" disabled={!canSend} onClick={stop(onSend)}>
              <Send className="w-4 h-4" />
              Send now
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={isBusy}
            onClick={stop(onDelete)}
            title="Delete campaign"
            className={`text-red-300 hover:text-red-200 ${campaign.status === "DRAFT" ? "" : "flex-1"}`}
          >
            <Trash2 className="w-4 h-4" />
            {campaign.status !== "DRAFT" && "Delete"}
          </Button>
        </div>
      )}
    </div>
  );
}

interface EmailPreviewData {
  sender: string | null;
  subject: string | null;
  message: string | null;
  attachment?: string | null;
  is_phishing: boolean;
  cues: string[];
}

/** Colour for a file type, like a mail client's attachment icon. */
function fileTone(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "pdf") return "bg-rose-600";
  if (["xls", "xlsx", "csv"].includes(extension)) return "bg-green-600";
  if (["doc", "docx"].includes(extension)) return "bg-blue-600";
  if (["zip"].includes(extension)) return "bg-amber-600";
  return "bg-slate-600";
}

/** A look-alike attachment tile: what the recipient sees in the email (no real file is sent). */
export function AttachmentChip({ name }: { name: string }) {
  const extension = (name.split(".").pop() ?? "file").toUpperCase().slice(0, 4);
  return (
    <div className="inline-flex max-w-full items-center gap-3 rounded-lg border bg-muted/40 p-2 pr-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white ${fileTone(name)}`}>
        {extension}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Paperclip className="h-3 w-3" />
          Attachment
        </p>
      </div>
    </div>
  );
}

/** The email as the recipient sees it, with its type and (for phishing) the warning signs. */
function EmailPreview({ email, category }: { email: EmailPreviewData; category?: { category: string; difficulty: string } }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="p-4 bg-muted/40 space-y-1 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <KindBadge isPhishing={email.is_phishing} />
          {category && <CategoryBadge category={category.category} />}
          {category && <DifficultyBadge difficulty={category.difficulty} />}
        </div>
        <p className="truncate"><span className="text-muted-foreground">From: </span>{email.sender || "—"}</p>
        <p><span className="text-muted-foreground">Subject: </span>{email.subject || "—"}</p>
      </div>
      {/* Long emails scroll inside the preview so the two columns stay close in height */}
      <div className="p-4 max-h-72 overflow-y-auto">
        {email.message ? <MessageText text={email.message} className="text-sm" /> : <p className="text-sm text-muted-foreground">Nothing written yet.</p>}
      </div>
      {email.attachment && (
        <div className="border-t px-4 py-3">
          <AttachmentChip name={email.attachment} />
        </div>
      )}
      {email.is_phishing && email.cues.length > 0 && (
        <div className="border-t p-4 text-sm">
          <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Warning signs</p>
          <ul className="space-y-1">
            {email.cues.map((cue) => (
              <li key={cue} className="flex gap-2">
                <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
                {cue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface CustomDraft {
  senderName: string;
  senderAddress: string;
  subject: string;
  message: string;
  isPhishing: boolean;
  cues: string;
  attachment: string;
}

const EMPTY_CUSTOM: CustomDraft = {
  senderName: "",
  senderAddress: "",
  subject: "",
  message: "",
  isPhishing: true,
  cues: "",
  attachment: "",
};

/** The custom draft in the shape the API takes ("Name <address>" sender, one cue per line). */
function toCustomEmail(draft: CustomDraft): CustomEmail {
  const name = draft.senderName.trim();
  const address = draft.senderAddress.trim();
  return {
    sender: name && address ? `${name} <${address}>` : name || address,
    subject: draft.subject.trim(),
    message: draft.message.trim(),
    is_phishing: draft.isPhishing,
    cues: draft.isPhishing ? draft.cues.split("\n").map((cue) => cue.trim()).filter(Boolean) : [],
    attachment: draft.attachment.trim() || undefined,
  };
}

/** Write an email: sender, subject, body with links, attachment, phishing or genuine, and its warning signs. */
function CustomEmailForm({ value, presets, onChange }: {
  value: CustomDraft;
  presets: string[];
  onChange: (draft: CustomDraft) => void;
}) {
  const set = (field: keyof CustomDraft) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...value, [field]: event.target.value });

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-1 rounded-lg border p-1">
        {([[true, "Phishing", Fish], [false, "Genuine", ShieldCheck]] as const).map(([isPhishing, label, Icon]) => (
          <button
            key={label}
            type="button"
            onClick={() => onChange({ ...value, isPhishing })}
            className={`flex items-center justify-center gap-2 rounded-md py-1.5 transition-colors ${
              value.isPhishing === isPhishing
                ? isPhishing ? "bg-red-500/20 text-red-200" : "bg-green-500/20 text-green-200"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input value={value.senderName} onChange={set("senderName")} placeholder="Sender name (e.g. FNB Alerts)" maxLength={100} />
        <Input value={value.senderAddress} onChange={set("senderAddress")} placeholder="alerts@fnb-secure.co.za" maxLength={150} />
      </div>
      <Input value={value.subject} onChange={set("subject")} placeholder="Subject" maxLength={255} />
      <Textarea
        value={value.message}
        onChange={set("message")}
        rows={6}
        maxLength={5000}
        placeholder={"Write the email. Links become tracked links, for example:\n[Verify your account](https://fnb-secure.co.za/verify)"}
      />
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <select
            className="h-9 w-40 shrink-0 rounded-md border bg-input-background px-2 text-sm"
            value=""
            onChange={(event) => event.target.value && onChange({ ...value, attachment: event.target.value })}
            title="Pick a suggested file name"
          >
            <option value="">Suggestions…</option>
            {presets.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <Input
            value={value.attachment}
            onChange={set("attachment")}
            placeholder="Attachment (optional), e.g. Invoice_2026.pdf"
            maxLength={120}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Shown as a file tile in the email. No real file is sent: opening it counts like clicking the link.
        </p>
      </div>
      {value.isPhishing && (
        <Textarea
          value={value.cues}
          onChange={set("cues")}
          rows={3}
          placeholder={"Warning signs, one per line (shown in the player's feedback)\nLook-alike sender domain\nUrgent deadline"}
        />
      )}
    </div>
  );
}

/** Opened campaign: the exact email that was sent, and each recipient's result and XP. */
function CampaignDetails({ report, points, onClose, onRefresh }: {
  report: Campaign | null;
  points: Record<string, number>;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const kind = report?.is_phishing ? "phishing" : "genuine";
  // Clicking or reporting means they opened it, even if the tracking pixel was blocked
  const openedAt = (recipient: Recipient) => recipient.opened_at ?? recipient.clicked_at ?? recipient.reported_at;
  const recipients = useSort(report?.recipient_details ?? [], {
    email: (recipient) => recipient.email,
    result: (recipient) => recipient.outcome,
    xp: (recipient) => recipient.xp_awarded,
    opened: openedAt,
    clicked: (recipient) => recipient.clicked_at,
    reported: (recipient) => recipient.reported_at,
  }, { key: "email", direction: "asc" });

  return (
    <Dialog open={Boolean(report)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        {report && (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2 pr-8">
                <DialogTitle>{report.name}</DialogTitle>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${(STATUS_STYLES[report.status] ?? STATUS_STYLES.DRAFT).pill}`}>
                  {report.status}
                </span>
              </div>
              <DialogDescription>
                {report.is_custom ? "Custom email" : `Scenario: ${report.scenario_title}`}
                {report.launched_at && ` · sent ${formatTime(report.launched_at)}`}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 lg:grid-cols-5">
              <div className="lg:col-span-3 space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">What was sent</p>
                {report.email && (
                  <EmailPreview email={{ ...report.email, is_phishing: report.is_phishing }} />
                )}
              </div>

              <div className="lg:col-span-2 space-y-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Results</p>
                <OutcomeBar campaign={report} />
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {Object.entries(report.outcomes).filter(([, value]) => value).map(([key, value]) => (
                    <span key={key}>{outcomeStyle(key, report.is_phishing).label}: {value}</span>
                  ))}
                </div>
                <div className="rounded-lg border p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Player XP for this {kind} email</p>
                  <p>Reported {signed(points[`${kind}_reported`])} · Ignored {signed(points[`${kind}_ignored`])} · Clicked {signed(points[`${kind}_clicked`])}</p>
                  <p>Players see the result and feedback in their inbox on Home.</p>
                </div>
                {report.waiting > 0 && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    {report.waiting} still waiting. No click or report after {report.ignore_minutes} minutes counts as ignored.
                  </p>
                )}
                <Button size="sm" variant="outline" className="w-full" onClick={onRefresh}>
                  <RefreshCw className="w-4 h-4" />
                  Refresh results
                </Button>
              </div>
            </div>

            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="p-3"><SortButton label="Recipient" column="email" sort={recipients.sort} onSort={recipients.toggle} /></th>
                    <th className="p-3"><SortButton label="Result" column="result" sort={recipients.sort} onSort={recipients.toggle} /></th>
                    <th className="p-3"><SortButton label="XP" column="xp" sort={recipients.sort} onSort={recipients.toggle} /></th>
                    <th className="p-3"><SortButton label="Opened" column="opened" sort={recipients.sort} onSort={recipients.toggle} /></th>
                    <th className="p-3"><SortButton label="Clicked" column="clicked" sort={recipients.sort} onSort={recipients.toggle} /></th>
                    <th className="p-3"><SortButton label="Reported" column="reported" sort={recipients.sort} onSort={recipients.toggle} /></th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.sorted.map((recipient) => {
                    const outcome = outcomeStyle(recipient.outcome, report.is_phishing);
                    return (
                      <tr key={recipient.email} className="border-b last:border-0">
                        <td className="p-3">{recipient.email}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap ${outcome.tone}`}>
                            <outcome.icon className="w-3 h-3" />
                            {outcome.label}
                            {recipient.via_attachment && " (attachment)"}
                          </span>
                        </td>
                        <td className={`p-3 font-medium ${xpTone(recipient.xp_awarded)}`}>
                          {recipient.xp_awarded === null ? "—" : signed(recipient.xp_awarded)}
                        </td>
                        <td className="p-3 text-muted-foreground">{formatTime(openedAt(recipient))}</td>
                        <td className="p-3 text-muted-foreground">
                          {formatTime(recipient.clicked_at)}
                          {recipient.click_count > 1 && ` (${recipient.click_count}×)`}
                        </td>
                        <td className="p-3 text-muted-foreground">{formatTime(recipient.reported_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** "+30" / "-20" / "0". */
function signed(value: number | undefined | null) {
  if (value === undefined || value === null) return "—";
  return value > 0 ? `+${value}` : String(value);
}

/** Green for XP won, red for XP lost. */
function xpTone(value: number | null) {
  if (!value) return "text-muted-foreground";
  return value > 0 ? "text-green-300" : "text-red-300";
}

/** Short local date and time, or a dash. The backend stores UTC without a zone marker. */
function formatTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value.endsWith("Z") ? value : `${value}Z`);
  return date.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
