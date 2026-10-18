// Admin page: account details and password

import { useState } from "react";
import { KeyRound, ShieldCheck, UserCog } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { PageHeader } from "./PageHeader";
import AuthService from "../../services/authService";
import { LIMITS, passwordProblem } from "../../services/validation";

interface CurrentUser {
  full_name: string;
  email: string;
  /** The address as shown: a test player's alias of the demo inbox hides that inbox. */
  email_display?: string;
  role: string;
}

interface AdminProfilePageProps {
  user: CurrentUser | null;
  onBack: () => void;
}

const EMPTY_PASSWORDS = { currentPassword: "", newPassword: "", confirmPassword: "" };

/** Admin account details (read-only) and password change. */
export function AdminProfilePage({ user, onBack }: AdminProfilePageProps) {
  const [passwords, setPasswords] = useState(EMPTY_PASSWORDS);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const setField = (key: keyof typeof EMPTY_PASSWORDS, value: string) =>
    setPasswords((current) => ({ ...current, [key]: value }));

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (passwords.currentPassword === passwords.newPassword) {
      setMessage({ ok: false, text: "Your new password must be different from your current password." });
      return;
    }
    const problem = passwordProblem(passwords.newPassword)
      || (passwords.newPassword !== passwords.confirmPassword ? "New passwords do not match." : "");
    if (problem) {
      setMessage({ ok: false, text: problem });
      return;
    }

    setIsSaving(true);
    try {
      const response = await AuthService.changePassword({
        current_password: passwords.currentPassword,
        new_password: passwords.newPassword,
        confirm_password: passwords.confirmPassword,
      });
      setMessage({ ok: response.ok, text: response.data.message });
      if (response.ok) setPasswords(EMPTY_PASSWORDS);
    } catch {
      setMessage({ ok: false, text: "Unable to change password. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Admin Profile"
        description="Your administrator account and password"
        icon={UserCog}
        tone="bg-amber-500/15 text-amber-300"
        onBack={onBack}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Account</CardTitle>
              <CardDescription>Administrator accounts are created by the setup script and have no player profile.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={user?.email_display ?? user?.email ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input id="role" value="Administrator" disabled />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><KeyRound className="w-4 h-4" /> Change Password</CardTitle>
              <CardDescription>At least 8 characters with a letter and a number.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={changePassword} className="space-y-4">
                {([
                  ["currentPassword", "Current Password", "current-password"],
                  ["newPassword", "New Password", "new-password"],
                  ["confirmPassword", "Confirm New Password", "new-password"],
                ] as const).map(([key, label, autoComplete]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key}>{label}</Label>
                    <Input id={key} type="password" required maxLength={LIMITS.passwordMax} autoComplete={autoComplete}
                      value={passwords[key]} onChange={(event) => setField(key, event.target.value)} />
                  </div>
                ))}

                {message && (
                  <div className={`rounded-md border p-3 text-sm ${message.ok
                    ? "border-green-500/30 bg-green-500/10 text-green-400"
                    : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
                    {message.text}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isSaving}>
                  {isSaving ? "Updating Password..." : "Update Password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
