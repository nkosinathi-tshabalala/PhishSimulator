import { useState } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, Info, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';

interface BaselineQuizProps {
  onBack: () => void;
}

interface Question {
  id: number;
  question: string;
  instruction: string;
  expectedKeywords: string[];
  exampleAnswer: string;
  feedback: string;
  confidenceThreshold: number;
}

const questions: Question[] = [
  {
    id: 1,
    question: 'How would you identify a phishing email? Describe at least three warning signs you would look for.',
    instruction: 'Write your answer in your own words. Mention specific indicators you would check.',
    expectedKeywords: ['sender', 'domain', 'urgent', 'link', 'url', 'grammar', 'spelling', 'attachment', 'suspicious', 'hover', 'verify', 'generic'],
    exampleAnswer: 'I would check the sender email domain for misspellings, hover over links to see the real URL, look for urgent language pressuring immediate action, and check for poor grammar.',
    feedback: 'Key phishing indicators include: suspicious sender domains, urgency or threat language, mismatched URLs, poor grammar/spelling, generic greetings, and unexpected attachments.',
    confidenceThreshold: 3,
  },
  {
    id: 2,
    question: 'What steps would you take if you accidentally clicked a suspicious link in an email?',
    instruction: 'Describe the actions you would take immediately and afterwards.',
    expectedKeywords: ['disconnect', 'internet', 'report', 'IT', 'password', 'change', 'antivirus', 'scan', 'notify', 'incident'],
    exampleAnswer: 'I would immediately disconnect from the internet, run an antivirus scan, change my passwords, notify the IT security team, and report the incident.',
    feedback: 'Immediate steps: disconnect from network, run a malware scan, change passwords for affected accounts, notify your IT/security team, and document the incident.',
    confidenceThreshold: 3,
  },
  {
    id: 3,
    question: 'Explain what URL spoofing is and how attackers use it in phishing campaigns.',
    instruction: 'Describe the technique and give an example if possible.',
    expectedKeywords: ['fake', 'domain', 'misspelling', 'lookalike', 'redirect', 'trust', 'legitimate', 'typo', 'subdomain', 'https'],
    exampleAnswer: 'URL spoofing involves creating fake domains that look similar to legitimate ones, like paypa1.com instead of paypal.com, to trick users into entering their credentials.',
    feedback: 'URL spoofing uses look-alike domains (typosquatting), misleading subdomains, or URL redirects to impersonate trusted websites and steal credentials.',
    confidenceThreshold: 2,
  },
  {
    id: 4,
    question: 'What is smishing and how does it differ from traditional email phishing?',
    instruction: 'Define smishing and explain the key differences from email phishing.',
    expectedKeywords: ['SMS', 'text', 'mobile', 'phone', 'link', 'short', 'bit.ly', 'message', 'bank', 'urgent'],
    exampleAnswer: 'Smishing is phishing conducted via SMS text messages. Unlike email phishing, smishing targets mobile users through shortened URLs and urgent messages pretending to be from banks or delivery services.',
    feedback: 'Smishing (SMS phishing) uses text messages rather than email. It often uses shortened URLs, targets mobile users, and exploits the trust people place in text messages.',
    confidenceThreshold: 2,
  },
  {
    id: 5,
    question: 'What is the purpose of multi-factor authentication and how does it help protect against phishing?',
    instruction: 'Explain MFA and its role in phishing defence.',
    expectedKeywords: ['two', 'factor', 'authentication', 'code', 'second', 'password', 'protect', 'account', 'verification', 'OTP', 'app'],
    exampleAnswer: 'Multi-factor authentication requires a second form of verification beyond a password. Even if an attacker steals your password through phishing, they cannot access your account without the second factor.',
    feedback: 'MFA adds a second verification step (code, biometric, or authenticator app). It prevents account takeover even when credentials are compromised through phishing.',
    confidenceThreshold: 2,
  },
];

interface QuestionResult {
  questionId: number;
  userAnswer: string;
  matchedKeywords: string[];
  score: number;
  maxScore: number;
  passed: boolean;
}

function evaluateAnswer(answer: string, question: Question): { matched: string[]; score: number; confidence: number } {
  const lower = answer.toLowerCase();
  const matched = question.expectedKeywords.filter((kw) => lower.includes(kw.toLowerCase()));
  const score = matched.length;
  const confidence = Math.min(100, Math.round((matched.length / question.expectedKeywords.length) * 100));
  return { matched, score, confidence };
}

export function BaselineQuiz({ onBack }: BaselineQuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex) / questions.length) * 100;

  const handleSubmit = () => {
    const { matched, score } = evaluateAnswer(userAnswer, currentQuestion);
    const result: QuestionResult = {
      questionId: currentQuestion.id,
      userAnswer,
      matchedKeywords: matched,
      score,
      maxScore: currentQuestion.expectedKeywords.length,
      passed: matched.length >= currentQuestion.confidenceThreshold,
    };
    const newResults = [...results, result];
    setResults(newResults);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserAnswer('');
    } else {
      setShowResults(true);
    }
  };

  const totalScore = results.reduce((acc, r) => acc + r.score, 0);
  const totalMax = questions.reduce((acc, q) => acc + q.expectedKeywords.length, 0);
  const overallPercent = Math.round((totalScore / totalMax) * 100);
  const passed = results.filter((r) => r.passed).length;

  if (showResults) {
    return (
      <div className="h-full overflow-y-auto" style={{ backgroundColor: '#f0f4f8' }}>
        <div className="border-b p-4 flex items-center gap-4 bg-white">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-xl font-semibold" style={{ color: '#0f2240' }}>Baseline Assessment Results</h2>
            <p className="text-sm" style={{ color: '#64748b' }}>Open-text evaluation complete</p>
          </div>
        </div>

        <div className="p-6 max-w-3xl mx-auto space-y-6">
          {/* Score Summary */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-5xl font-bold" style={{ color: '#1e3a5f' }}>{overallPercent}%</div>
                  <div className="text-sm mt-1" style={{ color: '#64748b' }}>Overall Score</div>
                </div>
                <div className="h-16 w-px" style={{ backgroundColor: '#e2e8f0' }} />
                <div className="grid grid-cols-2 gap-4 flex-1">
                  <div>
                    <div className="text-2xl font-bold" style={{ color: '#16a34a' }}>{passed}/{questions.length}</div>
                    <div className="text-xs" style={{ color: '#64748b' }}>Questions Passed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold" style={{ color: '#0ea5e9' }}>{totalScore}</div>
                    <div className="text-xs" style={{ color: '#64748b' }}>Keywords Matched</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold" style={{ color: '#0f2240' }}>
                      {overallPercent >= 70 ? 'Intermediate' : overallPercent >= 40 ? 'Beginner' : 'Novice'}
                    </div>
                    <div className="text-xs" style={{ color: '#64748b' }}>Confidence Level</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>
                      {overallPercent >= 70 ? 'Medium' : 'Easy'}
                    </div>
                    <div className="text-xs" style={{ color: '#64748b' }}>Starting Difficulty</div>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Progress value={overallPercent} className="h-3" />
              </div>
            </CardContent>
          </Card>

          {/* Per-question results */}
          <div className="space-y-4">
            {results.map((result, i) => {
              const q = questions[i];
              return (
                <Card key={i} className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-start gap-3">
                      {result.passed
                        ? <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#16a34a' }} />
                        : <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#dc2626' }} />
                      }
                      <div className="flex-1">
                        <div className="font-medium text-sm" style={{ color: '#0f2240' }}>{q.question}</div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs" style={{ color: '#64748b' }}>
                            {result.score} / {result.maxScore} keywords matched
                          </span>
                          <Badge
                            className="text-xs"
                            style={{
                              backgroundColor: result.passed ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
                              color: result.passed ? '#16a34a' : '#dc2626',
                            }}
                          >
                            {result.passed ? 'Passed' : 'Needs Review'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="p-3 rounded-lg" style={{ backgroundColor: '#f0f4f8' }}>
                      <div className="text-xs font-medium mb-1" style={{ color: '#64748b' }}>Your answer:</div>
                      <div className="text-sm" style={{ color: '#0f2240' }}>{result.userAnswer || '(no answer provided)'}</div>
                    </div>
                    {result.matchedKeywords.length > 0 && (
                      <div>
                        <div className="text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>Matched keywords:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {result.matchedKeywords.map((kw) => (
                            <span key={kw} className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>Expected keywords:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {q.expectedKeywords.map((kw) => (
                          <span
                            key={kw}
                            className="px-2 py-0.5 rounded text-xs"
                            style={{
                              backgroundColor: result.matchedKeywords.includes(kw) ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.08)',
                              color: result.matchedKeywords.includes(kw) ? '#16a34a' : '#dc2626',
                            }}
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)' }}>
                      <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#0ea5e9' }} />
                      <p className="text-xs" style={{ color: '#0f2240' }}>{q.feedback}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex gap-3 pb-6">
            <Button onClick={onBack} className="flex-1 text-white" style={{ backgroundColor: '#1e3a5f' }}>
              Return to Dashboard
            </Button>
            <Button
              onClick={() => {
                setCurrentIndex(0);
                setResults([]);
                setUserAnswer('');
                setShowResults(false);
              }}
              variant="outline"
              className="flex-1"
            >
              Retake Assessment
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: '#f0f4f8' }}>
      {/* Header */}
      <div className="border-b p-4 flex items-center gap-4 bg-white">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-semibold" style={{ color: '#0f2240' }}>Baseline Assessment</h2>
          <p className="text-sm" style={{ color: '#64748b' }}>Open-text knowledge evaluation</p>
        </div>
        <Badge variant="outline" className="font-medium" style={{ color: '#1e3a5f', borderColor: '#1e3a5f' }}>
          Question {currentIndex + 1} of {questions.length}
        </Badge>
      </div>

      {/* Progress */}
      <div className="bg-white px-6 pb-4">
        <div className="flex justify-between text-xs mb-2" style={{ color: '#94a3b8' }}>
          <span>Progress</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Instruction Panel */}
          <div className="flex items-start gap-3 p-4 rounded-xl" style={{ backgroundColor: 'rgba(30,58,95,0.06)', border: '1px solid rgba(30,58,95,0.12)' }}>
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#1e3a5f' }} />
            <div>
              <div className="text-sm font-medium mb-1" style={{ color: '#1e3a5f' }}>Instructions</div>
              <p className="text-sm" style={{ color: '#64748b' }}>
                This assessment uses open-text responses. Write your answers in your own words.
                Your response will be evaluated based on key concepts and terminology.
              </p>
            </div>
          </div>

          {/* Question Card */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ backgroundColor: '#1e3a5f' }}>
                  {currentIndex + 1}
                </div>
                <div>
                  <CardTitle className="text-base leading-normal" style={{ color: '#0f2240' }}>
                    {currentQuestion.question}
                  </CardTitle>
                  <p className="text-sm mt-2" style={{ color: '#64748b' }}>{currentQuestion.instruction}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Type your answer here..."
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                className="min-h-[160px] resize-none text-sm"
                style={{ borderColor: '#e2e8f0' }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: '#94a3b8' }}>
                  {userAnswer.length} characters — try to be thorough
                </span>
                <Button
                  onClick={handleSubmit}
                  disabled={userAnswer.trim().length < 10}
                  className="text-white"
                  style={{ backgroundColor: '#1e3a5f' }}
                >
                  {currentIndex < questions.length - 1 ? 'Next Question' : 'Submit Assessment'}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
