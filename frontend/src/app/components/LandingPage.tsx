import { Shield, Mail, MessageSquare, BarChart3, Target, CheckCircle2, ArrowRight, BookOpen, Zap, Users } from 'lucide-react';
import { Button } from './ui/button';

interface LandingPageProps {
  onNavigate: (page: string) => void;
}

export function LandingPage({ onNavigate }: LandingPageProps) {
  const features = [
    {
      icon: Mail,
      title: 'Email Phishing Simulation',
      description: 'Realistic inbox scenarios that mirror real-world phishing attempts, helping you identify suspicious senders, domains, and urgency tactics.',
    },
    {
      icon: MessageSquare,
      title: 'SMS / Smishing Simulation',
      description: 'Practice detecting smishing attacks through realistic phone message mock-ups with suspicious links and social engineering patterns.',
    },
    {
      icon: Target,
      title: 'Adaptive Difficulty Engine',
      description: 'The system automatically adjusts scenario difficulty based on your accuracy, ensuring you are always challenged at the right level.',
    },
    {
      icon: BookOpen,
      title: 'Open-Text Baseline Assessment',
      description: 'A unique text-based knowledge assessment evaluated using intelligent pattern matching, measuring your existing security awareness.',
    },
    {
      icon: BarChart3,
      title: 'Performance Tracking',
      description: 'Detailed analytics on accuracy, false positives, false negatives, and improvement trends across all your simulation sessions.',
    },
    {
      icon: CheckCircle2,
      title: 'Real-Time Feedback',
      description: 'Immediate explanations after each decision, highlighting missed phishing cues and reinforcing best practices.',
    },
  ];

  const steps = [
    { step: '01', title: 'Register & Assess', description: 'Create your account and complete a baseline assessment to measure your current security awareness level.' },
    { step: '02', title: 'Run Simulations', description: 'Work through realistic email and SMS phishing scenarios adapted to your skill level.' },
    { step: '03', title: 'Learn & Improve', description: 'Receive instant feedback after each decision and track your improvement over time.' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Navigation */}
      <nav style={{ backgroundColor: '#0f2240' }} className="sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#0ea5e9' }}>
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-white font-bold text-lg leading-none block">PhishSimulator</span>
              <span className="text-xs leading-none" style={{ color: '#94a3b8' }}>Scenario-Based Phishing Awareness Training</span>
            </div>
          </div>
          <div className="flex items-center gap-3">

            <Button
              onClick={() => onNavigate('login')}
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 hover:text-white bg-transparent"
            >
              Login
            </Button>
           
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{ background: 'linear-gradient(135deg, #0f2240 0%, #1e3a5f 60%, #1e4976 100%)' }} className="px-6 py-24">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-6" style={{ backgroundColor: 'rgba(14,165,233,0.15)', color: '#38bdf8', border: '1px solid rgba(14,165,233,0.3)' }}>
            <Zap className="w-3.5 h-3.5" />
            Cybersecurity
          </div>
          <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
            Build Real Phishing<br />
            <span style={{ color: '#38bdf8' }}>Awareness Skills</span>
          </h1>
          <p className="text-xl mb-4" style={{ color: '#cbd5e1' }}>
            A Scenario-Based Gamified Phishing Awareness Training Platform
          </p>
          <p className="max-w-2xl mx-auto text-base mb-10" style={{ color: '#94a3b8' }}>
            Train against realistic email and SMS phishing simulations. Adaptive difficulty ensures you are always learning.
            Immediate feedback reinforces best practices every step of the way.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => onNavigate('register')}
              size="lg"
              className="text-white px-8 text-base"
              style={{ backgroundColor: '#0ea5e9' }}
            >
              Start Training Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              onClick={() => onNavigate('login')}
              size="lg"
              variant="outline"
              className="px-8 text-base border-white/20 text-white hover:bg-white/10 hover:text-white bg-transparent"
            >
              Login
            </Button>
          </div>
          <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto">
            {[['142+', 'Active Learners'], ['4,500+', 'Simulations Run'], ['76%', 'Avg. Accuracy Gain']].map(([val, label]) => (
              <div key={label} className="text-center">
                <div className="text-3xl font-bold text-white">{val}</div>
                <div className="text-sm mt-1" style={{ color: '#94a3b8' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3" style={{ color: '#0f2240' }}>Platform Capabilities</h2>
            <p style={{ color: '#64748b' }}>Everything you need to master phishing detection</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div key={feature.title} className="p-6 rounded-xl border border-slate-100 bg-white hover:shadow-md transition-shadow">
                <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(14,165,233,0.1)' }}>
                  <feature.icon className="w-5 h-5" style={{ color: '#0ea5e9' }} />
                </div>
                <h3 className="font-semibold mb-2" style={{ color: '#0f2240' }}>{feature.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="px-6 py-20" style={{ backgroundColor: '#f0f4f8' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3" style={{ color: '#0f2240' }}>How It Works</h2>
            <p style={{ color: '#64748b' }}>Get started in three simple steps</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold text-white" style={{ backgroundColor: '#1e3a5f' }}>
                  {s.step}
                </div>
                <h3 className="font-semibold mb-2" style={{ color: '#0f2240' }}>{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section style={{ backgroundColor: '#1e3a5f' }} className="px-6 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(14,165,233,0.2)' }}>
              <Users className="w-7 h-7" style={{ color: '#38bdf8' }} />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Test Your Awareness?</h2>
          <p className="mb-8" style={{ color: '#94a3b8' }}>
            Join other learners and strengthen your ability to identify phishing threats before they cause real harm.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => onNavigate('register')}
              size="lg"
              className="text-white px-8"
              style={{ backgroundColor: '#0ea5e9' }}
            >
              Create Free Account
            </Button>
            <Button
              onClick={() => onNavigate('login')}
              size="lg"
              variant="outline"
              className="px-8 border-white/20 text-white hover:bg-white/10 hover:text-white bg-transparent"
            >
              Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ backgroundColor: '#0f2240' }} className="px-6 py-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#0ea5e9' }}>
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-semibold">PhishSimulator</span>
          </div>
          <p className="text-sm"  style={{ color: '#64748b' }}>
            &copy; 2026 PhishSimulator &mdash; All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
