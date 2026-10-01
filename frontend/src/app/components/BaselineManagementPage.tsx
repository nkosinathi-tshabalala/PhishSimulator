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
  Gauge,
  KeyRound,
  Tags,
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
  lastUpdated: string;
}

interface FormState {
  question: string;
  instruction: string;
  keywordInput: string;
  expectedKeywords: string[];
  exampleAnswer: string;
  feedback: string;
  confidenceThreshold: number;
}

const emptyForm: FormState = {
  question: "",
  instruction: "",
  keywordInput: "",
  expectedKeywords: [],
  exampleAnswer: "",
  feedback: "",
  confidenceThreshold: 2,
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
  const [thresholdFilter, setThresholdFilter] = useState("");
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
    && (!thresholdFilter || String(q.confidenceThreshold) === thresholdFilter),
  );
  const table = useSort(filtered, {
    id: (q) => q.id,
    question: (q) => q.question,
    keywords: (q) => q.expectedKeywords.length,
    threshold: (q) => q.confidenceThreshold,
  }, { key: "id", direction: "asc" });
  const isFiltered = Boolean(searchQuery || thresholdFilter);

  const totalKeywords = questions.reduce((total, q) => total + q.expectedKeywords.length, 0);
  const totalThreshold = questions.reduce((total, q) => total + q.confidenceThreshold, 0);
  const average = (total: number) => (questions.length ? total / questions.length : 0);
  const stats: Array<{ label: string; value: string; icon: LucideIcon; tone: StatTone }> = [
    { label: "Total Questions", value: String(questions.length), icon: ClipboardList, tone: "amber" },
    { label: "Avg. Keywords", value: String(Math.round(average(totalKeywords))), icon: KeyRound, tone: "sky" },
    { label: "Avg. Threshold", value: average(totalThreshold).toFixed(1), icon: Gauge, tone: "violet" },
    { label: "Total Keywords", value: String(totalKeywords), icon: Tags, tone: "green" },
  ];

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
        description="Create and manage the questions players answer before phishing training"
        icon={ClipboardList}
        tone="bg-amber-500/15 text-amber-300"
        actions={(
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add Question
          </Button>
        )}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} tone={stat.tone} />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-foreground">Assessment Questions</CardTitle>
            <CardDescription>Questions are presented to players in order during the baseline assessment.</CardDescription>
            <FilterBar
              search={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search questions or keywords"
              filters={[{
                key: "threshold",
                label: "Thresholds",
                value: thresholdFilter,
                options: toOptions([...new Set(questions.map((q) => String(q.confidenceThreshold)))].sort()),
                onChange: setThresholdFilter,
              }]}
              onClear={() => {
                setSearchQuery("");
                setThresholdFilter("");
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
                    <TableHead className="text-xs"><SortButton label="Question Preview" column="question" sort={table.sort} onSort={table.toggle} /></TableHead>
                    <TableHead className="text-xs"><SortButton label="Expected Keywords" column="keywords" sort={table.sort} onSort={table.toggle} /></TableHead>
                    <TableHead className="text-xs text-center"><SortButton label="Threshold" column="threshold" sort={table.sort} onSort={table.toggle} /></TableHead>
                    <TableHead
                      className="text-xs font-medium text-right pr-6"
                    >
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {table.sorted.map((q) => (
                    <TableRow key={q.id} className="cursor-pointer hover:bg-sky-500/5" onClick={() => openView(q)}>
                      <TableCell className="pl-6">
                        <span className="rounded bg-blue-500/15 px-2 py-1 font-mono text-xs font-semibold text-blue-400">
                          Q{String(q.id).padStart(2, "0")}
                        </span>
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
