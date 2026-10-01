// Keeps active users signed in and warns idle users before the login runs out

import { useEffect, useRef, useState } from "react";
import { Clock, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";
import AuthService from "../../services/authService";
import { SESSION_EXPIRED_EVENT } from "../../services/api";

interface SessionWatcherProps {
  onSignInAgain: () => void;
  onLogout: () => void;
}

// Warn idle users when the login has less than 5 minutes left
const WARN_SECONDS = 5 * 60;
// Clicking, typing or scrolling in the last 5 minutes counts as active
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

/** Seconds until the stored login expires (0 if there is none). */
function secondsLeft() {
  const token = localStorage.getItem("access_token");
  if (!token) return 0;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return Math.max(0, Math.round(payload.exp - Date.now() / 1000));
  } catch {
    return 0;
  }
}

/** Seconds as m:ss. */
function formatCountdown(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Keeps active users signed in and warns idle users before the login runs out. */
export function SessionWatcher({ onSignInAgain, onLogout }: SessionWatcherProps) {
  const [remaining, setRemaining] = useState(secondsLeft());
  const [isExpired, setIsExpired] = useState(false);
  const lastActivity = useRef(Date.now());
  const isRenewing = useRef(false);

  const renew = async () => {
    if (isRenewing.current) return;
    isRenewing.current = true;
    await AuthService.getCurrentUser();
    isRenewing.current = false;
    setRemaining(secondsLeft());
  };

  useEffect(() => {
    const markActive = () => {
      lastActivity.current = Date.now();
    };
    const events = ["click", "keydown", "scroll", "mousemove", "touchstart"];
    events.forEach((name) => window.addEventListener(name, markActive, { passive: true }));
    return () => events.forEach((name) => window.removeEventListener(name, markActive));
  }, []);

  useEffect(() => {
    const handleExpired = () => setIsExpired(true);
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const left = secondsLeft();
      setRemaining(left);

      if (left === 0) {
        setIsExpired(true);
        return;
      }
      const isActive = Date.now() - lastActivity.current < ACTIVE_WINDOW_MS;
      if (left < WARN_SECONDS && isActive) {
        renew();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (isExpired) {
    return (
      <SessionDialog
        icon={<LogIn className="w-6 h-6 text-sky-300" />}
        title="Your session has ended"
        text="You were away for a while, so we signed you out to keep your account safe. Your progress is saved."
      >
        <Button className="w-full" onClick={onSignInAgain}>
          <LogIn className="w-4 h-4" />
          Sign in again
        </Button>
      </SessionDialog>
    );
  }

  const isIdle = Date.now() - lastActivity.current >= ACTIVE_WINDOW_MS;
  if (isIdle && remaining > 0 && remaining < WARN_SECONDS) {
    return (
      <SessionDialog
        icon={<Clock className="w-6 h-6 text-amber-300" />}
        title="Are you still there?"
        text={`To keep your account safe, you will be signed out in ${formatCountdown(remaining)}.`}
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <Button className="flex-1" onClick={renew}>
            <ShieldCheck className="w-4 h-4" />
            Stay signed in
          </Button>
          <Button className="flex-1" variant="outline" onClick={onLogout}>
            <LogOut className="w-4 h-4" />
            Log out
          </Button>
        </div>
      </SessionDialog>
    );
  }

  return null;
}

/** Overlay used for the session warning and the ended message. */
function SessionDialog({ icon, title, text, children }: {
  icon: React.ReactNode;
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-4 animate-in fade-in">
      <div role="alertdialog" aria-modal="true" className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d1628] p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">{icon}</div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-2 mb-5 text-sm text-muted-foreground">{text}</p>
        {children}
      </div>
    </div>
  );
}
