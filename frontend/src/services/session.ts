// The login lives in HttpOnly cookies set by the server: page scripts cannot read the tokens, so a
// cross-site scripting bug could not steal them. This module only keeps what the page may know:
// when the session ends if idle (to warn the user), and the CSRF token that every change must repeat.
// The cookies are shared by every tab of this site, so all tabs share one login.

const CSRF_COOKIE = "ps_csrf";
const CSRF_REFRESH_COOKIE = "ps_csrf_refresh";

// Older versions kept the login token in browser storage. Remove any that is left.
try {
  localStorage.removeItem("access_token");
  sessionStorage.removeItem("access_token");
} catch {
  // Storage can be blocked (private mode); there is then nothing to clean up
}

let idleEndsAt = 0;

/** A cookie's value, or "" (only the readable CSRF cookies; the tokens themselves are HttpOnly). */
function readCookie(name: string) {
  const prefix = `${name}=`;
  const found = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : "";
}

/** The CSRF token for a change (POST, PUT, PATCH, DELETE), or for renewing the session. */
export function csrfToken(forRefresh = false) {
  return readCookie(forRefresh ? CSRF_REFRESH_COOKIE : CSRF_COOKIE);
}

/** True when this browser may still have a session (the server decides; this only avoids needless calls). */
export function mightBeSignedIn() {
  return Boolean(csrfToken() || csrfToken(true));
}

/** Remember when the session ends if idle, from the server's reply ({ idle_expires_in: seconds }). */
export function setSessionTiming(timing: { idle_expires_in?: number } | null | undefined) {
  if (timing && typeof timing.idle_expires_in === "number") {
    idleEndsAt = Date.now() + timing.idle_expires_in * 1000;
  }
}

/** Seconds until the session ends if nothing renews it (0 when signed out). */
export function sessionSecondsLeft() {
  return idleEndsAt ? Math.max(0, Math.round((idleEndsAt - Date.now()) / 1000)) : 0;
}

/** Forget this page's view of the session (the server clears the cookies on logout). */
export function clearSession() {
  idleEndsAt = 0;
}
