import { useState } from 'react';
import { Mail, Archive, Trash2, AlertTriangle, ExternalLink, ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';

interface EmailSimulationProps {
  onBack: () => void;
}

export function EmailSimulation({ onBack }: EmailSimulationProps) {
  const [selectedEmail, setSelectedEmail] = useState(1);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'correct' | 'incorrect' | null>(null);

  const emails = [
    {
      id: 1,
      from: 'security@paypa1-verify.com',
      subject: 'Urgent: Verify Your Account Now',
      time: '10:34 AM',
      preview: 'Your account will be suspended unless you verify...',
      isPhishing: true,
    },
    {
      id: 2,
      from: 'team@company.com',
      subject: 'Weekly Team Update',
      time: '9:15 AM',
      preview: 'Here are this week\'s highlights and achievements...',
      isPhishing: false,
    },
    {
      id: 3,
      from: 'no-reply@bankupdate.net',
      subject: 'Unusual Activity Detected',
      time: 'Yesterday',
      preview: 'We noticed suspicious activity on your account...',
      isPhishing: true,
    },
  ];

  const currentEmail = emails.find((e) => e.id === selectedEmail);

  const handleAction = (action: 'report' | 'ignore' | 'link') => {
    if (action === 'report' && currentEmail?.isPhishing) {
      setFeedbackType('correct');
    } else if (action === 'report' && !currentEmail?.isPhishing) {
      setFeedbackType('incorrect');
    } else if (action === 'link' && currentEmail?.isPhishing) {
      setFeedbackType('incorrect');
    } else if (action === 'ignore' && !currentEmail?.isPhishing) {
      setFeedbackType('correct');
    } else {
      setFeedbackType('incorrect');
    }
    setShowFeedback(true);
  };

  const phishingIndicators = [
    'Suspicious sender domain (paypa1-verify.com vs paypal.com)',
    'Urgent language creating pressure to act quickly',
    'Generic greeting instead of your name',
    'Suspicious link destination on hover',
    'Poor grammar and spelling errors',
  ];

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b p-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-semibold">Email Phishing Simulation</h2>
        <Badge variant="outline" className="ml-auto">Training Mode</Badge>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r overflow-y-auto">
          <div className="p-3 border-b bg-muted/30">
            <h3 className="font-semibold text-sm">Inbox</h3>
          </div>
          <div>
            {emails.map((email) => (
              <div
                key={email.id}
                onClick={() => setSelectedEmail(email.id)}
                className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                  selectedEmail === email.id ? 'bg-muted' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="font-medium text-sm truncate flex-1">{email.from}</span>
                  <span className="text-xs text-muted-foreground ml-2">{email.time}</span>
                </div>
                <div className="font-medium text-sm mb-1 truncate">{email.subject}</div>
                <div className="text-xs text-muted-foreground truncate">{email.preview}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {currentEmail && (
            <>
              <div className="p-6 border-b">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">{currentEmail.subject}</h3>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">From:</span>
                      <span className="text-muted-foreground">{currentEmail.from}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon">
                      <Archive className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-6 overflow-y-auto">
                <Card className="p-6">
                  <div className="space-y-4">
                    <p>Dear Valued Customer,</p>
                    <p>
                      We have detected unusual activity on your account. For your security, we need you to
                      verify your identity immediately.
                    </p>
                    <p className="font-semibold text-destructive">
                      Your account will be suspended in 24 hours unless you take action.
                    </p>
                    <p>Please click the link below to verify your account:</p>
                    <div className="bg-muted p-3 rounded border">
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          handleAction('link');
                        }}
                        className="text-primary hover:underline flex items-center gap-2"
                      >
                        https://paypa1-verify.com/secure/login
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                    <p>Thank you for your immediate attention to this matter.</p>
                    <p className="text-muted-foreground">
                      Sincerely,
                      <br />
                      Security Team
                    </p>
                  </div>
                </Card>
              </div>

              <div className="border-t p-4 bg-muted/30">
                <div className="flex gap-3 justify-center">
                  <Button onClick={() => handleAction('report')} variant="destructive">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Report as Phishing
                  </Button>
                  <Button onClick={() => handleAction('ignore')} variant="outline">
                    Mark as Safe
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {feedbackType === 'correct' ? 'Correct! Well Done' : 'Incorrect'}
            </DialogTitle>
            <DialogDescription>
              {feedbackType === 'correct'
                ? 'You correctly identified this email.'
                : 'This was not the right choice. Let\'s review why.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {currentEmail?.isPhishing && (
              <div>
                <h4 className="font-semibold mb-2">Phishing Indicators:</h4>
                <ul className="space-y-2">
                  {phishingIndicators.map((indicator, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                      <span>{indicator}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Button onClick={() => setShowFeedback(false)} className="w-full">
              Continue Training
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
