import { ArrowLeft, Mail, MessageSquare } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface SimulationsPageProps {
  onNavigate: (page: string) => void;
}

export function SimulationsPage({ onNavigate }: SimulationsPageProps) {
  return (
    <div className="h-screen flex flex-col">
      <div className="border-b p-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => onNavigate('dashboard')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-semibold">Training Simulations</h2>
      </div>

      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Choose Your Training</h1>
            <p className="text-muted-foreground mt-1">
              Select a simulation type to practice your phishing detection skills
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onNavigate('email')}>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Email Phishing Simulation</CardTitle>
                <CardDescription>
                  Learn to identify phishing emails through realistic scenarios
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• Realistic email interfaces</p>
                  <p>• Immediate feedback on decisions</p>
                  <p>• Detailed phishing indicators</p>
                </div>
                <Button className="w-full mt-4" onClick={() => onNavigate('email')}>
                  Start Email Simulation
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onNavigate('sms')}>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <MessageSquare className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>SMS Phishing Simulation</CardTitle>
                <CardDescription>
                  Practice detecting smishing attacks via text messages
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• Mobile-style SMS interface</p>
                  <p>• Common smishing tactics</p>
                  <p>• Real-world scam examples</p>
                </div>
                <Button className="w-full mt-4" onClick={() => onNavigate('sms')}>
                  Start SMS Simulation
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Your Progress</CardTitle>
              <CardDescription>Recent simulation activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Email Simulations Completed</span>
                  <span className="font-semibold">22</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">SMS Simulations Completed</span>
                  <span className="font-semibold">13</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Overall Success Rate</span>
                  <span className="font-semibold">78%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
