import { useState } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

interface SurveysPageProps {
  onBack: () => void;
}

export function SurveysPage({ onBack }: SurveysPageProps) {
  const [confidence, setConfidence] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="h-screen flex flex-col">
        <div className="border-b p-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-xl font-semibold">Surveys & Feedback</h2>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
              </div>
              <div>
                <CardTitle className="text-2xl">Thank You!</CardTitle>
                <CardDescription className="mt-2">
                  Your feedback helps us improve the training experience
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button onClick={onBack} className="w-full">
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b p-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-semibold">Surveys & Feedback</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Confidence Survey</CardTitle>
                <CardDescription>
                  Help us understand your confidence in detecting phishing attacks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>How confident are you in identifying phishing emails?</Label>
                  <RadioGroup value={confidence} onValueChange={setConfidence}>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 border p-3 rounded">
                        <RadioGroupItem value="very-confident" id="conf-1" />
                        <Label htmlFor="conf-1" className="flex-1 cursor-pointer font-normal">
                          Very Confident
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border p-3 rounded">
                        <RadioGroupItem value="confident" id="conf-2" />
                        <Label htmlFor="conf-2" className="flex-1 cursor-pointer font-normal">
                          Confident
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border p-3 rounded">
                        <RadioGroupItem value="neutral" id="conf-3" />
                        <Label htmlFor="conf-3" className="flex-1 cursor-pointer font-normal">
                          Neutral
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border p-3 rounded">
                        <RadioGroupItem value="not-confident" id="conf-4" />
                        <Label htmlFor="conf-4" className="flex-1 cursor-pointer font-normal">
                          Not Very Confident
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border p-3 rounded">
                        <RadioGroupItem value="not-confident-at-all" id="conf-5" />
                        <Label htmlFor="conf-5" className="flex-1 cursor-pointer font-normal">
                          Not Confident At All
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-3">
                  <Label>How would you rate the difficulty of the simulations?</Label>
                  <RadioGroup value={difficulty} onValueChange={setDifficulty}>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 border p-3 rounded">
                        <RadioGroupItem value="very-easy" id="diff-1" />
                        <Label htmlFor="diff-1" className="flex-1 cursor-pointer font-normal">
                          Very Easy
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border p-3 rounded">
                        <RadioGroupItem value="easy" id="diff-2" />
                        <Label htmlFor="diff-2" className="flex-1 cursor-pointer font-normal">
                          Easy
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border p-3 rounded">
                        <RadioGroupItem value="moderate" id="diff-3" />
                        <Label htmlFor="diff-3" className="flex-1 cursor-pointer font-normal">
                          Moderate
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border p-3 rounded">
                        <RadioGroupItem value="difficult" id="diff-4" />
                        <Label htmlFor="diff-4" className="flex-1 cursor-pointer font-normal">
                          Difficult
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border p-3 rounded">
                        <RadioGroupItem value="very-difficult" id="diff-5" />
                        <Label htmlFor="diff-5" className="flex-1 cursor-pointer font-normal">
                          Very Difficult
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Additional Feedback</CardTitle>
                <CardDescription>
                  Share any comments or suggestions for improvement
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Your feedback helps us improve the training experience..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={6}
                />
              </CardContent>
            </Card>

            <Button type="submit" className="w-full" size="lg">
              Submit Survey
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
