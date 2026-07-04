import { useState } from 'react';
import { Shield } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface AdminLoginPageProps {
  onLogin: (role: 'player' | 'admin') => void;
  onNavigate: (page: string) => void;
}

export function AdminLoginPage({ onLogin, onNavigate }: AdminLoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin('admin');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
              <Shield className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <CardTitle className="text-2xl">PhishSimulator</CardTitle>
              <Badge variant="default">Admin</Badge>
            </div>
            <CardDescription className="mt-2">
              Administrator Portal - Manage Platform
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Admin Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@phishsimulator.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Admin Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Sign In as Administrator
            </Button>
            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={() => onNavigate('reset')}
                className="text-sm text-muted-foreground hover:underline block w-full"
              >
                Forgot password?
              </button>
              <button
                type="button"
                onClick={() => onNavigate('landing')}
                className="text-sm text-muted-foreground hover:underline block w-full"
              >
                Back to Home
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
