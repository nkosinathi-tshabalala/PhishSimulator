import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, Eye, Mail, Send, Settings, Shield } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import EmailService from "../../services/emailService";

interface Scenario {
  scenario_id: number;
  title: string;
  sender: string;
  subject: string;
  message: string;
  category: string;
  difficulty: string;
}

interface DispatcherContext {
  delivery_configured: boolean;
  smtp_host: string;
  recipient_count: number;
  target_groups: string[];
  overview: {
    campaigns: number;
    sent: number;
    clicked: number;
    reported: number;
    click_rate: number;
    report_rate: number;
  };
  scenarios: Scenario[];
  campaigns: Campaign[];
}

interface Campaign {
  campaign_id: number;
  name: string;
  status: string;
  scenario_title: string;
  target_group: string;
  created_at: string;
  launched_at: string | null;
  recipients: number;
  sent: number;
  failed: number;
  clicked: number;
  click_rate: number;
  reported: number;
  report_rate: number;
  recipient_details?: Array<{
    email: string;
    delivery_status: string;
    sent_at: string | null;
    clicked_at: string | null;
    click_count: number;
    reported_at: string | null;
  }>;
}

interface EmailDispatcherPageProps {
  onBack: () => void;
}

export function EmailDispatcherPage({ onBack }: EmailDispatcherPageProps) {
  const [context, setContext] = useState<DispatcherContext | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<number | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [targetOccupation, setTargetOccupation] = useState("ALL");
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadContext = async () => {
    setLoading(true);
    try {
      const response = await EmailService.getDispatcherContext();
      if (response.ok && response.data.success) {
        const data = response.data.data as DispatcherContext;
        setContext(data);
        setSelectedScenarioId((current) => current ?? data.scenarios[0]?.scenario_id ?? null);
      } else {
        setMessage(response.data.message || "Unable to load email campaign settings.");
      }
    } catch {
      setMessage("Unable to load email campaign settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContext();
  }, []);

  const selectedScenario = context?.scenarios.find((scenario) => scenario.scenario_id === selectedScenarioId);

  const createCampaign = async () => {
    if (!selectedScenarioId) return;
    setSubmitting(true);
    try {
      const response = await EmailService.createCampaign(
        selectedScenarioId,
        campaignName,
        targetOccupation === "ALL" ? null : targetOccupation,
      );
      setMessage(response.data.message || "Campaign request could not be processed.");
      if (response.ok && response.data.success) {
        setCampaignName("");
        await loadContext();
        await viewReport(response.data.data.campaign_id);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const launchCampaign = async (campaignId: number) => {
    setSubmitting(true);
    try {
      const response = await EmailService.launchCampaign(campaignId);
      setMessage(response.data.message || "Campaign launch could not be processed.");
      if (response.ok && response.data.success) {
        await loadContext();
        await viewReport(campaignId);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const viewReport = async (campaignId: number) => {
    const response = await EmailService.getCampaignReport(campaignId);
    if (response.ok && response.data.success) {
      setSelectedCampaign(response.data.data as Campaign);
      return;
    }
    setMessage(response.data.message || "Unable to load campaign report.");
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b p-4 flex items-center gap-4 bg-card">
        <Button variant="ghost" size="icon" onClick={onBack} title="Back"><Mail className="w-5 h-5" /></Button>
        <div><h2 className="text-xl font-semibold">Email Campaign Manager</h2><p className="text-sm text-muted-foreground">Authorized training delivery and reporting</p></div>
        <Badge className="ml-auto"><Shield className="w-3 h-3 mr-1" />Admin</Badge>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-5xl w-full mx-auto">
        {loading ? <p className="text-muted-foreground">Loading dispatcher configuration...</p> : <>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Settings className="w-4 h-4" />Delivery Configuration</CardTitle><CardDescription>Credentials are managed only in backend environment settings.</CardDescription></CardHeader>
            <CardContent className="flex items-center justify-between gap-4"><span>SMTP provider: {context?.smtp_host}</span><Badge variant={context?.delivery_configured ? "default" : "destructive"}>{context?.delivery_configured ? "Configured" : "Not configured"}</Badge></CardContent>
          </Card>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Emails Sent", value: context?.overview.sent ?? 0 },
              { label: "Click Rate", value: `${context?.overview.click_rate ?? 0}%` },
              { label: "Report Rate", value: `${context?.overview.report_rate ?? 0}%` },
              { label: "Campaigns", value: context?.overview.campaigns ?? 0 },
            ].map((metric) => <Card key={metric.label}><CardContent className="p-4"><p className="text-2xl font-semibold">{metric.value}</p><p className="text-sm text-muted-foreground">{metric.label}</p></CardContent></Card>)}
          </div>
          <Card>
            <CardHeader><CardTitle>Campaign Builder</CardTitle><CardDescription>Select an approved email template, target a learner group, then save a reviewable draft before launch.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <Input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="Campaign name (for example, August password reset training)" maxLength={150} />
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">Template Library
                  <select className="w-full border rounded-md p-2 font-normal" value={selectedScenarioId ?? ""} onChange={(event) => setSelectedScenarioId(Number(event.target.value))}>
                {!context?.scenarios.length && <option value="">No active email scenarios available</option>}
                    {context?.scenarios.map((scenario) => <option key={scenario.scenario_id} value={scenario.scenario_id}>{scenario.title} · {scenario.category}</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-sm font-medium">Target Group
                  <select className="w-full border rounded-md p-2 font-normal" value={targetOccupation} onChange={(event) => setTargetOccupation(event.target.value)}>
                    <option value="ALL">All registered players ({context?.recipient_count ?? 0})</option>
                    {context?.target_groups.map((group) => <option key={group} value={group}>{group}</option>)}
                  </select>
                </label>
              </div>
              {selectedScenario && <div className="border rounded-md overflow-hidden"><div className="p-4 bg-muted space-y-2 text-sm"><div className="flex flex-wrap gap-2"><Badge variant="secondary">{selectedScenario.category}</Badge><Badge variant="outline">{selectedScenario.difficulty}</Badge></div><p><span className="text-muted-foreground">From: </span>{selectedScenario.sender}</p><p><span className="text-muted-foreground">Subject: </span>{selectedScenario.subject}</p></div><pre className="p-4 whitespace-pre-wrap font-sans text-sm">{selectedScenario.message}</pre></div>}
              <Button className="w-full" disabled={!selectedScenarioId || submitting} onClick={createCampaign}>Create Campaign Draft</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Eye className="w-4 h-4" />Campaigns</CardTitle><CardDescription>Delivery and click results are stored per recipient.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {!context?.delivery_configured && <div className="flex gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded"><AlertTriangle className="w-4 h-4 shrink-0" />SMTP is not configured. You can create drafts, but launch is disabled until authorized delivery is configured.</div>}
              {message && <p className="text-sm text-muted-foreground">{message}</p>}
              <div className="space-y-3">
                {context?.campaigns.map((campaign) => <div key={campaign.campaign_id} className="border rounded-md p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><p className="font-medium">{campaign.name}</p><Badge variant={campaign.status === "LAUNCHED" ? "default" : campaign.status === "FAILED" ? "destructive" : "secondary"}>{campaign.status}</Badge></div><p className="text-sm text-muted-foreground">{campaign.scenario_title} · {campaign.target_group} · {campaign.recipients} recipients · {campaign.clicked} clicks · {campaign.reported} reports</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => viewReport(campaign.campaign_id)}>View report</Button>{campaign.status === "DRAFT" && <Button size="sm" disabled={!context.delivery_configured || submitting} onClick={() => launchCampaign(campaign.campaign_id)}><Send className="w-4 h-4 mr-2" />Launch</Button>}</div></div>)}
                {!context?.campaigns.length && <p className="text-sm text-muted-foreground">No campaigns have been created yet.</p>}
              </div>
            </CardContent>
          </Card>
          {selectedCampaign && <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="w-4 h-4" />{selectedCampaign.name} Report</CardTitle><CardDescription>{selectedCampaign.scenario_title} · {selectedCampaign.target_group}</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center"><div><p className="text-2xl font-semibold">{selectedCampaign.recipients}</p><p className="text-xs text-muted-foreground">Recipients</p></div><div><p className="text-2xl font-semibold">{selectedCampaign.sent}</p><p className="text-xs text-muted-foreground">Sent</p></div><div><p className="text-2xl font-semibold">{selectedCampaign.clicked}</p><p className="text-xs text-muted-foreground">Clicked</p></div><div><p className="text-2xl font-semibold">{selectedCampaign.click_rate}%</p><p className="text-xs text-muted-foreground">Click rate</p></div><div><p className="text-2xl font-semibold">{selectedCampaign.report_rate}%</p><p className="text-xs text-muted-foreground">Report rate</p></div></div><div className="border rounded-md overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/50"><th className="p-2 text-left">Recipient</th><th className="p-2 text-left">Delivery</th><th className="p-2 text-left">Clicks</th><th className="p-2 text-left">Reported</th></tr></thead><tbody>{selectedCampaign.recipient_details?.map((recipient) => <tr key={recipient.email} className="border-b last:border-0"><td className="p-2">{recipient.email}</td><td className="p-2">{recipient.delivery_status}</td><td className="p-2">{recipient.click_count}</td><td className="p-2">{recipient.reported_at ? new Date(recipient.reported_at).toLocaleString() : "—"}</td></tr>)}</tbody></table></div></CardContent></Card>}
        </>}
      </div>
    </div>
  );
}