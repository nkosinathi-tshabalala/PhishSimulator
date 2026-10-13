// Admin page: manage baseline quiz questions

import BaselineService from "../../services/baselineService";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  Plus,
  Edit,
  Trash2,
  Eye,
  X,
  ClipboardList,
  AlertTriangle,
  GraduationCap,
  Briefcase,
  Users,
  Library,
  Download,
  type LucideIcon,
} from "lucide-react";
import { StatCard, type StatTone } from "./StatCard";
import { PageHeader } from "./PageHeader";
import { FilterBar, toOptions } from "./FilterBar";
import { SortButton, useSort } from "./sorting";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface BaselineQuestion {
  id: number;
  question: string;
  instruction: string;
  expectedKeywords: string[];
  exampleAnswer: string;
  feedback: string;
  confidenceThreshold: number;
  /** The role the question is written for, or null for a general question any role can get. */
  occupation: string | null;
  /** Only active questions are given to players. */
  isActive: boolean;
}

interface FormState {
  question: string;
  instruction: string;
  keywordInput: string;
  expectedKeywords: string[];
  exampleAnswer: string;
  feedback: string;
  confidenceThreshold: number;
  occupation: string;
  isActive: boolean;
}

/** Each player answers this many active questions written for their role. */
const QUESTIONS_PER_ASSESSMENT = 5;
const ROLES = ["Student", "Employee", "Other"] as const;
const GENERAL = "General";
const ROLE_ICONS: Record<string, LucideIcon> = { Student: GraduationCap, Employee: Briefcase, Other: Users };
const ROLE_TONES: Record<string, StatTone> = { Student: "sky", Employee: "violet", Other: "amber" };

const roleOf = (q: BaselineQuestion) => q.occupation ?? GENERAL;

const emptyForm: FormState = {
  question: "",
  instruction: "",
  keywordInput: "",
  expectedKeywords: [],
  exampleAnswer: "",
  feedback: "",
  confidenceThreshold: 2,
  occupation: "Student",
  isActive: true,
};

/** Admin page to add, edit and delete baseline quiz questions. */
export function BaselineManagementPage() {
  const [questions, setQuestions] = useState<BaselineQuestion[]>([]);

  const loadQuestions = async () => {
    try {
      const response = await BaselineService.getQuestions();

      if (response.ok && response.data.success) {
        setQuestions(response.data.data);
      } else {
        console.error(response.data.message);
      }
    } catch (error) {
      console.error("Failed to load questions:", error);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingQuestion, setViewingQuestion] =
    useState<BaselineQuestion | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const search = searchQuery.toLowerCase();
  const filtered = questions.filter((q) =>
    (q.question.toLowerCase().includes(search)
      || q.expectedKeywords.some((keyword) => keyword.toLowerCase().includes(search)))
    && (!roleFilter || roleOf(q) === roleFilter)
    && (!statusFilter || (statusFilter === "On") === q.isActive),
  );
  const table = useSort(filtered, {
    id: (q) => q.id,
    role: (q) => [...ROLES, GENERAL].indexOf(roleOf(q)),
    question: (q) => q.question,
    keywords: (q) => q.expectedKeywords.length,
    threshold: (q) => q.confidenceThreshold,
    active: (q) => Number(q.isActive),
  }, { key: "role", direction: "asc" });
  const isFiltered = Boolean(searchQuery || roleFilter || statusFilter);

  // How many questions are switched on for each role: players get QUESTIONS_PER_ASSESSMENT of them
  const activeFor = (role: string) => questions.filter((q) => q.isActive && q.occupation === role).length;
  const activeGeneral = questions.filter((q) => q.isActive && !q.occupation).length;
  const stats: Array<{ label: string; value: string; icon: LucideIcon; tone: StatTone; hint: string }> = [
    ...ROLES.map((role) => {
      const active = activeFor(role);
      const short = Math.max(QUESTIONS_PER_ASSESSMENT - active - activeGeneral, 0);
      return {
        label: `${role} questions on`,
        value: `${active}`,
        icon: ROLE_ICONS[role],
        tone: ROLE_TONES[role],
        hint: short
          ? `${short} short of ${QUESTIONS_PER_ASSESSMENT}: switch more on`
          : active > QUESTIONS_PER_ASSESSMENT
            ? `Players get a random ${QUESTIONS_PER_ASSESSMENT}`
            : `Players get these ${Math.min(active + activeGeneral, QUESTIONS_PER_ASSESSMENT)}`,
      };
    }),
    {
      label: "Questions in the bank",
      value: String(questions.length),
      icon: Library,
      tone: "green",
      hint: `${questions.filter((q) => q.isActive).length} switched on`,
    },
  ];

  const toggleActive = async (q: BaselineQuestion) => {
    const response = await BaselineService.setActive(q.id, !q.isActive);
    if (response.ok && response.data.success) {
      setQuestions((current) => current.map((item) => (item.id === q.id ? response.data.data : item)));
    } else {
      toast.error(response.data.message || "Could not change the question.");
    }
  };

  const loadTemplates = async () => {
    const response = await BaselineService.loadTemplates();
    if (response.ok && response.data.success) {
      toast.success(response.data.message);
      await loadQuestions();
    } else {
      toast.error(response.data.message || "Could not load the templates.");
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (q: BaselineQuestion) => {
    setEditingId(q.id);
    setForm({
      question: q.question,
      instruction: q.instruction,
      keywordInput: "",
      expectedKeywords: [...q.expectedKeywords],
      exampleAnswer: q.exampleAnswer,
      feedback: q.feedback,
      confidenceThreshold: q.confidenceThreshold,
      occupation: q.occupation ?? "",
      isActive: q.isActive,
    });
    setModalOpen(true);
  };

  const openView = (q: BaselineQuestion) => {
    setViewingQuestion(q);
    setViewModalOpen(true);
  };

  const openDelete = (id: number) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && form.keywordInput.trim()) {
      e.preventDefault();
      const kw = form.keywordInput.trim().toLowerCase().replace(/,/g, "");
      if (kw && !form.expectedKeywords.includes(kw)) {
        setForm({
          ...form,
          expectedKeywords: [...form.expectedKeywords, kw],
          keywordInput: "",
        });
      } else {
        setForm({ ...form, keywordInput: "" });
      }
    }
  };

  const removeKeyword = (kw: string) => {
    const newKeywords = form.expectedKeywords.filter((k) => k !== kw);

    setForm({
      ...form,

      expectedKeywords: newKeywords,

      confidenceThreshold: Math.min(
        form.confidenceThreshold,
        Math.max(newKeywords.length, 1),
      ),
    });
  };

  const handleSave = async () => {
    try {
      let keywords = [...form.expectedKeywords];

      if (form.keywordInput.trim()) {
        keywords.push(form.keywordInput.trim().toLowerCase());
      }

      const payload = {
        question: form.question,
        instruction: form.instruction,
        expectedKeywords: keywords,
        exampleAnswer: form.exampleAnswer,
        feedback: form.feedback,
        confidenceThreshold: form.confidenceThreshold,
        occupation: form.occupation || null,
        isActive: form.isActive,
      };

      let response;

      if (editingId !== null) {
        response = await BaselineService.updateQuestion(editingId, payload);
      } else {
        response = await BaselineService.createQuestion(payload);
      }

      if (response.ok && response.data.success) {
        toast.success(response.data.message || "Question saved.");
        await loadQuestions();
        setModalOpen(false);
        setEditingId(null);
        setForm(emptyForm);
      } else {
        toast.error(response.data.message || "Failed to save question.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to save question.");
    }
  };

  const handleDelete = async () => {
    if (deletingId === null) return;

    try {
      const response = await BaselineService.deleteQuestion(deletingId);

      if (response.ok && response.data.success) {
        toast.success(response.data.message || "Question deleted.");
        await loadQuestions();
      } else {
        toast.error(response.data.message || "Failed to delete question.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete question.");
    } finally {
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  const isSaveDisabled =
    form.question.trim().length < 10 ||
    form.expectedKeywords.length === 0 ||
    form.confidenceThreshold < 1 ||
    form.confidenceThreshold > form.expectedKeywords.length;

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Baseline Assessment Management"
        description="A question bank for each role. Switch questions on or off; each player answers 5 written for their role"
        icon={ClipboardList}
        tone="bg-amber-500/15 text-amber-300"
        actions={(
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadTemplates} title="Add any template question that is not in the bank yet">
              <Download className="w-4 h-4 mr-2" />
              Load templates
            </Button>
            <Button onClick={openAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Add Question
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
            <CardTitle className="text-base text-foreground">Assessment Questions</CardTitle>
            <CardDescription>
              A player gets {QUESTIONS_PER_ASSESSMENT} switched-on questions for their role, in a random order. If their role has
              fewer, switched-on general questions fill the gap. Switched-off questions stay in the bank as templates.
            </CardDescription>
            <FilterBar
              search={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search questions or keywords"
              filters={[
                {
                  key: "role",
                  label: "Roles",
                  value: roleFilter,
                  options: toOptions([...ROLES, GENERAL]),
                  onChange: setRoleFilter,
                },
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
              resultText={`${filtered.length} question(s)`}
            />
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                  style={{ backgroundColor: "rgba(47,129,247,0.12)" }}
                >
                  <ClipboardList
                    className="w-7 h-7"
                    style={{ color: "#2f81f7" }}
                  />
                </div>
                <p className="font-semibold mb-1 text-foreground">
                  {isFiltered
                    ? "No matching questions found"
                    : "No baseline questions available"}
                </p>
                <p className="text-sm mb-6 text-muted-foreground">
                  {isFiltered
                    ? "Try a different search or filter."
                    : "Get started by creating your first question."}
                </p>
                {!isFiltered && (
                  <Button onClick={openAdd}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Question
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs pl-6"><SortButton label="ID" column="id" sort={table.sort} onSort={table.toggle} /></TableHead>
                    <TableHead className="text-xs"><SortButton label="Role" column="role" sort={table.sort} onSort={table.toggle} /></TableHead>
                    <TableHead className="text-xs"><SortButton label="Question Preview" column="question" sort={table.sort} onSort={table.toggle} /></TableHead>
                    <TableHead className="text-xs"><SortButton label="Expected Keywords" column="keywords" sort={table.sort} onSort={table.toggle} /></TableHead>
                    <TableHead className="text-xs text-center"><SortButton label="Threshold" column="threshold" sort={table.sort} onSort={table.toggle} /></TableHead>
                    <TableHead className="text-xs text-center"><SortButton label="For players" column="active" sort={table.sort} onSort={table.toggle} /></TableHead>
                    <TableHead
                      className="text-xs font-medium text-right pr-6"
                    >
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {table.sorted.map((q) => (
                    <TableRow key={q.id} className={`cursor-pointer hover:bg-sky-500/5 ${q.isActive ? "" : "opacity-60"}`} onClick={() => openView(q)}>
                      <TableCell className="pl-6">
                        <span className="rounded bg-blue-500/15 px-2 py-1 font-mono text-xs font-semibold text-blue-400">
                          Q{String(q.id).padStart(2, "0")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={roleOf(q)} />
                      </TableCell>
                      <TableCell className="max-w-xs whitespace-normal">
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
                      <TableCell className="text-center" onClick={(event) => event.stopPropagation()}>
                        <ActiveToggle active={q.isActive} onToggle={() => toggleActive(q)} />
                      </TableCell>
                      <TableCell className="pr-6">
                        {/* stopPropagation: the buttons do their own thing instead of opening the row */}
                        <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                          <RowAction title="View" icon={Eye} hover="hover:text-blue-400" onClick={() => openView(q)} />
                          <RowAction title="Edit" icon={Edit} hover="hover:bg-sky-400/15 hover:text-sky-400" onClick={() => openEdit(q)} />
                          <RowAction title="Delete" icon={Trash2} hover="hover:bg-red-500/15 hover:text-red-400" onClick={() => openDelete(q.id)} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId !== null ? "Edit Question" : "Add Question"}
            </DialogTitle>
            <DialogDescription>
              {editingId !== null
                ? "Update the details of this baseline assessment question."
                : "Create a new open-text question for the baseline assessment."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Question Text <span style={{ color: "#f85149" }}>*</span>
              </Label>
              <Textarea
                placeholder="e.g. How would you identify a phishing email? Describe at least three warning signs."
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                className="resize-none text-sm"
                rows={3}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium" htmlFor="question-role">Role</Label>
                <select
                  id="question-role"
                  value={form.occupation}
                  onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                  className="h-9 w-full rounded-md border px-3 text-sm bg-input-background"
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                  <option value="">General (any role, fills gaps)</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium sm:pt-6 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-sky-500"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                Switched on for players
              </label>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Instruction
              </Label>
              <Input
                placeholder="e.g. Write your answer in your own words."
                value={form.instruction}
                onChange={(e) =>
                  setForm({ ...form, instruction: e.target.value })
                }
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Expected Keywords <span style={{ color: "#f85149" }}>*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Press Enter or comma to add a keyword. Player answers are
                evaluated against these.
              </p>
              <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-border bg-muted min-h-11">
                {form.expectedKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                    style={{
                      backgroundColor: "rgba(56,189,248,0.12)",
                      color: "#38bdf8",
                    }}
                  >
                    {kw}
                    <button
                      onClick={() => removeKeyword(kw)}
                      className="hover:opacity-60"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  className="flex-1 min-w-30 bg-transparent text-sm outline-none text-foreground"
                  placeholder={
                    form.expectedKeywords.length === 0
                      ? "Type keyword and press Enter..."
                      : "Add more..."
                  }
                  value={form.keywordInput}
                  onChange={(e) =>
                    setForm({ ...form, keywordInput: e.target.value })
                  }
                  onKeyDown={handleKeywordKeyDown}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Example Answer
              </Label>
              <Textarea
                placeholder="An ideal example answer that would achieve a high score..."
                value={form.exampleAnswer}
                onChange={(e) =>
                  setForm({ ...form, exampleAnswer: e.target.value })
                }
                className="resize-none text-sm"
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Feedback
              </Label>
              <Textarea
                placeholder="Feedback shown to players after the assessment is complete..."
                value={form.feedback}
                onChange={(e) => setForm({ ...form, feedback: e.target.value })}
                className="resize-none text-sm"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Confidence Threshold <span style={{ color: "#f85149" }}>*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                The player must match at least this many expected keywords for the answer to be considered correct.
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={1}
                  max={Math.max(form.expectedKeywords.length, 1)}
                  value={form.confidenceThreshold}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      confidenceThreshold: Number(e.target.value),
                    })
                  }
                  className="flex-1 accent-[#2f81f7]"
                />
                <div
                  className="w-12 h-10 rounded-lg flex items-center justify-center text-lg font-bold"
                  style={{
                    backgroundColor: "rgba(47,129,247,0.12)",
                    color: "#2f81f7",
                  }}
                >
                  {form.confidenceThreshold} / {Math.max(form.expectedKeywords.length, 1)}
                </div>
              </div>

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Minimum Match</span>

                <span>
                  Maximum ({Math.max(form.expectedKeywords.length, 1)})
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaveDisabled}
                className="flex-1"
              >
                {editingId !== null ? "Save Changes" : "Add Question"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewingQuestion &&
                `Q${String(viewingQuestion.id).padStart(2, "0")} — Question Details`}
            </DialogTitle>
            <DialogDescription>
              Read-only view of this baseline assessment question.
            </DialogDescription>
          </DialogHeader>

          {viewingQuestion && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2">
                <RoleBadge role={roleOf(viewingQuestion)} />
                <span className={`text-xs ${viewingQuestion.isActive ? "text-green-300" : "text-muted-foreground"}`}>
                  {viewingQuestion.isActive ? "Switched on for players" : "Switched off (template only)"}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-muted">
                <p className="text-sm font-medium text-foreground">
                  {viewingQuestion.question}
                </p>
                {viewingQuestion.instruction && (
                  <p className="text-xs mt-2 text-muted-foreground">
                    {viewingQuestion.instruction}
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold mb-2 text-muted-foreground">
                  EXPECTED KEYWORDS ({viewingQuestion.expectedKeywords.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {viewingQuestion.expectedKeywords.map((kw) => (
                    <span
                      key={kw}
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: "rgba(56,189,248,0.12)",
                        color: "#38bdf8",
                      }}
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              {viewingQuestion.exampleAnswer && (
                <div>
                  <p className="text-xs font-semibold mb-2 text-muted-foreground">
                    EXAMPLE ANSWER
                  </p>
                  <p
                    className="text-sm p-3 rounded-lg bg-muted border border-border"
                    style={{ color: "#c9d1d9" }}
                  >
                    {viewingQuestion.exampleAnswer}
                  </p>
                </div>
              )}

              {viewingQuestion.feedback && (
                <div>
                  <p className="text-xs font-semibold mb-2 text-muted-foreground">
                    FEEDBACK
                  </p>
                  <p
                    className="text-sm p-3 rounded-lg"
                    style={{
                      backgroundColor: "rgba(56,189,248,0.06)",
                      color: "#c9d1d9",
                      border: "1px solid rgba(56,189,248,0.2)",
                    }}
                  >
                    {viewingQuestion.feedback}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <span className="text-sm font-medium text-foreground">
                  Confidence Threshold
                </span>
                <Badge
                  className="text-sm font-bold px-3 border-0"
                  style={{
                    backgroundColor:
                      viewingQuestion.confidenceThreshold >= 4
                        ? "rgba(248,81,73,0.12)"
                        : viewingQuestion.confidenceThreshold === 3
                          ? "rgba(242,204,96,0.12)"
                          : "rgba(63,185,80,0.12)",
                    color:
                      viewingQuestion.confidenceThreshold >= 4
                        ? "#f85149"
                        : viewingQuestion.confidenceThreshold === 3
                          ? "#f2cc60"
                          : "#3fb950",
                  }}
                >
                  {viewingQuestion.confidenceThreshold} keywords
                </Badge>
              </div>

              <div className="flex gap-3 pt-2 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => setViewModalOpen(false)}
                  className="flex-1"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setViewModalOpen(false);
                    openEdit(viewingQuestion);
                  }}
                  className="flex-1"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Question
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Delete Question
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. The question will be permanently
              removed from the baseline assessment.
            </DialogDescription>
          </DialogHeader>
          <div
            className="flex items-start gap-3 p-4 rounded-xl my-2"
            style={{
              backgroundColor: "rgba(248,81,73,0.08)",
              border: "1px solid rgba(248,81,73,0.25)",
            }}
          >
            <AlertTriangle
              className="w-4 h-4 shrink-0 mt-0.5"
              style={{ color: "#f85149" }}
            />
            <p className="text-sm" style={{ color: "#f85149" }}>
              Players who have not yet completed the assessment will no longer
              see this question.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              className="flex-1 text-white"
              style={{ backgroundColor: "#f85149" }}
            >
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

/** The role a question is written for. */
function RoleBadge({ role }: { role: string }) {
  const Icon = ROLE_ICONS[role] ?? Library;
  const tone: Record<string, string> = {
    Student: "bg-sky-400/15 text-sky-300",
    Employee: "bg-violet-400/15 text-violet-300",
    Other: "bg-amber-400/15 text-amber-300",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${tone[role] ?? "bg-white/10 text-muted-foreground"}`}>
      <Icon className="w-3 h-3" />
      {role}
    </span>
  );
}

/** On/off switch for whether players are given a question. */
function ActiveToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      title={active ? "Switched on: click to switch off" : "Switched off: click to switch on"}
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        active ? "bg-sky-500" : "bg-white/15"
      }`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${active ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

/** A small icon button in a table row. */
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
