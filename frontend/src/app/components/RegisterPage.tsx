// Registration page for new players

import { useState } from "react";

import AuthService from "../../services/authService";

import { ArrowLeft, Fish, CheckCircle2, AlertCircle } from "lucide-react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";

import { RadioGroup, RadioGroupItem } from "./ui/radio-group";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface RegisterPageProps {
  onNavigate: (page: string) => void;
  onRegister: () => void;
}

/** Registration form for new players. */
export function RegisterPage({ onNavigate, onRegister }: RegisterPageProps) {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    age: "",
    itBackground: "no",
    role: "",
    campaignConsent: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const response = await AuthService.register({
        full_name: formData.fullName,
        email: formData.email,
        password: formData.password,
        confirm_password: formData.confirmPassword,
        age: Number(formData.age),
        it_background: formData.itBackground === "yes",
        occupation: formData.role.toUpperCase(),
        campaign_consent: formData.campaignConsent,
      });

      if (!response.ok) {
        setErrorMessage(response.data.message);
        return;
      }

      setSuccessMessage(
        "Your account has been created successfully. Redirecting you to the login page...",
      );

      setTimeout(() => {
        onRegister();
      }, 2000);
    } catch (error) {
      setErrorMessage("Unable to create your account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <div
        className="relative hidden w-1/2 overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(11,18,33,0.85) 0%, rgba(11,18,33,0.7) 60%, rgba(11,18,33,0.95) 100%), url('/assets/IMG_5596.jpeg')",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-cyan-300 to-sky-600 shadow-lg shadow-cyan-400/25">
            <Fish className="h-5 w-5 text-slate-950" />
          </span>
          <span className="text-sm font-semibold tracking-[0.12em] text-white">PHISHSIMULATOR</span>
        </div>
        <div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight text-white">
            Build the habits that stop phishing before it starts.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">
            Create your learner account to start adaptive, scenario-based training.
          </p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center p-4 lg:w-1/2">
      <Card className="w-full max-w-xl">
        <CardHeader className="space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate("landing")}
            className="w-fit -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>

          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-cyan-300 to-sky-600 shadow-lg shadow-cyan-400/25 flex items-center justify-center">
                <Fish className="w-8 h-8 text-slate-950" />
              </div>
            </div>

            <CardTitle className="text-2xl">Create Account</CardTitle>

            <CardDescription className="mt-2">
              Join PhishSimulator to begin your phishing awareness training.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>

              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={formData.fullName}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    fullName: e.target.value,
                  })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>

              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    email: e.target.value,
                  })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>

              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    password: e.target.value,
                  })
                }
                autoComplete="new-password"
                required
              />
              <p className="text-xs text-muted-foreground">At least 8 characters with a letter and a number.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>

              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    confirmPassword: e.target.value,
                  })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>

              <Input
                id="age"
                type="number"
                placeholder="25"
                value={formData.age}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    age: e.target.value,
                  })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label>IT Background</Label>

              <RadioGroup
                value={formData.itBackground}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    itBackground: value,
                  })
                }
              >
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="it-yes" />
                    <Label htmlFor="it-yes" className="font-normal">
                      Yes
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="it-no" />
                    <Label htmlFor="it-no" className="font-normal">
                      No
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Occupation</Label>

              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    role: value,
                  })
                }
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select your occupation" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>

                  <SelectItem value="employee">Employee</SelectItem>

                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4 accent-sky-500 shrink-0"
                checked={formData.campaignConsent}
                onChange={(event) => setFormData({ ...formData, campaignConsent: event.target.checked })}
              />
              <span className="text-sm">
                <span className="font-medium">Send me simulated phishing emails (optional)</span>
                <span className="block text-xs text-muted-foreground">
                  I agree that the training admin may send safe test emails to this address to see whether I report
                  them. Nothing harmful is ever sent, and I can withdraw this in my profile at any time.
                </span>
              </span>
            </label>

            {successMessage && (
              <Alert className="border-green-500/30 bg-green-500/10">
                <CheckCircle2 className="h-4 w-4 text-green-400" />

                <AlertTitle className="text-green-400">
                  Registration Successful
                </AlertTitle>

                <AlertDescription className="text-green-400/80">
                  {successMessage}
                </AlertDescription>
              </Alert>
            )}

            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />

                <AlertTitle>Registration Failed</AlertTitle>

                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || successMessage !== ""}
            >
              {isLoading ? "Creating Account..." : "Register"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => onNavigate("login")}
                className="text-sm text-muted-foreground hover:underline"
              >
                Already have an account? Login
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
