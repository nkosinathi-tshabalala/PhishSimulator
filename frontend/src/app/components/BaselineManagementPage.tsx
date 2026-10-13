// Admin page: baseline assessments for each role, and their questions (CATCH "Check")

import BaselineService from "../../services/baselineService";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  AlertTriangle,
  Briefcase,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  Edit,
  Eye,
  FolderOpen,
  GraduationCap,
  Library,
  Plus,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { StatCard, type StatTone } from "./StatCard";
import { PageHeader } from "./PageHeader";
import { FilterBar, toOptions } from "./FilterBar";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

interface BaselineQuestion {
  id: number;
  templateId: number;
  question: string;
  instruction: string;
  expectedKeywords: string[];
  exampleAnswer: string;
  feedback: string;
  confidenceThreshold: number;
}

/** A named baseline assessment for one role, e.g. "Student · Baseline assessment 1". */
interface BaselineTemplate {
  id: number;
  name: string;
  occupation: string | null;
  role: string;
  description: string;
  isActive: boolean;
  activatedAt: string | null;
  questionCount: number;
  ready: boolean;
  timesTaken: number;
  averageScore: number | null;
  questions: BaselineQuestion[];
}

interface QuestionForm {
  templateId: number | null;
  question: string;
  instruction: string;
  keywordInput: string;
  expectedKeywords: string[];
  exampleAnswer: string;
  feedback: string;
  confidenceThreshold: number;
}

interface TemplateForm {
  name: string;
  occupation: string;
  description: string;
}

const ROLES = ["Student", "Employee", "Other"] as const;
const ALL_ROLES = "All roles";
const ROLE_ICONS: Record<string, LucideIcon> = { Student: GraduationCap, Employee: Briefcase, Other: Users };
const ROLE_TONES: Record<string, StatTone> = { Student: "sky", Employee: "violet", Other: "amber" };
const ROLE_TEXT: Record<string, string> = {
  Student: "text-sky-300",
  Employee: "text-violet-300",
  Other: "text-amber-300",
};

const emptyQuestion = (templateId: number | null): QuestionForm => ({
  templateId,
  question: "",
  instruction: "",
  keywordInput: "",
  expectedKeywords: [],
  exampleAnswer: "",
  feedback: "",
  confidenceThreshold: 2,
});

/** Admin page: baseline assessments by role. Switch one on and every player of that role can take it, once. */
export function BaselineManagementPage() {
  const [templates, setTemplates] = useState<BaselineTemplate[]>([]);
  const [limits, setLimits] = useState({ min: 5, max: 7 });
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());

  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [form, setForm] = useState<QuestionForm>(emptyQuestion(null));
  const [viewing, setViewing] = useState<BaselineQuestion | null>(null);

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateForm>({ name: "", occupation: "Student", description: "" });

  const [deleting, setDeleting] = useState<{ kind: "question" | "template"; id: number; label: string } | null>(null);

  const loadTemplates = async () => {
    try {
      const response = await BaselineService.getTemplates();
      if (response.ok && response.data.success) {
        setTemplates(response.data.data.templates);
        setLimits({ min: response.data.data.minQuestions, max: response.data.data.maxQuestions });
      } else {
        toast.error(response.data.message || "Could not load the baseline assessments.");
      }
    } catch (error) {
      console.error("Failed to load baseline assessments:", error);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const search = searchQuery.trim().toLowerCase();
  const matchesQuestion = (q: BaselineQuestion) =>
    !search || q.question.toLowerCase().includes(search)
    || q.expectedKeywords.some((keyword) => keyword.toLowerCase().includes(search));

  const visible = templates.filter((t) =>
    (!roleFilter || t.role === roleFilter)
    && (!statusFilter || (statusFilter === "On") === t.isActive)
    && (!search || t.name.toLowerCase().includes(search) || t.description.toLowerCase().includes(search)
      || t.questions.some(matchesQuestion)),
  );
  const isFiltered = Boolean(search || roleFilter || statusFilter);

  // Role sections in a fixed order, each holding its assessments
  const sections = useMemo(() => {
    const order = [...ROLES, ALL_ROLES];
    return order
      .map((role) => ({ role, items: visible.filter((t) => t.role === role) }))
      .filter((section) => section.items.length);
  }, [visible]);

  const stats: Array<{ label: string; value: string; icon: LucideIcon; tone: StatTone; hint: string }> = [
    ...ROLES.map((role) => {
      const mine = templates.filter((t) => t.role === role);
      const on = mine.filter((t) => t.isActive).length;
      return {
        label: `${role} baselines on`,
        value: String(on),
        icon: ROLE_ICONS[role],
        tone: ROLE_TONES[role],
        hint: on ? `${mine.length} in the bank · each taken once` : `${mine.length} in the bank · none on yet`,
      };
    }),
    {
      label: "Questions in the bank",
      value: String(templates.reduce((total, t) => total + t.questionCount, 0)),
      icon: Library,
      tone: "green",
      hint: `${templates.length} baseline assessments`,
    },
  ];

  const toggleOpen = (id: number) => {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const replaceTemplate = (updated: BaselineTemplate) => {
    setTemplates((current) => current.map((t) => (t.id === updated.id ? updated : t)));
  };

  // ---------- assessment actions ----------

  const toggleActive = async (t: BaselineTemplate) => {
    const response = await BaselineService.setTemplateActive(t.id, !t.isActive);
    if (response.ok && response.data.success) {
      replaceTemplate(response.data.data);
      toast.success(response.data.message);
    } else {
      toast.error(response.data.message || "Could not change the assessment.");
    }
  };

  const loadBank = async () => {
    const response = await BaselineService.loadTemplateBank();
    if (response.ok && response.data.success) {
      toast.success(response.data.message);
      await loadTemplates();
    } else {
      toast.error(response.data.message || "Could not load the template bank.");
    }
  };

  const openNewTemplate = () => {
    setEditingTemplateId(null);
    setTemplateForm({ name: "", occupation: roleFilter && roleFilter !== ALL_ROLES ? roleFilter : "Student", description: "" });
    setTemplateModalOpen(true);
  };

  const openEditTemplate = (t: BaselineTemplate) => {
    setEditingTemplateId(t.id);
    setTemplateForm({ name: t.name, occupation: t.occupation ?? "", description: t.description });
    setTemplateModalOpen(true);
  };

  const saveTemplate = async () => {
    const payload = {
      name: templateForm.name.trim(),
      occupation: templateForm.occupation || null,
      description: templateForm.description.trim(),
    };
    const response = editingTemplateId !== null
      ? await BaselineService.updateTemplate(editingTemplateId, payload)
      : await BaselineService.createTemplate(payload);
    if (response.ok && response.data.success) {
      toast.success(response.data.message);
      setTemplateModalOpen(false);
      await loadTemplates();
      if (editingTemplateId === null) setOpenIds((current) => new Set(current).add(response.data.data.id));
    } else {
      toast.error(response.data.message || "Could not save the assessment.");
    }
  };

  // ---------- question actions ----------

  const openAddQuestion = (templateId: number) => {
    setEditingQuestionId(null);
    setForm(emptyQuestion(templateId));
    setQuestionModalOpen(true);
  };

  const openEditQuestion = (q: BaselineQuestion) => {
    setEditingQuestionId(q.id);
    setForm({
      templateId: q.templateId,
      question: q.question,
      instruction: q.instruction,
      keywordInput: "",
      expectedKeywords: [...q.expectedKeywords],
      exampleAnswer: q.exampleAnswer,
      feedback: q.feedback,
      confidenceThreshold: q.confidenceThreshold,
    });
    setQuestionModalOpen(true);
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && form.keywordInput.trim()) {
      e.preventDefault();
      const kw = form.keywordInput.trim().toLowerCase().replace(/,/g, "");
      setForm({
        ...form,
        expectedKeywords: kw && !form.expectedKeywords.includes(kw) ? [...form.expectedKeywords, kw] : form.expectedKeywords,
        keywordInput: "",
      });
    }
  };

  const removeKeyword = (kw: string) => {
    const newKeywords = form.expectedKeywords.filter((k) => k !== kw);
    setForm({
      ...form,
      expectedKeywords: newKeywords,
      confidenceThreshold: Math.min(form.confidenceThreshold, Math.max(newKeywords.length, 1)),
    });
  };

  const saveQuestion = async () => {
    const keywords = [...form.expectedKeywords];
    if (form.keywordInput.trim()) keywords.push(form.keywordInput.trim().toLowerCase());
    const payload = {
      templateId: form.templateId,
      question: form.question,
      instruction: form.instruction,
      expectedKeywords: keywords,
      exampleAnswer: form.exampleAnswer,
      feedback: form.feedback,
      confidenceThreshold: form.confidenceThreshold,
    };
    const response = editingQuestionId !== null
      ? await BaselineService.updateQuestion(editingQuestionId, payload)
      : await BaselineService.createQuestion(payload);
    if (response.ok && response.data.success) {
      toast.success(response.data.message || "Question saved.");
      setQuestionModalOpen(false);
      await loadTemplates();
    } else {
      toast.error(response.data.message || "Failed to save question.");
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const response = deleting.kind === "question"
      ? await BaselineService.deleteQuestion(deleting.id)
      : await BaselineService.deleteTemplate(deleting.id);
    if (response.ok && response.data.success) {
      toast.success(response.data.message);
      await loadTemplates();
    } else {
      toast.error(response.data.message || "Could not delete it.");
    }
    setDeleting(null);
  };

  const isSaveDisabled =
    !form.templateId ||
    form.question.trim().length < 10 ||
    !form.instruction.trim() ||
    !form.exampleAnswer.trim() ||
    !form.feedback.trim() ||
    form.expectedKeywords.length === 0 ||
    form.confidenceThreshold < 1 ||
    form.confidenceThreshold > form.expectedKeywords.length;

  const templateLabel = (t: BaselineTemplate) => `${t.role} · ${t.name}`;

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Baseline Assessments"
        description="Named baseline assessments for each role. Switch one on and every player of that role can take it, once"
        icon={ClipboardList}
        tone="bg-amber-500/15 text-amber-300"
        actions={(
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadBank} title="Add any template assessment or question that is not here yet">
              <Download className="w-4 h-4 mr-2" />
              Load template bank
            </Button>
            <Button onClick={openNewTemplate}>
              <Plus className="w-4 h-4 mr-2" />
              New baseline
            </Button>
          </div>
        )}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} hint={stat.hint} icon={stat.icon} tone={stat.tone} />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-foreground">Baseline assessments by role</CardTitle>
            <CardDescription>
              Each assessment holds {limits.min} to {limits.max} questions written for one role. Switch one on at any time:
              every player of that role who hasn't taken it sees it as new and can take it once. Their most recent result
              sets where their training starts. Results are kept when you switch an assessment off.
            </CardDescription>
            <FilterBar
              search={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search assessments, questions or keywords"
              filters={[
                { key: "role", label: "Roles", value: roleFilter, options: toOptions([...ROLES, ALL_ROLES]), onChange: setRoleFilter },
                {
                  key: "status",
                  label: "Any status",
                  value: statusFilter,
                  options: [{ value: "On", label: "Switched on" }, { value: "Off", label: "Switched off" }],
                  onChange: setStatusFilter,
                },
              ]}
              onClear={() => {
                setSearchQuery("");
                setRoleFilter("");
                setStatusFilter("");
              }}
              resultText={`${visible.length} assessment(s)`}
            />
          </CardHeader>
          <CardContent className="space-y-6">
            {sections.map(({ role, items }) => {
              const Icon = ROLE_ICONS[role] ?? Library;
              return (
                <section key={role} className="space-y-3">
                  <h3 className={`flex items-center gap-2 text-sm font-semibold uppercase tracking-wide ${ROLE_TEXT[role] ?? "text-muted-foreground"}`}>
                    <Icon className="w-4 h-4" />
                    {role}
                    <span className="font-normal normal-case tracking-normal text-muted-foreground">
                      · {items.length} baseline{items.length === 1 ? "" : "s"}, {items.filter((t) => t.isActive).length} on
                    </span>
                  </h3>
                  {items.map((t) => {
                    const isOpen = openIds.has(t.id) || Boolean(search);
                    const shown = t.questions.filter(matchesQuestion);
                    return (
                      <div key={t.id} className={`rounded-xl border ${isOpen ? "border-sky-500/40 bg-sky-500/5" : "border-border"}`}>
                        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                          <button
                            type="button"
                            onClick={() => toggleOpen(t.id)}
                            aria-expanded={isOpen}
                            className="flex flex-1 min-w-0 flex-wrap items-center gap-3 text-left"
                          >
                            {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                            <FolderOpen className="w-4 h-4 shrink-0 text-teal-300" />
                            <span className="font-semibold">{t.name}</span>
                            <span className="text-sm text-muted-foreground">
                              {t.questionCount} question{t.questionCount === 1 ? "" : "s"}
                              {` · taken ${t.timesTaken} time${t.timesTaken === 1 ? "" : "s"}`}
                              {t.averageScore !== null && ` · average ${t.averageScore}%`}
                            </span>
                            {!t.ready && (
                              <span className="flex items-center gap-1 text-xs text-amber-300">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                needs {limits.min}-{limits.max} questions to switch on
                              </span>
                            )}
                          </button>
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                            t.isActive ? "border-green-500/40 bg-green-500/15 text-green-300" : "border-border text-muted-foreground"
                          }`}>
                            {t.isActive ? "On for players" : "Off"}
                          </span>
                          <ActiveToggle active={t.isActive} label={templateLabel(t)} onToggle={() => toggleActive(t)} />
                          <RowAction title="Rename or describe" icon={Edit} hover="hover:bg-sky-400/15 hover:text-sky-400" onClick={() => openEditTemplate(t)} />
                          <RowAction
                            title={t.timesTaken ? "Taken by players: switch it off instead" : "Delete assessment"}
                            icon={Trash2}
                            hover="hover:bg-red-500/15 hover:text-red-400"
                            onClick={() => setDeleting({ kind: "template", id: t.id, label: templateLabel(t) })}
                          />
                        </div>

                        {isOpen && (
                          <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
                            {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                            {shown.length ? (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs w-12">#</TableHead>
                                    <TableHead className="text-xs">Question</TableHead>
                                    <TableHead className="text-xs">Expected keywords</TableHead>
                                    <TableHead className="text-xs text-center">Threshold</TableHead>
                                    <TableHead className="text-xs text-right">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {shown.map((q) => (
                                    <TableRow key={q.id} className="cursor-pointer hover:bg-sky-500/5" onClick={() => setViewing(q)}>
                                      <TableCell className="text-xs text-muted-foreground">{t.questions.indexOf(q) + 1}</TableCell>
                                      <TableCell className="max-w-md whitespace-normal">
                                        <p className="line-clamp-2 text-sm font-medium text-foreground">{q.question}</p>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex max-w-55 flex-wrap gap-1">
                                          {q.expectedKeywords.slice(0, 4).map((keyword) => (
                                            <span key={keyword} className="rounded bg-sky-400/15 px-1.5 py-0.5 text-xs text-sky-400">{keyword}</span>
                                          ))}
                                          {q.expectedKeywords.length > 4 && (
                                            <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-muted-foreground">
                                              +{q.expectedKeywords.length - 4}
                                            </span>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Badge className={`border-0 text-xs font-semibold ${thresholdTone(q.confidenceThreshold)}`}>
                                          {q.confidenceThreshold}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                                          <RowAction title="View" icon={Eye} hover="hover:text-blue-400" onClick={() => setViewing(q)} />
                                          <RowAction title="Edit" icon={Edit} hover="hover:bg-sky-400/15 hover:text-sky-400" onClick={() => openEditQuestion(q)} />
                                          <RowAction
                                            title="Delete"
                                            icon={Trash2}
                                            hover="hover:bg-red-500/15 hover:text-red-400"
                                            onClick={() => setDeleting({ kind: "question", id: q.id, label: q.question })}
                                          />
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                {t.questions.length ? "No questions match this search." : "No questions yet."}
                              </p>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openAddQuestion(t.id)}
                              disabled={t.questionCount >= limits.max}
                              title={t.questionCount >= limits.max ? `A baseline can have at most ${limits.max} questions` : undefined}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Add question ({t.questionCount}/{limits.max})
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </section>
              );
            })}

            {!sections.length && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ClipboardList className="w-8 h-8 mb-3 text-sky-400" />
                <p className="font-semibold mb-1 text-foreground">
                  {isFiltered ? "No matching baseline assessments" : "No baseline assessments yet"}
                </p>
                <p className="text-sm mb-4 text-muted-foreground">
                  {isFiltered ? "Try a different search or filter." : "Load the template bank, or create your first baseline."}
                </p>
                {!isFiltered && (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={loadBank}><Download className="w-4 h-4 mr-2" />Load template bank</Button>
                    <Button onClick={openNewTemplate}><Plus className="w-4 h-4 mr-2" />New baseline</Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New or edit baseline assessment */}
      <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplateId !== null ? "Edit baseline assessment" : "New baseline assessment"}</DialogTitle>
            <DialogDescription>
              {editingTemplateId !== null
                ? "Rename it or change its description. The role can only change before anyone has taken it."
                : `It starts switched off. Add ${limits.min}-${limits.max} questions, then switch it on for the role.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="template-role">Role</Label>
              <select
                id="template-role"
                value={templateForm.occupation}
                onChange={(e) => setTemplateForm({ ...templateForm, occupation: e.target.value })}
                className="h-9 w-full rounded-md border px-3 text-sm bg-input-background"
              >
                {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                <option value="">All roles</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                value={templateForm.name}
                placeholder={editingTemplateId !== null ? "" : "Leave empty for the next number, e.g. Baseline assessment 3"}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-description">Description</Label>
              <Textarea
                id="template-description"
                rows={2}
                className="resize-none text-sm"
                value={templateForm.description}
                placeholder="What it covers, e.g. NSFAS, social media and university IT"
                onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-2 border-t border-border">
              <Button variant="outline" className="flex-1" onClick={() => setTemplateModalOpen(false)}>Cancel</Button>
              <Button
                className="flex-1"
                onClick={saveTemplate}
                disabled={editingTemplateId !== null && !templateForm.name.trim()}
              >
                {editingTemplateId !== null ? "Save changes" : "Create baseline"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add or edit question */}
      <Dialog open={questionModalOpen} onOpenChange={setQuestionModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuestionId !== null ? "Edit question" : "Add question"}</DialogTitle>
            <DialogDescription>An open-text question, marked by counting the expected keywords in the answer.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium" htmlFor="question-template">Baseline assessment</Label>
              <select
                id="question-template"
                value={form.templateId ?? ""}
                onChange={(e) => setForm({ ...form, templateId: Number(e.target.value) || null })}
                className="h-9 w-full rounded-md border px-3 text-sm bg-input-background"
              >
                {[...ROLES, ALL_ROLES].map((role) => {
                  const options = templates.filter((t) => t.role === role);
                  return options.length ? (
                    <optgroup key={role} label={role}>
                      {options.map((t) => (
                        <option key={t.id} value={t.id}>{templateLabel(t)} ({t.questionCount} questions)</option>
                      ))}
                    </optgroup>
                  ) : null;
                })}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Question text <span className="text-red-400">*</span></Label>
              <Textarea
                placeholder="e.g. You get an SMS from 'NSFAS' asking you to confirm your banking details. What do you do?"
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                className="resize-none text-sm"
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Instruction <span className="text-red-400">*</span></Label>
              <Input
                placeholder="e.g. Name the warning signs and the safe action."
                value={form.instruction}
                onChange={(e) => setForm({ ...form, instruction: e.target.value })}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Expected keywords <span className="text-red-400">*</span></Label>
              <p className="text-xs text-muted-foreground">Press Enter or comma to add a keyword. Answers are marked against these.</p>
              <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-border bg-muted min-h-11">
                {form.expectedKeywords.map((kw) => (
                  <span key={kw} className="inline-flex items-center gap-1 rounded bg-sky-400/15 px-2 py-0.5 text-xs font-medium text-sky-400">
                    {kw}
                    <button type="button" onClick={() => removeKeyword(kw)} className="hover:opacity-60" aria-label={`Remove ${kw}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  className="flex-1 min-w-30 bg-transparent text-sm outline-none text-foreground"
                  placeholder={form.expectedKeywords.length === 0 ? "Type keyword and press Enter..." : "Add more..."}
                  value={form.keywordInput}
                  onChange={(e) => setForm({ ...form, keywordInput: e.target.value })}
                  onKeyDown={handleKeywordKeyDown}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Example answer <span className="text-red-400">*</span></Label>
              <Textarea
                placeholder="A model answer that uses every expected keyword..."
                value={form.exampleAnswer}
                onChange={(e) => setForm({ ...form, exampleAnswer: e.target.value })}
                className="resize-none text-sm"
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Feedback <span className="text-red-400">*</span></Label>
              <Textarea
                placeholder="Shown to players with their result..."
                value={form.feedback}
                onChange={(e) => setForm({ ...form, feedback: e.target.value })}
                className="resize-none text-sm"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Confidence threshold <span className="text-red-400">*</span></Label>
              <p className="text-xs text-muted-foreground">An answer passes when it contains at least this many expected keywords.</p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={1}
                  max={Math.max(form.expectedKeywords.length, 1)}
                  value={form.confidenceThreshold}
                  onChange={(e) => setForm({ ...form, confidenceThreshold: Number(e.target.value) })}
                  className="flex-1 accent-[#2f81f7]"
                />
                <div className="w-14 h-10 rounded-lg flex items-center justify-center text-lg font-bold bg-blue-500/15 text-blue-400">
                  {form.confidenceThreshold} / {Math.max(form.expectedKeywords.length, 1)}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setQuestionModalOpen(false)} className="flex-1">Cancel</Button>
              <Button onClick={saveQuestion} disabled={isSaveDisabled} className="flex-1">
                {editingQuestionId !== null ? "Save changes" : "Add question"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View question */}
      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Question details</DialogTitle>
            <DialogDescription>
              {(() => {
                const t = templates.find((item) => item.id === viewing?.templateId);
                return t ? templateLabel(t) : "Baseline question";
              })()}
            </DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-xl bg-muted">
                <p className="text-sm font-medium text-foreground">{viewing.question}</p>
                {viewing.instruction && <p className="text-xs mt-2 text-muted-foreground">{viewing.instruction}</p>}
              </div>
              <div>
                <p className="text-xs font-semibold mb-2 text-muted-foreground">EXPECTED KEYWORDS ({viewing.expectedKeywords.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {viewing.expectedKeywords.map((kw) => (
                    <span key={kw} className="px-2 py-0.5 rounded text-xs font-medium bg-sky-400/15 text-sky-400">{kw}</span>
                  ))}
                </div>
              </div>
              {viewing.exampleAnswer && (
                <div>
                  <p className="text-xs font-semibold mb-2 text-muted-foreground">EXAMPLE ANSWER</p>
                  <p className="text-sm p-3 rounded-lg bg-muted border border-border">{viewing.exampleAnswer}</p>
                </div>
              )}
              {viewing.feedback && (
                <div>
                  <p className="text-xs font-semibold mb-2 text-muted-foreground">FEEDBACK</p>
                  <p className="text-sm p-3 rounded-lg border border-sky-500/20 bg-sky-500/5">{viewing.feedback}</p>
                </div>
              )}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <span className="text-sm font-medium text-foreground">Confidence threshold</span>
                <Badge className={`border-0 text-sm font-bold px-3 ${thresholdTone(viewing.confidenceThreshold)}`}>
                  {viewing.confidenceThreshold} keywords
                </Badge>
              </div>
              <div className="flex gap-3 pt-2 border-t border-border">
                <Button variant="outline" onClick={() => setViewing(null)} className="flex-1">Close</Button>
                <Button
                  onClick={() => {
                    const q = viewing;
                    setViewing(null);
                    openEditQuestion(q);
                  }}
                  className="flex-1"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit question
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{deleting?.kind === "template" ? "Delete baseline assessment" : "Delete question"}</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 p-4 rounded-xl my-2 border border-red-500/25 bg-red-500/10">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <p className="text-sm text-red-300">
              {deleting?.kind === "template"
                ? `${deleting.label} and all its questions will be removed. Assessments players have taken are kept as a record and cannot be deleted.`
                : "The question is removed from its baseline assessment."}
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setDeleting(null)} className="flex-1">Cancel</Button>
            <Button onClick={confirmDelete} className="flex-1 text-white bg-red-600 hover:bg-red-700">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Colour for a keyword threshold: higher means stricter marking. */
function thresholdTone(threshold: number) {
  if (threshold >= 4) return "bg-red-500/15 text-red-400";
  if (threshold === 3) return "bg-amber-400/15 text-amber-300";
  return "bg-green-500/15 text-green-400";
}

/** On/off switch for whether players of the role are offered an assessment. */
function ActiveToggle({ active, label, onToggle }: { active: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={`${label}: ${active ? "on" : "off"}`}
      title={active ? "On: click to switch off" : "Off: click to switch on for this role"}
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${active ? "bg-sky-500" : "bg-white/15"}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${active ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

/** A small icon button in a row. */
function RowAction({ title, icon: Icon, hover, onClick }: {
  title: string;
  icon: LucideIcon;
  hover: string;
  onClick: () => void;
}) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick}
      className={`rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/5 ${hover}`}>
      <Icon className="w-4 h-4" />
    </button>
  );
}
