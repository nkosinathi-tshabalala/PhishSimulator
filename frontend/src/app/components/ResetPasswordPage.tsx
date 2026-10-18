// Password reset: ask for a reset link, or (when opened from that emailed link) choose a new password

import { useState, type ReactNode } from 'react';
import { Fish, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import AuthService from '../../services/authService';
import { LIMITS, emailProblem, passwordProblem } from '../../services/validation';

interface ResetPasswordPageProps {
  onNavigate: (page: string) => void;
  /** The token from the emailed link. Without it the page asks for an email instead. */
  token?: string;
}

/** Forgot-password page: request a link, then set a new password from it. */
export function ResetPasswordPage({ onNavigate, token }: ResetPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' });
  const [done, setDone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const problem = token
      ? passwordProblem(passwords.newPassword)
        || (passwords.newPassword !== passwords.confirmPassword ? 'New passwords do not match.' : '')
      : emailProblem(email);
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    try {
      const response = token
        ? await AuthService.resetPassword(token, passwords.newPassword, passwords.confirmPassword)
        : await AuthService.requestPasswordReset(email);
      if (response.ok && response.data.success) setDone(response.data.message);
      else setError(response.data.message || 'Unable to reset the password.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <AuthCard
        icon={<CheckCircle2 className="w-8 h-8 text-green-400" />}
        iconClass="bg-green-500/10"
        title={token ? 'Password updated' : 'Request received'}
        description={token ? done : 'If an account matches this address, a reset link is on its way. It works for 30 minutes.'}
      >
        <Button onClick={() => onNavigate('login')} className="w-full">Back to Login</Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      icon={<Fish className="w-8 h-8 text-white" />}
      iconClass="bg-linear-to-br from-cyan-300 to-sky-600 shadow-lg shadow-cyan-400/25"
      title={token ? 'Choose a new password' : 'Reset Password'}
      description={token ? 'At least 8 characters with a letter and a number.' : 'Enter your email to receive a reset link'}
      onBack={() => onNavigate('login')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {token ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input id="newPassword" type="password" autoComplete="new-password" required maxLength={LIMITS.passwordMax} value={passwords.newPassword}
                onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input id="confirmPassword" type="password" autoComplete="new-password" required maxLength={LIMITS.passwordMax} value={passwords.confirmPassword}
                onChange={(event) => setPasswords({ ...passwords, confirmPassword: event.target.value })} />
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="john.doe@example.com" required maxLength={LIMITS.email} value={email}
              onChange={(event) => setEmail(event.target.value)} />
          </div>
        )}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Please wait...' : token ? 'Save new password' : 'Send Reset Link'}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </AuthCard>
  );
}

/** The centred card both reset steps sit in. */
function AuthCard({ icon, iconClass, title, description, onBack, children }: {
  icon: ReactNode;
  iconClass: string;
  title: string;
  description: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="w-fit -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Button>
          )}
          <div className="text-center">
            <div className={`mx-auto mb-4 w-16 h-16 rounded-2xl flex items-center justify-center ${iconClass}`}>{icon}</div>
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription className="mt-2">{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
