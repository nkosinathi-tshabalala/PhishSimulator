import { useState } from 'react';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';

interface SMSSimulationProps {
  onBack: () => void;
}

export function SMSSimulation({ onBack }: SMSSimulationProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'correct' | 'incorrect' | null>(null);

  const handleAction = (action: 'report' | 'ignore' | 'link') => {
    if (action === 'report') {
      setFeedbackType('correct');
    } else {
      setFeedbackType('incorrect');
    }
    setShowFeedback(true);
  };

  const smishingIndicators = [
    'Unknown sender using a random number',
    'Urgent language creating panic about account suspension',
    'Suspicious shortened URL (bit.ly)',
    'Request for immediate action',
    'Claims to be from a bank but uses unprofessional formatting',
  ];

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b p-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-semibold">SMS Phishing Simulation</h2>
        <Badge variant="outline" className="ml-auto">Training Mode</Badge>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-muted/30">
        <div className="w-full max-w-md">
          <Card className="border-2">
            <div className="bg-primary text-primary-foreground p-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Messages</h3>
                <span className="text-sm">10:42 AM</span>
              </div>
            </div>

            <div className="p-6 space-y-4 bg-background min-h-[400px]">
              <div className="flex flex-col items-start">
                <div className="bg-muted rounded-2xl rounded-tl-none p-4 max-w-[85%]">
                  <div className="text-xs text-muted-foreground mb-1">+1 (555) 892-3471</div>
                  <p className="text-sm">
                    URGENT: Your bank account has been suspended due to suspicious activity.
                    Verify your identity immediately to restore access: https://bit.ly/bnk-verify-2947
                  </p>
                  <p className="text-sm mt-2">
                    Click the link within 2 hours or your account will be permanently closed.
                  </p>
                  <div className="text-xs text-muted-foreground mt-2">10:42 AM</div>
                </div>
              </div>
            </div>

            <div className="border-t p-4 space-y-3">
              <p className="text-sm text-center text-muted-foreground mb-2">
                What should you do with this message?
              </p>
              <div className="flex flex-col gap-2">
                <Button onClick={() => handleAction('report')} variant="destructive" className="w-full">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Report as Smishing
                </Button>
                <Button onClick={() => handleAction('link')} variant="outline" className="w-full">
                  Open Link
                </Button>
                <Button onClick={() => handleAction('ignore')} variant="outline" className="w-full">
                  Ignore Message
                </Button>
              </div>
            </div>
          </Card>

          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Smishing = SMS + Phishing. Scammers use text messages to steal information.
            </p>
          </div>
        </div>
      </div>

      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {feedbackType === 'correct' ? 'Excellent Work!' : 'Not Quite Right'}
            </DialogTitle>
            <DialogDescription>
              {feedbackType === 'correct'
                ? 'You correctly identified this as a smishing attack.'
                : 'This message is a smishing scam. Here\'s why:'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Smishing Indicators:</h4>
              <ul className="space-y-2">
                {smishingIndicators.map((indicator, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                    <span>{indicator}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-muted p-3 rounded">
              <p className="text-sm font-semibold mb-1">Remember:</p>
              <p className="text-sm">
                Legitimate banks never ask you to verify your account via text message links.
                Always contact your bank directly using their official phone number.
              </p>
            </div>
            <Button onClick={() => setShowFeedback(false)} className="w-full">
              Continue Training
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
