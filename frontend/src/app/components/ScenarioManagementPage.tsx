// Admin page: review, edit and publish scenarios (CATCH "Approve")

import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Database,
  Edit,
  Layers,
  Link2,
  Mail,
  MessageSquare,
  Paperclip,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { confirmToast } from "./confirmToast";
import ScenarioService from "../../services/scenarioService";
import type { QaChecklist, ReviewAction } from "../../services/scenarioService";
import type { Channel, ScenarioStatus } from "../../types/catch";
import { FilterBar, toOptions } from "./FilterBar";
import { PageHeader } from "./PageHeader";
import { SortButton, type SortDirection } from "./sorting";
import { linkTargets } from "./simulation/MessageText";
import { parseSender } from "./simulation/EmailParts";
import { EmailReader } from "./EmailSimulation";
import { PhoneView } from "./SMSSimulation";
import {
  AnswerBadge,
  CategoryBadge,
  ChannelBadge,
  DifficultyBadge,
  QualityBadge,
  STATUS_STYLES,
  StatusBadge,
} from "./visuals";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Textarea } from "./ui/textarea";
import { InlineLoader, Spinner } from "./Loading";

interface ScenarioManagementPageProps {
  onBack: () => void;
}

interface ScenarioSummary {
  scenario_id: number;
  title: string;
  simulation_type: Channel;
  category: string;
  difficulty: "Easy" | "Medium" | "Hard";
  correct_answer: "REPORT" | "SAFE";
  status: ScenarioStatus;
  dataset_id: number | null;
  quality_score: number | null;
  has_attachment: boolean;
  /** The message contains a web address (plain or behind link text). */
  has_link: boolean;
  uses: number;
  approved_at: string | null;
  updated_at: string | null;
}

interface ScenarioDetail extends Omit<ScenarioSummary, "uses" | "has_attachment" | "has_link"> {
  sender: string | null;
  subject: string | null;
  message: string;
  attachment: string | null;
  correct_answer: "REPORT" | "SAFE";
  feedback: string | null;
  phishing_cues: string[];
  quality_checks: Array<{ label: string; passed: boolean; detail: string }>;
  created_at: string | null;
}

/** One dataset folder in the review list: its scenarios under the current filters. */
interface DatasetGroup {
  dataset_id: number | "none";
  name: string;
  uploaded_at: string | null;
  // At the selected stage (the rows an open group lists)
  count: number;
  // At every stage
  total: number;
  by_status: Record<ScenarioStatus, number>;
}

/** A live category or difficulty where one answer is missing or rare (from the server's balance report). */
interface BalanceFlag {
  channel: Channel;
  group: "category" | "difficulty";
  name: string;
  phishing: number;
  genuine: number;
  status: "one_sided" | "uneven";
}

interface ScenarioForm {
  title: string;
  simulation_type: Channel;
  category: string;
  difficulty: "Easy" | "Medium" | "Hard";
  sender: string;
  subject: string;
  message: string;
  attachment: string;
  correct_answer: "REPORT" | "SAFE";
  feedback: string;
  phishing_cues: string;
}

const CATEGORIES = [
  "Banking & Money", "Account Security", "Email & IT", "Prizes & Offers", "Delivery", "Government",
  "Employment", "University", "Social Media", "General",
];

const QA_ITEMS = [
  { key: "label_correct", label: "Label correct" },
  { key: "clues_accurate", label: "Clues accurate" },
  { key: "category_difficulty_fit", label: "Category & difficulty fit" },
  { key: "text_complete", label: "Text complete" },
  { key: "no_personal_data", label: "No real personal data" },
  { key: "links_safe", label: "Links made safe" },
];

const PIPELINE: ScenarioStatus[] = ["DRAFT", "APPROVED", "ACTIVE", "ARCHIVED"];

const BULK_ACTIONS_FOR: Record<ScenarioStatus, Array<{ action: ReviewAction; label: string }>> = {
  DRAFT: [{ action: "approve", label: "Approve" }, { action: "reject", label: "Reject" }],
  APPROVED: [{ action: "activate", label: "Activate" }, { action: "reject", label: "Reject" }],
  ACTIVE: [{ action: "archive", label: "Archive" }],
  ARCHIVED: [{ action: "activate", label: "Reactivate" }],
  REJECTED: [{ action: "reopen", label: "Reopen" }],
};

const QUALITY_OPTIONS = [
  { value: "80", label: "Quality 80+" },
  { value: "60", label: "Quality 60+" },
  { value: "40", label: "Quality 40+" },
];

// "When" filter: approved or changed since local midnight N days ago (worked out by the server)
const WHEN_OPTIONS = [
  { value: "approved_today", label: "Approved today" },
  { value: "approved_7d", label: "Approved in last 7 days" },
  { value: "approved_30d", label: "Approved in last 30 days" },
  { value: "updated_today", label: "Changed today" },
  { value: "updated_7d", label: "Changed in last 7 days" },
  { value: "updated_30d", label: "Changed in last 30 days" },
];

/** A date and time in the viewer's own time zone, e.g. "5 Oct, 14:32", or a dash when there is none. */
function formatWhen(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const ACTIONS_FOR: Record<ScenarioStatus, Array<{ action: ReviewAction; label: string }>> = {
  DRAFT: [{ action: "approve", label: "Approve" }, { action: "reject", label: "Reject" }],
  APPROVED: [{ action: "activate", label: "Activate for players" }, { action: "reject", label: "Reject" }],
  ACTIVE: [{ action: "archive", label: "Archive" }],
  ARCHIVED: [{ action: "activate", label: "Reactivate" }],
  REJECTED: [{ action: "reopen", label: "Reopen as draft" }],
};

// What a review button says while the server works on it
const BUSY_LABEL: Record<ReviewAction, string> = {
  approve: "Approving…", reject: "Rejecting…", activate: "Activating…", archive: "Archiving…", reopen: "Reopening…",
};

// The stage a scenario is in after each review action
const REVIEW_RESULT: Record<ReviewAction, ScenarioStatus> = {
  approve: "APPROVED", reject: "REJECTED", activate: "ACTIVE", archive: "ARCHIVED", reopen: "DRAFT",
};

const emptyFilters = {
  status: "DRAFT",
  search: "",
  difficulty: "",
  category: "",
  answer: "",
  dataset_id: "",
  min_quality: "",
  when: "",
  // Table order, applied by the server so it holds across every page
  sort: "quality",
  order: "desc",
};

/** A QA checklist with nothing ticked. */
function emptyChecklist(): QaChecklist {
  return Object.fromEntries(QA_ITEMS.map((item) => [item.key, false]));
}

/** Blank values for the scenario form. */
function emptyForm(channel: Channel): ScenarioForm {
  return {
    title: "",
    simulation_type: channel,
    category: "Account Security",
    difficulty: "Medium",
    sender: "",
    subject: "",
    message: "",
    attachment: "",
    correct_answer: "REPORT",
    feedback: "",
    phishing_cues: "",
  };
}

/** Admin page to review, edit and publish scenarios. */
export function ScenarioManagementPage({ onBack }: ScenarioManagementPageProps) {
  const [channel, setChannel] = useState<Channel>("EMAIL");
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);

  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [channelCounts, setChannelCounts] = useState({ email: 0, sms: 0 });
  const [categories, setCategories] = useState<string[]>(CATEGORIES);
  const [groups, setGroups] = useState<DatasetGroup[]>([]);
  const [balance, setBalance] = useState<BalanceFlag[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  // Which view (channel, filters, page) the rows on screen belong to, and the number of the latest request:
  // a slower, older reply is ignored, and rows from another view are never shown under the open group
  const [loadedView, setLoadedView] = useState("");
  const latestRequest = useRef(0);
  // The action waiting for the server ("open-12", "review-approve", "preview-archive", "bulk"): its control
  // shows a spinner, and the other actions wait, so nothing is clicked twice
  const [busy, setBusy] = useState<string | null>(null);

  const [reviewing, setReviewing] = useState<ScenarioDetail | null>(null);
  const [checklist, setChecklist] = useState<QaChecklist>(emptyChecklist());
  const [bulk, setBulk] = useState<{ action: ReviewAction; label: string; count: number } | null>(null);

  const [form, setForm] = useState<ScenarioForm>(emptyForm("EMAIL"));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // The open dataset folder: the one picked, or the only one when there is just one
  const openDataset = filters.dataset_id || (groups.length === 1 ? String(groups[0].dataset_id) : "");
  // The rows on screen match the current channel, filters and page (otherwise a loader shows instead)
  const rowsCurrent = loadedView === viewKey(page);
  const shownScenarios = rowsCurrent ? scenarios : [];

  /** Show the server's message as a success or error toast. */
  const notify = (response: { ok: boolean; data: { success: boolean; message: string } }) => {
    if (response.ok && response.data.success) toast.success(response.data.message);
    else toast.error(response.data.message || "Something went wrong.");
  };

  function viewKey(requestedPage: number) {
    return JSON.stringify({ channel, filters, page: requestedPage });
  }

  const loadScenarios = async (requestedPage = page) => {
    const request = ++latestRequest.current;
    const view = viewKey(requestedPage);
    setIsLoading(true);
    const response = await ScenarioService.getScenarios(requestedPage, { ...filters, simulation_type: channel });
    if (request !== latestRequest.current) return;   // a newer request has been sent since
    setIsLoading(false);
    if (!response.ok || !response.data.success) {
      toast.error(response.data.message || "Unable to load scenarios.");
      return;
    }
    const data = response.data.data;
    setLoadedView(view);
    setScenarios(data.scenarios);
    setStatusCounts(data.stats.by_status);
    setChannelCounts({ email: data.stats.email, sms: data.stats.sms });
    if (data.categories.length) setCategories(data.categories);
    setPagination(data.pagination);
    setGroups(data.groups ?? []);
    setBalance(data.balance ?? []);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => loadScenarios(page), 250);
    return () => window.clearTimeout(timer);
  }, [page, filters, channel]);

  const setFilter = (key: keyof typeof emptyFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  /** Sort by a column: the first click sorts ascending, the next click descending. */
  const sortBy = (column: string) => {
    setFilters((current) => ({
      ...current,
      sort: column,
      order: current.sort === column && current.order === "asc" ? "desc" : "asc",
    }));
    setPage(1);
  };
  const sortState = { key: filters.sort, direction: filters.order as SortDirection };

  const switchChannel = (next: Channel) => {
    setChannel(next);
    setPage(1);
  };

  /** List the live scenarios behind one balance flag, so the admin can see which ones lean one way. */
  const showFlag = (flag: BalanceFlag) => {
    setChannel(flag.channel);
    setFilters({ ...emptyFilters, status: "ACTIVE", [flag.group]: flag.name });
    setPage(1);
    document.getElementById("scenario-groups")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openReview = async (scenarioId: number) => {
    if (busy) return;
    setBusy(`open-${scenarioId}`);
    const response = await ScenarioService.getScenario(scenarioId);
    setBusy(null);
    if (!response.ok || !response.data.success) {
      toast.error(response.data.message || "Unable to load scenario.");
      return;
    }
    setChecklist(emptyChecklist());
    setReviewing(response.data.data);
  };

  const runReview = async (action: ReviewAction) => {
    if (!reviewing || busy) return;
    setBusy(`review-${action}`);
    const response = await ScenarioService.reviewScenario(
      reviewing.scenario_id,
      action,
      action === "approve" ? checklist : undefined,
    );
    setBusy(null);
    if (response.ok && response.data.success) {
      const stage = REVIEW_RESULT[action];
      toast.success(response.data.message, {
        description: filters.status && filters.status !== stage
          ? `It has moved to the ${stage.toLowerCase()} stage, so it leaves this list. Pick ${stage.toLowerCase()} or All stages above to see it.`
          : undefined,
      });
      setReviewing(null);
      setChecklist(emptyChecklist());
      await loadScenarios();
    } else {
      notify(response);
    }
  };

  const scopeFilters = () => ({ ...filters, simulation_type: channel });

  /** Count what a bulk action would change, then ask to confirm. */
  const previewBulk = async (action: ReviewAction, label: string) => {
    if (busy) return;
    setBusy(`preview-${action}`);
    const response = await ScenarioService.bulkReview(action, scopeFilters(), undefined, true);
    setBusy(null);
    if (!response.ok || !response.data.success) {
      notify(response);
      return;
    }
    setChecklist(emptyChecklist());
    setBulk({ action, label, count: response.data.data.count });
  };

  const runBulk = async () => {
    if (!bulk || busy) return;
    setBusy("bulk");
    const response = await ScenarioService.bulkReview(
      bulk.action,
      scopeFilters(),
      bulk.action === "approve" ? checklist : undefined,
    );
    setBusy(null);
    notify(response);
    setBulk(null);
    await loadScenarios(1);
  };

  const isChecklistComplete = QA_ITEMS.every((item) => checklist[item.key]);

  const setField = <Field extends keyof ScenarioForm>(field: Field, value: ScenarioForm[Field]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const openCreate = () => {
    setForm(emptyForm(channel));
    setEditingId(null);
    setIsFormOpen(true);
  };

  const openEdit = (scenario: ScenarioDetail) => {
    setForm({
      title: scenario.title,
      simulation_type: scenario.simulation_type,
      category: scenario.category,
      difficulty: scenario.difficulty,
      sender: scenario.sender ?? "",
      subject: scenario.subject ?? "",
      message: scenario.message,
      attachment: scenario.attachment ?? "",
      correct_answer: scenario.correct_answer,
      feedback: scenario.feedback ?? "",
      phishing_cues: scenario.phishing_cues.join(", "),
    });
    setEditingId(scenario.scenario_id);
    setReviewing(null);
    setIsFormOpen(true);
  };

  const saveScenario = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    const payload = {
      ...form,
      phishing_cues: form.phishing_cues.split(",").map((cue) => cue.trim()).filter(Boolean),
    };
    const response = editingId
      ? await ScenarioService.updateScenario(editingId, payload)
      : await ScenarioService.createScenario(payload);
    setIsSaving(false);
    notify(response);

    if (response.ok && response.data.success) {
      setIsFormOpen(false);
      if (editingId) {
        await loadScenarios();
      } else {
        // A new scenario is a draft in the admin's own group: open that group at the Draft stage to show it
        // next to the earlier custom ones (the group's total still counts the live ones)
        setChannel(payload.simulation_type);
        setFilters({ ...emptyFilters, status: "DRAFT", dataset_id: "none" });
        setPage(1);
      }
    }
  };

  const confirmDeleteScenario = (scenario: ScenarioSummary) => {
    confirmToast({
      id: `confirm-delete-scenario-${scenario.scenario_id}`,
      title: `Delete "${scenario.title}"?`,
      description: "This cannot be undone. Scenarios players have attempted can only be archived.",
      onConfirm: () => deleteScenario(scenario),
    });
  };

  const deleteScenario = async (scenario: ScenarioSummary) => {
    const response = await ScenarioService.deleteScenario(scenario.scenario_id);
    notify(response);
    if (response.ok && response.data.success) await loadScenarios();
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Scenario Review"
        description="CATCH · Approve: only ACTIVE scenarios reach players"
        icon={ClipboardCheck}
        tone="bg-violet-500/20 text-violet-300"
        onBack={onBack}
        actions={(
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            New {channel === "EMAIL" ? "email" : "SMS"} scenario
          </Button>
        )}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        <div className="flex gap-2">
          <ChannelTab
            icon={Mail}
            label="Email scenarios"
            count={channelCounts.email}
            isActive={channel === "EMAIL"}
            activeClass="border-sky-400 bg-linear-to-br from-sky-500/25 to-sky-500/5 text-sky-200"
            onClick={() => switchChannel("EMAIL")}
          />
          <ChannelTab
            icon={MessageSquare}
            label="SMS scenarios"
            count={channelCounts.sms}
            isActive={channel === "SMS"}
            activeClass="border-purple-400 bg-linear-to-br from-purple-500/25 to-purple-500/5 text-purple-200"
            onClick={() => switchChannel("SMS")}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Review pipeline</CardTitle>
            <CardDescription>Click a stage to see its scenarios. Counts follow the filters below.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {PIPELINE.map((status, index) => (
                <div key={status} className="flex items-center gap-2">
                  <StageButton
                    status={status}
                    count={statusCounts[status] ?? 0}
                    isSelected={filters.status === status}
                    onClick={() => setFilter("status", status)}
                  />
                  {index < PIPELINE.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              ))}
              <span className="mx-2 text-muted-foreground">|</span>
              <StageButton
                status="REJECTED"
                count={statusCounts.REJECTED ?? 0}
                isSelected={filters.status === "REJECTED"}
                onClick={() => setFilter("status", "REJECTED")}
              />
              <Button size="sm" variant={filters.status === "" ? "default" : "outline"} onClick={() => setFilter("status", "")}>
                All stages
              </Button>
            </div>

            <FilterBar
              search={filters.search}
              onSearchChange={(value) => setFilter("search", value)}
              searchPlaceholder="Search title, sender or subject"
              filters={[
                {
                  key: "difficulty",
                  label: "Difficulties",
                  value: filters.difficulty,
                  options: toOptions(["Easy", "Medium", "Hard"]),
                  onChange: (value) => setFilter("difficulty", value),
                },
                {
                  key: "category",
                  label: "Categories",
                  value: filters.category,
                  options: toOptions(categories),
                  onChange: (value) => setFilter("category", value),
                },
                {
                  key: "answer",
                  label: "Labels",
                  value: filters.answer,
                  options: [{ value: "REPORT", label: "Phishing" }, { value: "SAFE", label: "Genuine" }],
                  onChange: (value) => setFilter("answer", value),
                },
                {
                  key: "quality",
                  label: "Any quality",
                  value: filters.min_quality,
                  options: QUALITY_OPTIONS,
                  onChange: (value) => setFilter("min_quality", value),
                },
                {
                  key: "when",
                  label: "Any time",
                  value: filters.when,
                  options: WHEN_OPTIONS,
                  onChange: (value) => {
                    // Newest first is what you want after picking a time window
                    setFilters((current) => ({
                      ...current,
                      // Drafts and rejected scenarios have no approval time, so show every stage instead
                      status: value.startsWith("approved") && ["DRAFT", "REJECTED"].includes(current.status) ? "" : current.status,
                      when: value,
                      sort: value ? value.split("_")[0] : current.sort,
                      order: value ? "desc" : current.order,
                    }));
                    setPage(1);
                  },
                },
              ]}
              onClear={() => {
                setFilters({ ...emptyFilters, status: filters.status });
                setPage(1);
              }}
              resultText={`${pagination.total.toLocaleString()} scenario(s)`}
            />

            {filters.status && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-3">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Layers className="w-3.5 h-3.5" />
                  Bulk actions apply to every scenario matching these filters:
                </span>
                {BULK_ACTIONS_FOR[filters.status as ScenarioStatus].map(({ action, label }) => (
                  <Button
                    key={action}
                    size="sm"
                    variant={action === "reject" || action === "archive" ? "destructive" : "secondary"}
                    disabled={!pagination.total || Boolean(busy)}
                    onClick={() => previewBulk(action, label)}
                  >
                    {busy === `preview-${action}` ? <><Spinner className="w-3.5 h-3.5 mr-1.5" />Counting…</> : `${label} all…`}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {balance.length > 0 && (
          <Card className="border-amber-500/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Categories with only one kind of answer
              </CardTitle>
              <CardDescription className="space-y-1">
                <span className="block">
                  Live scenarios in these groups are all (or almost all) phishing, or all genuine. Amber: only one
                  kind is live. Grey: the other kind is under a quarter.
                </span>
                <span className="block">
                  Why it matters: if every live Government message is phishing, a player could answer "Report" from
                  the label alone. The Adaptive mix still alternates phishing and genuine, but players can't pick
                  these categories for focused practice until they hold both kinds.
                </span>
                <span className="block">
                  To fix a group: make live some scenarios of the missing kind in it, archive the one-sided ones, or
                  correct a wrong category or difficulty when you review. Click a group to list its live scenarios.
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {balance.map((flag) => (
                <button
                  type="button"
                  key={`${flag.channel}-${flag.group}-${flag.name}`}
                  onClick={() => showFlag(flag)}
                  className={`rounded-md border px-2 py-1 text-xs transition-colors hover:border-sky-400/60 ${
                    flag.status === "one_sided"
                      ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                      : "border-border text-muted-foreground"
                  }`}
                  title={`${flag.status === "one_sided" ? "Only one answer is live" : "One answer is under a quarter"}. Click to list these live scenarios.`}
                >
                  {flag.channel === "EMAIL" ? "Email" : "SMS"} · {flag.name}
                  {flag.group === "difficulty" ? " (difficulty)" : ""}: {flag.phishing} phishing, {flag.genuine} genuine
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        <Card id="scenario-groups" className="scroll-mt-4">
          <CardHeader>
            <CardTitle>Scenarios by dataset</CardTitle>
            <CardDescription>
              Each dataset holds the scenarios made from it. Open one to review them; bulk actions then apply to that
              dataset only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {groups.map((group) => {
              const id = String(group.dataset_id);
              const isOpen = openDataset === id;
              return (
                <div key={id} className={`rounded-xl border ${isOpen ? "border-sky-500/40 bg-sky-500/5" : "border-border"}`}>
                  <button
                    type="button"
                    onClick={() => setFilter("dataset_id", isOpen ? "" : id)}
                    disabled={groups.length === 1}
                    aria-expanded={isOpen}
                    className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left disabled:cursor-default"
                  >
                    {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                    <Database className="w-4 h-4 shrink-0 text-teal-300" />
                    <span className="font-semibold">{group.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {group.total.toLocaleString()} scenario{group.total === 1 ? "" : "s"}
                      {filters.status && group.count !== group.total
                        && ` · ${group.count.toLocaleString()} ${filters.status.toLowerCase()} shown`}
                      {group.uploaded_at && ` · uploaded ${formatWhen(group.uploaded_at)}`}
                    </span>
                    {isOpen && isLoading && (
                      <span className="flex items-center gap-1.5 text-xs text-sky-300" role="status">
                        <Spinner className="w-3.5 h-3.5" /> Updating…
                      </span>
                    )}
                    <span className="ml-auto flex flex-wrap gap-1.5">
                      {[...PIPELINE, "REJECTED" as const].filter((status) => group.by_status[status]).map((status) => (
                        <span key={status} className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
                          {group.by_status[status]} {status.toLowerCase()}
                        </span>
                      ))}
                    </span>
                  </button>
                  {isOpen && <div className="space-y-4 border-t border-border px-4 pb-4 pt-3">
      <p className="text-xs text-muted-foreground">Click any row to open the review screen.</p>
      <Table aria-busy={isLoading} className={isLoading && shownScenarios.length ? "opacity-60 transition-opacity" : "transition-opacity"}>
        <TableHeader>
          <TableRow>
            <TableHead><SortButton label="Scenario" column="title" sort={sortState} onSort={sortBy} /></TableHead>
            <TableHead><SortButton label="Label" column="answer" sort={sortState} onSort={sortBy} /></TableHead>
            <TableHead><SortButton label="Category" column="category" sort={sortState} onSort={sortBy} /></TableHead>
            <TableHead><SortButton label="Difficulty" column="difficulty" sort={sortState} onSort={sortBy} /></TableHead>
            <TableHead><SortButton label="Status" column="status" sort={sortState} onSort={sortBy} /></TableHead>
            <TableHead><SortButton label="Quality" column="quality" sort={sortState} onSort={sortBy} /></TableHead>
            <TableHead><SortButton label="Uses" column="uses" sort={sortState} onSort={sortBy} /></TableHead>
            <TableHead><SortButton label="Approved" column="approved" sort={sortState} onSort={sortBy} /></TableHead>
            <TableHead><SortButton label="Last change" column="updated" sort={sortState} onSort={sortBy} /></TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {shownScenarios.map((scenario) => (
            <TableRow
              key={scenario.scenario_id}
              onClick={() => openReview(scenario.scenario_id)}
              aria-busy={busy === `open-${scenario.scenario_id}`}
              className={`hover:bg-sky-500/5 ${busy ? "cursor-wait" : "cursor-pointer"}`}
            >
              <TableCell className="font-medium max-w-md">
                <span className="flex items-center gap-1.5">
                  {busy === `open-${scenario.scenario_id}` && <Spinner className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{scenario.title}</span>
                  {scenario.has_link && (
                    <span title="Has a link" className="shrink-0">
                      <Link2 className="w-3.5 h-3.5 text-muted-foreground" aria-label="Has a link" />
                    </span>
                  )}
                  {scenario.has_attachment && (
                    <span title="Has an attachment" className="shrink-0">
                      <Paperclip className="w-3.5 h-3.5 text-muted-foreground" aria-label="Has an attachment" />
                    </span>
                  )}
                </span>
              </TableCell>
              <TableCell><AnswerBadge answer={scenario.correct_answer} /></TableCell>
              <TableCell><CategoryBadge category={scenario.category} /></TableCell>
              <TableCell><DifficultyBadge difficulty={scenario.difficulty} /></TableCell>
              <TableCell><StatusBadge status={scenario.status} /></TableCell>
              <TableCell><QualityBadge score={scenario.quality_score} /></TableCell>
              <TableCell>{scenario.uses}</TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatWhen(scenario.approved_at)}</TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatWhen(scenario.updated_at)}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Delete scenario"
                  onClick={(event) => {
                    event.stopPropagation();
                    confirmDeleteScenario(scenario);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!shownScenarios.length && (
            <TableRow>
              <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                {isLoading || !rowsCurrent ? <InlineLoader label="Loading scenarios..." />
                  : filters.status && !filters.search
                    ? `None at the ${filters.status.toLowerCase()} stage here. Pick another stage above, or All stages.`
                    : "No scenarios match these filters."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {pagination.page} of {pagination.pages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.pages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
                  </div>}
                </div>
              );
            })}
            {!groups.length && (isLoading ? <InlineLoader label="Loading datasets..." /> : (
              <p className="py-8 text-center text-muted-foreground">No scenarios match these filters.</p>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(reviewing)} onOpenChange={(open) => !open && setReviewing(null)}>
        <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-6xl h-[92vh] flex flex-col overflow-hidden p-0">
          {reviewing && (
            <>
              <DialogHeader className="px-6 pt-6">
                <DialogTitle className="text-xl pr-8">{reviewing.title}</DialogTitle>
                <DialogDescription asChild>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <StatusBadge status={reviewing.status} />
                    <ChannelBadge channel={reviewing.simulation_type} />
                    <CategoryBadge category={reviewing.category} />
                    <DifficultyBadge difficulty={reviewing.difficulty} />
                    <AnswerBadge answer={reviewing.correct_answer} />
                    <QualityBadge score={reviewing.quality_score} />
                    <span className="text-xs text-muted-foreground">
                      Created {formatWhen(reviewing.created_at)} · Approved {formatWhen(reviewing.approved_at)} · Last change {formatWhen(reviewing.updated_at)}
                    </span>
                  </div>
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-6 grid lg:grid-cols-[3fr_2fr] gap-6">
                <section className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground">What players will see</h4>
                  <div className="rounded-xl border overflow-hidden max-h-[55vh] overflow-y-auto">
                    {reviewing.simulation_type === "SMS"
                      ? <PhoneView scenario={{ ...reviewing, clue_options: [], already_completed: false }} />
                      : <EmailReader scenario={{ ...reviewing, clue_options: [], already_completed: false }} />}
                  </div>
                  <HiddenDetails scenario={reviewing} />
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Clues:</span>
                    {reviewing.phishing_cues.length
                      ? reviewing.phishing_cues.map((cue) => (
                          <span key={cue} className="rounded-full bg-amber-500/15 text-amber-200 px-2 py-0.5 text-xs">
                            {cue}
                          </span>
                        ))
                      : <span className="text-xs">none</span>}
                  </div>
                </section>

                <section className="space-y-5">
                  <div className="rounded-lg border p-4">
                    <h4 className="text-sm font-semibold mb-3">Automatic quality check</h4>
                    <ul className="space-y-2">
                      {reviewing.quality_checks.map((check) => (
                        <li key={check.label} className="flex gap-2 text-sm">
                          {check.passed
                            ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-400 shrink-0" />
                            : <XCircle className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" />}
                          <span>
                            <span className="font-medium">{check.label}.</span>{" "}
                            <span className="text-muted-foreground">{check.detail}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {reviewing.status === "DRAFT" && (
                    <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-4">
                      <QaChecklistForm checklist={checklist} onChange={setChecklist} />
                    </div>
                  )}
                </section>
              </div>

              <DialogFooter className="flex-wrap gap-2 border-t px-6 py-4">
                <Button variant="outline" onClick={() => openEdit(reviewing)}>
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                {ACTIONS_FOR[reviewing.status].map(({ action, label }) => (
                  <Button
                    key={action}
                    variant={action === "reject" || action === "archive" ? "destructive" : "default"}
                    disabled={(action === "approve" && !isChecklistComplete) || Boolean(busy)}
                    onClick={() => runReview(action)}
                  >
                    {busy === `review-${action}` ? <><Spinner className="w-4 h-4 mr-1.5 text-current" />{BUSY_LABEL[action]}</> : label}
                  </Button>
                ))}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(bulk)} onOpenChange={(open) => !open && setBulk(null)}>
        <DialogContent>
          {bulk && (
            <>
              <DialogHeader>
                <DialogTitle>{bulk.label} {bulk.count.toLocaleString()} scenario(s)?</DialogTitle>
                <DialogDescription>
                  Every {channel === "EMAIL" ? "email" : "SMS"} scenario matching the current filters will move
                  on. {bulk.action === "approve" && "Confirm you have spot-checked them against every QA item."}
                </DialogDescription>
              </DialogHeader>
              {bulk.action === "approve" && <QaChecklistForm checklist={checklist} onChange={setChecklist} />}
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulk(null)}>Cancel</Button>
                <Button
                  variant={bulk.action === "reject" || bulk.action === "archive" ? "destructive" : "default"}
                  disabled={!bulk.count || (bulk.action === "approve" && !isChecklistComplete) || Boolean(busy)}
                  onClick={runBulk}
                >
                  {busy === "bulk"
                    ? <><Spinner className="w-4 h-4 mr-1.5 text-current" />{BUSY_LABEL[bulk.action]}</>
                    : `${bulk.label} ${bulk.count.toLocaleString()}`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Scenario" : "Create Scenario"}</DialogTitle>
            <DialogDescription>
              New or edited scenarios become drafts and must pass review before players see them.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveScenario}>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Title">
                <Input value={form.title} onChange={(event) => setField("title", event.target.value)} required />
              </Field>
              <Field label={form.simulation_type === "SMS" ? "Sender (number or name)" : "Sender"}>
                <Input
                  value={form.sender}
                  onChange={(event) => setField("sender", event.target.value)}
                  placeholder={form.simulation_type === "SMS" ? "+27 82 000 0000" : "FNB Security <alerts@fnb-secure.co>"}
                />
              </Field>
              <Field label="Type">
                <Select
                  value={form.simulation_type}
                  options={["EMAIL", "SMS"]}
                  onChange={(value) => setField("simulation_type", value as Channel)}
                />
              </Field>
              <Field label="Category">
                <Select value={form.category} options={CATEGORIES} onChange={(value) => setField("category", value)} />
              </Field>
              <Field label="Difficulty">
                <Select
                  value={form.difficulty}
                  options={["Easy", "Medium", "Hard"]}
                  onChange={(value) => setField("difficulty", value as ScenarioForm["difficulty"])}
                />
              </Field>
              <Field label="Correct action">
                <Select
                  value={form.correct_answer}
                  options={["REPORT", "SAFE"]}
                  onChange={(value) => setField("correct_answer", value as ScenarioForm["correct_answer"])}
                />
              </Field>
            </div>
            {form.simulation_type === "EMAIL" && (
              <Field label="Subject">
                <Input value={form.subject} onChange={(event) => setField("subject", event.target.value)} />
              </Field>
            )}
            <Field label="Message">
              <Textarea
                value={form.message}
                onChange={(event) => setField("message", event.target.value)}
                rows={6}
                required
              />
              <p className="text-xs text-muted-foreground">
                Hide a link behind text with <code>[Button text](https://real-address)</code>. Players see the text and
                must hover to find the address.
              </p>
            </Field>
            {form.simulation_type === "EMAIL" && (
              <Field label="Attachment file name (optional)">
                <Input
                  value={form.attachment}
                  onChange={(event) => setField("attachment", event.target.value)}
                  placeholder="Invoice_4821.pdf or Invoice_4821.htm"
                />
              </Field>
            )}
            <Field label="Clues (comma separated)">
              <Input
                value={form.phishing_cues}
                onChange={(event) => setField("phishing_cues", event.target.value)}
                placeholder="Suspicious link, Urgency, Fake sender"
              />
            </Field>
            <Field label="Extra feedback for players (optional)">
              <Textarea value={form.feedback} onChange={(event) => setField("feedback", event.target.value)} />
            </Field>
            <DialogFooter>
              <Button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save Scenario"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** What players must work to find: the real sender address and link targets. */
function HiddenDetails({ scenario }: { scenario: ScenarioDetail }) {
  const targets = linkTargets(scenario.message);
  const { address } = parseSender(scenario.sender);

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
      <div>
        <span className="text-muted-foreground">Real sender: </span>
        <span className="font-mono break-all">{address || "none"}</span>
      </div>
      <div>
        <span className="text-muted-foreground">Link targets: </span>
        {targets.length
          ? targets.map((target) => <span key={target} className="font-mono break-all block">{target}</span>)
          : "none"}
      </div>
    </div>
  );
}

/** Email or SMS tab with its scenario count. */
function ChannelTab({ icon: Icon, label, count, isActive, activeClass, onClick }: {
  icon: typeof Mail;
  label: string;
  count: number;
  isActive: boolean;
  activeClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-52 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
        isActive ? `${activeClass} shadow-lg` : "border-border text-muted-foreground hover:text-foreground hover:-translate-y-0.5"
      }`}
    >
      <span className="w-10 h-10 rounded-lg bg-black/20 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </span>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-2xl font-bold tabular-nums">{count.toLocaleString()}</span>
      </span>
    </button>
  );
}

/** Review stage filter with its count. */
function StageButton({ status, count, isSelected, onClick }: {
  status: ScenarioStatus;
  count: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-28 rounded-xl border px-4 py-2.5 text-left transition-all ${STATUS_STYLES[status]} ${
        isSelected ? "ring-2 ring-sky-400 -translate-y-0.5 shadow-lg" : "opacity-80 hover:opacity-100 hover:-translate-y-0.5"
      }`}
    >
      <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-80">{status}</span>
      <span className="block text-2xl font-bold tabular-nums">{count.toLocaleString()}</span>
    </button>
  );
}

/** Checkboxes an admin must tick before approving. */
function QaChecklistForm({ checklist, onChange }: {
  checklist: QaChecklist;
  onChange: (checklist: QaChecklist) => void;
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-3">QA checklist</h4>
      <div className="space-y-2">
        {QA_ITEMS.map((item) => (
          <label key={item.key} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 accent-sky-500"
              checked={checklist[item.key] ?? false}
              onChange={(event) => onChange({ ...checklist, [item.key]: event.target.checked })}
            />
            {item.label}
          </label>
        ))}
      </div>
    </div>
  );
}

/** A labelled form field. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/** A plain dropdown for the scenario form. */
function Select({ value, onChange, options }: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <select
      className="w-full h-9 rounded-md border bg-input-background px-3 text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  );
}
