import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, Edit, Play, Plus, Trash2 } from "lucide-react";
import ScenarioService from "../../services/scenarioService";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Textarea } from "./ui/textarea";

interface ScenarioManagementPageProps {
  onBack: () => void;
}

interface ScenarioSummary {
  scenario_id: number;
  title: string;
  simulation_type: "EMAIL" | "SMS";
  category: string;
  difficulty: "Easy" | "Medium" | "Hard";
  status: "ACTIVE" | "INACTIVE";
  uses: number;
}

interface ScenarioForm {
  title: string;
  simulation_type: "EMAIL" | "SMS";
  category: string;
  difficulty: "Easy" | "Medium" | "Hard";
  sender: string;
  subject: string;
  message: string;
  correct_answer: "REPORT" | "SAFE";
  feedback: string;
  phishing_cues: string;
  status: "ACTIVE" | "INACTIVE";
}

const emptyForm: ScenarioForm = {
  title: "",
  simulation_type: "EMAIL",
  category: "Password Reset",
  difficulty: "Medium",
  sender: "",
  subject: "",
  message: "",
  correct_answer: "REPORT",
  feedback: "",
  phishing_cues: "",
  status: "ACTIVE",
};

const categories = ["Banking", "Delivery", "Government", "Employment", "University", "Password Reset", "Microsoft 365", "Social Media"];

export function ScenarioManagementPage({ onBack }: ScenarioManagementPageProps) {
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [scenarioStats, setScenarioStats] = useState({ total: 0, active: 0, email: 0, sms: 0 });
  const [categoriesSummary, setCategoriesSummary] = useState<Array<{ name: string; count: number }>>([]);
  const [form, setForm] = useState<ScenarioForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, per_page: 25, pages: 0, total: 0 });

  const loadScenarios = async (requestedPage = page) => {
    const response = await ScenarioService.getScenarios(requestedPage);
    if (response.ok && response.data.success) {
      setScenarios(response.data.data.scenarios);
      setScenarioStats(response.data.data.stats);
      setCategoriesSummary(response.data.data.categories);
      setPagination(response.data.data.pagination);
    } else {
      setMessage(response.data.message || "Unable to load scenarios.");
    }
  };

  useEffect(() => {
    loadScenarios(page);
  }, [page]);

  const setField = <Field extends keyof ScenarioForm>(field: Field, value: ScenarioForm[Field]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setMessage("");
    setFormOpen(true);
  };

  const openEdit = async (scenarioId: number) => {
    const response = await ScenarioService.getScenario(scenarioId);
    if (!response.ok || !response.data.success) {
      setMessage(response.data.message || "Unable to load scenario details.");
      return;
    }
    const scenario = response.data.data;
    setForm({ ...scenario, phishing_cues: scenario.phishing_cues.join(", ") });
    setEditingId(scenarioId);
    setMessage("");
    setFormOpen(true);
  };

  const saveScenario = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    const payload = {
      ...form,
      phishing_cues: form.phishing_cues.split(",").map((cue) => cue.trim()).filter(Boolean),
    };
    const response = editingId
      ? await ScenarioService.updateScenario(editingId, payload)
      : await ScenarioService.createScenario(payload);
    setSubmitting(false);

    if (!response.ok || !response.data.success) {
      setMessage(response.data.message || "Unable to save scenario.");
      return;
    }
    setFormOpen(false);
    setPage(1);
    await loadScenarios(1);
  };

  const previewScenario = async (scenarioId: number) => {
    const response = await ScenarioService.getScenario(scenarioId);
    if (response.ok && response.data.success) setPreview(response.data.data);
    else setMessage(response.data.message || "Unable to load scenario preview.");
  };

  const deleteScenario = async (scenario: ScenarioSummary) => {
    if (!window.confirm(`Delete "${scenario.title}"?`)) return;
    const response = await ScenarioService.deleteScenario(scenario.scenario_id);
    if (response.ok && response.data.success) await loadScenarios(page);
    else setMessage(response.data.message || "Unable to delete scenario.");
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b p-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} title="Back"><ArrowLeft className="w-5 h-5" /></Button>
        <h2 className="text-xl font-semibold">Scenario Management</h2>
        <Button className="ml-auto" onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Create Scenario</Button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {message && <p className="text-sm text-destructive">{message}</p>}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[["Total Scenarios", scenarioStats.total], ["Active Scenarios", scenarioStats.active], ["Email Scenarios", scenarioStats.email], ["SMS Scenarios", scenarioStats.sms]].map(([label, value]) => <Card key={label as string}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{value}</div></CardContent></Card>)}
        </div>
        <Card><CardHeader><CardTitle>Scenario Categories</CardTitle><CardDescription>Distribution of scenarios by category</CardDescription></CardHeader><CardContent><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{categoriesSummary.map((category) => <div key={category.name} className="border rounded-lg p-4 text-center"><div className="text-2xl font-bold mb-1">{category.count}</div><div className="text-sm text-muted-foreground">{category.name}</div></div>)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle>All Scenarios</CardTitle><CardDescription>Each labelled uploaded record is an active player simulation and appears here as a scenario row.</CardDescription></CardHeader><CardContent className="space-y-4"><Table><TableHeader><TableRow><TableHead>Scenario Title</TableHead><TableHead>Category</TableHead><TableHead>Type</TableHead><TableHead>Difficulty</TableHead><TableHead>Status</TableHead><TableHead>Uses</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{scenarios.map((scenario) => <TableRow key={scenario.scenario_id}><TableCell className="font-medium">{scenario.title}</TableCell><TableCell>{scenario.category}</TableCell><TableCell><Badge variant="outline">{scenario.simulation_type}</Badge></TableCell><TableCell><Badge variant={scenario.difficulty === "Easy" ? "secondary" : scenario.difficulty === "Medium" ? "outline" : "default"}>{scenario.difficulty}</Badge></TableCell><TableCell><Badge variant={scenario.status === "ACTIVE" ? "default" : "secondary"}>{scenario.status}</Badge></TableCell><TableCell>{scenario.uses}</TableCell><TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" title="Preview scenario" onClick={() => previewScenario(scenario.scenario_id)}><Play className="w-4 h-4" /></Button><Button variant="ghost" size="icon" title="Edit scenario" onClick={() => openEdit(scenario.scenario_id)}><Edit className="w-4 h-4" /></Button><Button variant="ghost" size="icon" title="Delete scenario" onClick={() => deleteScenario(scenario)}><Trash2 className="w-4 h-4" /></Button></div></TableCell></TableRow>)}{!scenarios.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No scenarios have been generated yet.</TableCell></TableRow>}</TableBody></Table>{pagination.pages > 1 && <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Page {pagination.page} of {pagination.pages} · {pagination.total.toLocaleString()} scenarios</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage((current) => current + 1)}>Next</Button></div></div>}</CardContent></Card>
      </div>
      <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editingId ? "Edit Scenario" : "Create Scenario"}</DialogTitle><DialogDescription>Provide the message content and the correct learner action.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={saveScenario}><div className="grid md:grid-cols-2 gap-4"><Field label="Title"><Input value={form.title} onChange={(event) => setField("title", event.target.value)} required /></Field><Field label="Sender"><Input value={form.sender} onChange={(event) => setField("sender", event.target.value)} /></Field><Field label="Type"><Select value={form.simulation_type} onChange={(value) => setField("simulation_type", value as ScenarioForm["simulation_type"])} options={["EMAIL", "SMS"]} /></Field><Field label="Category"><Select value={form.category} onChange={(value) => setField("category", value)} options={categories} /></Field><Field label="Difficulty"><Select value={form.difficulty} onChange={(value) => setField("difficulty", value as ScenarioForm["difficulty"])} options={["Easy", "Medium", "Hard"]} /></Field><Field label="Correct action"><Select value={form.correct_answer} onChange={(value) => setField("correct_answer", value as ScenarioForm["correct_answer"])} options={["REPORT", "SAFE"]} /></Field><Field label="Status"><Select value={form.status} onChange={(value) => setField("status", value as ScenarioForm["status"])} options={["ACTIVE", "INACTIVE"]} /></Field><Field label="Subject"><Input value={form.subject} onChange={(event) => setField("subject", event.target.value)} /></Field></div><Field label="Message"><Textarea value={form.message} onChange={(event) => setField("message", event.target.value)} required /></Field><Field label="Phishing cues"><Input value={form.phishing_cues} onChange={(event) => setField("phishing_cues", event.target.value)} placeholder="Urgent language, Suspicious URL" /></Field><Field label="Feedback"><Textarea value={form.feedback} onChange={(event) => setField("feedback", event.target.value)} /></Field><DialogFooter><Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save Scenario"}</Button></DialogFooter></form></DialogContent></Dialog>
      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}><DialogContent><DialogHeader><DialogTitle>{preview?.title}</DialogTitle><DialogDescription>{preview?.simulation_type} | {preview?.category} | {preview?.difficulty}</DialogDescription></DialogHeader><div className="space-y-2 text-sm"><p><strong>From:</strong> {preview?.sender || "Unknown sender"}</p>{preview?.subject && <p><strong>Subject:</strong> {preview.subject}</p>}<p className="whitespace-pre-wrap border rounded-md p-3">{preview?.message}</p><p><strong>Correct action:</strong> {preview?.correct_answer}</p></div></DialogContent></Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return <select className="w-full h-9 rounded-md border bg-input-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
}
