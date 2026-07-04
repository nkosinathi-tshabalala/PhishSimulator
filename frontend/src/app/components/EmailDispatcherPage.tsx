import { useState } from 'react';
import { Send, Settings, Eye, CheckCircle2, AlertTriangle, Copy, Mail, Shield } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';

interface EmailDispatcherPageProps {
  onBack: () => void;
}

export function EmailDispatcherPage({ onBack }: EmailDispatcherPageProps) {
  const [smtpConfig, setSmtpConfig] = useState({
    host: 'smtp.example.com',
    port: '587',
    username: 'dispatcher@phishsimulator.local',
    password: '',
    encryption: 'TLS',
  });

  const [campaignConfig, setCampaignConfig] = useState({
    fromName: 'IT Security Team',
    fromEmail: 'security@paypa1-verify.com',
    subject: 'Urgent: Verify Your Account Immediately',
    targetList: 'player_group_a',
    scenario: 'PayPal Account Suspension',
  });

  const [trackingToken] = useState('TRK-' + Math.random().toString(36).substring(2, 10).toUpperCase());
  const [testSent, setTestSent] = useState(false);
  const [campaignStatus, setCampaignStatus] = useState<'idle' | 'running' | 'completed'>('idle');

  const handleSendTest = () => {
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  const handleLaunch = () => {
    setCampaignStatus('running');
    setTimeout(() => setCampaignStatus('completed'), 3000);
  };

  const emailPreviewBody = `Dear Valued Customer,

We have detected unusual activity on your PayPal account. To protect your account security, you must verify your identity immediately.

Your account access will be restricted in 24 hours unless you complete verification.

Verify Account: https://paypa1-verify.com/secure/login?token=${trackingToken}

If you did not request this, please contact support immediately.

Regards,
PayPal Security Team`;

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: '#f0f4f8' }}>
      <div className="border-b p-4 flex items-center gap-4 bg-white">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: '#0f2240' }}>Email Dispatcher</h2>
          <p className="text-sm" style={{ color: '#64748b' }}>SMTP-based phishing simulation delivery &mdash; Administrator only</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
            <Shield className="w-3 h-3" />
            Admin Only
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SMTP Settings */}
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" style={{ color: '#1e3a5f' }} />
                <CardTitle className="text-base" style={{ color: '#0f2240' }}>SMTP Configuration</CardTitle>
              </div>
              <CardDescription>Outgoing mail server settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs" style={{ color: '#64748b' }}>SMTP Host</Label>
                  <Input
                    value={smtpConfig.host}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" style={{ color: '#64748b' }}>Port</Label>
                  <Input
                    value={smtpConfig.port}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, port: e.target.value })}
                    className="text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" style={{ color: '#64748b' }}>Username</Label>
                <Input
                  value={smtpConfig.username}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, username: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" style={{ color: '#64748b' }}>Password</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={smtpConfig.password}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, password: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.15)' }}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" style={{ color: '#16a34a' }} />
                  <span className="text-sm" style={{ color: '#16a34a' }}>TLS Encryption Enabled</span>
                </div>
                <Badge className="text-xs" style={{ backgroundColor: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                  Secure
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Campaign Settings */}
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" style={{ color: '#1e3a5f' }} />
                <CardTitle className="text-base" style={{ color: '#0f2240' }}>Campaign Configuration</CardTitle>
              </div>
              <CardDescription>Sender details and target audience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs" style={{ color: '#64748b' }}>From Name (Spoofed)</Label>
                <Input
                  value={campaignConfig.fromName}
                  onChange={(e) => setCampaignConfig({ ...campaignConfig, fromName: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" style={{ color: '#64748b' }}>From Email (Spoofed)</Label>
                <Input
                  value={campaignConfig.fromEmail}
                  onChange={(e) => setCampaignConfig({ ...campaignConfig, fromEmail: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" style={{ color: '#64748b' }}>Subject Line</Label>
                <Input
                  value={campaignConfig.subject}
                  onChange={(e) => setCampaignConfig({ ...campaignConfig, subject: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" style={{ color: '#64748b' }}>Target Player Group</Label>
                <select
                  value={campaignConfig.targetList}
                  onChange={(e) => setCampaignConfig({ ...campaignConfig, targetList: e.target.value })}
                  className="w-full text-sm rounded-md border px-3 py-2"
                  style={{ borderColor: '#e2e8f0', backgroundColor: '#f8fafc', color: '#0f172a' }}
                >
                  <option value="player_group_a">Player Group A (34 players)</option>
                  <option value="player_group_b">Player Group B (28 players)</option>
                  <option value="all_players">All Players (142 players)</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tracking Token */}
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-base" style={{ color: '#0f2240' }}>Tracking Token</CardTitle>
            <CardDescription>Unique identifier embedded in simulation links to track click-through events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-3 p-3 rounded-lg font-mono text-sm" style={{ backgroundColor: '#f0f4f8', border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#1e3a5f' }}>{trackingToken}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard?.writeText(trackingToken)}
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Copy
              </Button>
              <Badge className="text-xs" style={{ backgroundColor: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                Tracking Enabled
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Email Preview */}
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4" style={{ color: '#1e3a5f' }} />
              <CardTitle className="text-base" style={{ color: '#0f2240' }}>Email Preview</CardTitle>
            </div>
            <CardDescription>How the phishing email will appear to recipients</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
              {/* Email Header */}
              <div className="p-4 border-b" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                <div className="space-y-1.5 text-sm">
                  <div className="flex gap-2">
                    <span className="w-14 font-medium text-xs" style={{ color: '#94a3b8' }}>From:</span>
                    <span style={{ color: '#dc2626' }}>{campaignConfig.fromName} &lt;{campaignConfig.fromEmail}&gt;</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-14 font-medium text-xs" style={{ color: '#94a3b8' }}>Subject:</span>
                    <span className="font-medium" style={{ color: '#0f2240' }}>{campaignConfig.subject}</span>
                  </div>
                </div>
              </div>
              {/* Email Body */}
              <div className="p-5">
                <pre className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: '#374151', fontFamily: 'inherit' }}>
                  {emailPreviewBody}
                </pre>
              </div>
              {/* Warning Banner */}
              <div className="px-4 pb-4">
                <div className="flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                  <p className="text-xs" style={{ color: '#92400e' }}>
                    This is a simulated phishing email for training purposes. The link contains a tracking token to measure click-through rates.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Campaign Status & Actions */}
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-base" style={{ color: '#0f2240' }}>Campaign Status</CardTitle>
            <CardDescription>Send a test email or launch the full campaign</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 p-4 rounded-xl" style={{ backgroundColor: '#f0f4f8' }}>
              <div className="text-center">
                <div className="text-xl font-bold" style={{ color: '#0f2240' }}>
                  {campaignStatus === 'completed' ? '34' : '0'}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>Emails Sent</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold" style={{ color: '#f59e0b' }}>
                  {campaignStatus === 'completed' ? '12' : '0'}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>Link Opens</div>
              </div>
              <div className="text-center">
                <Badge
                  className="text-xs px-3 py-1"
                  style={{
                    backgroundColor: campaignStatus === 'completed' ? 'rgba(22,163,74,0.1)' : campaignStatus === 'running' ? 'rgba(14,165,233,0.1)' : 'rgba(100,116,139,0.1)',
                    color: campaignStatus === 'completed' ? '#16a34a' : campaignStatus === 'running' ? '#0ea5e9' : '#64748b',
                  }}
                >
                  {campaignStatus === 'completed' ? 'Completed' : campaignStatus === 'running' ? 'Running...' : 'Idle'}
                </Badge>
                <div className="text-xs mt-1" style={{ color: '#64748b' }}>Status</div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleSendTest}
                className="flex-1"
              >
                {testSent
                  ? <><CheckCircle2 className="w-4 h-4 mr-2" style={{ color: '#16a34a' }} />Test Sent!</>
                  : <><Send className="w-4 h-4 mr-2" />Send Test Email</>
                }
              </Button>
              <Button
                onClick={handleLaunch}
                disabled={campaignStatus === 'running'}
                className="flex-1 text-white"
                style={{ backgroundColor: '#1e3a5f' }}
              >
                <Send className="w-4 h-4 mr-2" />
                {campaignStatus === 'running' ? 'Launching...' : 'Launch Campaign'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
