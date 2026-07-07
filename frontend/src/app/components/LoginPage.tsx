import { useState } from "react";

import AuthService from "../../services/authService";

import {
  Shield,
  CheckCircle2,
  AlertCircle,
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
}

export function LoginPage({
  onLogin,
  onNavigate,
}: LoginPageProps) {

  const [email, setEmail] = useState("");
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

      // Store JWT locally
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
        "Unable to sign in. Please try again."
      );

    } finally {

      setIsLoading(false);

    }

  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">

      <Card className="w-full max-w-md">

        <CardHeader className="space-y-4 text-center">

          <div className="flex justify-center">

            <div className="bg-primary flex h-16 w-16 items-center justify-center rounded-full">

              <Shield className="text-primary-foreground h-8 w-8" />

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

            {successMessage && (

              <Alert className="border-green-200 bg-green-50">

                <CheckCircle2 className="h-4 w-4 text-green-600" />

                <AlertTitle className="text-green-700">
                  Login Successful
                </AlertTitle>

                <AlertDescription className="text-green-600">
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
  );
}