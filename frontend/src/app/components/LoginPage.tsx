// Sign-in page

import { useState } from "react";

import AuthService from "../../services/authService";

import {
  Fish,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "./ui/alert";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";

interface LoginPageProps {
  onLogin: (role: "player" | "admin") => void;
  onNavigate: (page: string) => void;
  notice?: string;
  /** Pre-fills the email, e.g. for the recipient of a training email. */
  initialEmail?: string;
}

/** Sign-in form. */
export function LoginPage({
  onLogin,
  onNavigate,
  notice,
  initialEmail = "",
}: LoginPageProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    setIsLoading(true);

    try {
      const response = await AuthService.login({
        email,
        password,
      });

      if (!response.ok) {
        setErrorMessage(response.data.message);

        return;

      }

      localStorage.setItem(
        "access_token",
        response.data.data.access_token
      );

      setSuccessMessage(
        "Login successful. Redirecting to your dashboard..."
      );

      setTimeout(() => {
        const role =
          response.data.data.role.toLowerCase();

        onLogin(role);

      }, 1500);

    } catch (error) {
      console.error(error);

      setErrorMessage(
        "We couldn't connect right now. Please try again in a moment."
      );

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
            "linear-gradient(180deg, rgba(5,8,12,0.85) 0%, rgba(5,8,12,0.7) 60%, rgba(5,8,12,0.95) 100%), url('/assets/IMG_5596.jpeg')",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-sky-400 to-indigo-500 shadow-lg shadow-sky-500/20">
            <Fish className="h-5 w-5 text-white" />
          </span>
          <span className="text-sm font-semibold tracking-[0.12em] text-white">PHISHSIMULATOR</span>
        </div>
        <div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight text-white">
            Sharpen your instincts against real-world phishing tactics.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">
            Sign in to continue your scenario-based training and track your progress over time.
          </p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center p-4 lg:w-1/2">
        <Card className="w-full max-w-md">

        <CardHeader className="space-y-4 text-center">

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate("landing")}
            className="w-fit -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>

          <div className="flex justify-center">

            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-sky-400 to-indigo-500 shadow-lg shadow-sky-500/20">

              <Fish className="h-8 w-8 text-white" />

            </div>

          </div>

          <div>

            <CardTitle className="text-2xl">
              PhishSimulator
            </CardTitle>

            <CardDescription className="mt-2">
              Scenario-Based Gamified Phishing Awareness Training
            </CardDescription>

          </div>

        </CardHeader>

        <CardContent>

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >

            <div className="space-y-2">

              <Label htmlFor="email">
                Email
              </Label>

              <Input
                id="email"
                type="email"
                placeholder="student@university.edu"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                required
              />

            </div>

            <div className="space-y-2">

              <Label htmlFor="password">
                Password
              </Label>

              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                required
              />

            </div>

            {notice && !errorMessage && !successMessage && (
              <Alert className="border-amber-500/30 bg-amber-500/10">
                <AlertCircle className="h-4 w-4 text-amber-300" />
                <AlertDescription className="text-amber-200">{notice}</AlertDescription>
              </Alert>
            )}

            {successMessage && (

              <Alert className="border-green-500/30 bg-green-500/10">

                <CheckCircle2 className="h-4 w-4 text-green-400" />

                <AlertTitle className="text-green-400">
                  Login Successful
                </AlertTitle>

                <AlertDescription className="text-green-400/80">
                  {successMessage}
                </AlertDescription>

              </Alert>

            )}

            {errorMessage && (

              <Alert variant="destructive">

                <AlertCircle className="h-4 w-4" />

                <AlertTitle>
                  Login Failed
                </AlertTitle>

                <AlertDescription>
                  {errorMessage}
                </AlertDescription>

              </Alert>

            )}

            <Button
              type="submit"
              className="w-full"
              disabled={
                isLoading ||
                successMessage !== ""
              }
            >
              {isLoading
                ? "Signing In..."
                : "Sign In"}
            </Button>

            <div className="space-y-2 text-center">

              <button
                type="button"
                onClick={() =>
                  onNavigate("reset")
                }
                className="text-muted-foreground block w-full text-sm hover:underline"
              >
                Forgot password?
              </button>

              <button
                type="button"
                onClick={() =>
                  onNavigate("register")
                }
                className="text-muted-foreground block w-full text-sm hover:underline"
              >
                Don't have an account? Register
              </button>

            </div>

          </form>

        </CardContent>

        </Card>
      </div>
    </div>
  );
}