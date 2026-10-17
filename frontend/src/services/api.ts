// Sends requests to the backend. The login travels in HttpOnly cookies the browser adds by itself;
// changes also carry the CSRF token, and an expired access token is renewed once, then the request retried.

import { clearSession, csrfToken, sessionSecondsLeft, setSessionTiming } from "./session";

// Backend address. The page and the API share one address (nginx in Docker, the Vite proxy in development),
// so the login cookies are first-party and SameSite=Strict.
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

// Fired when a signed-in request is rejected because the session ended
export const SESSION_EXPIRED_EVENT = "session-expired";

const CHANGES = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// These answer 401 for a wrong password or a finished session; renewing would not help
const NO_RENEW = ["/auth/login", "/auth/refresh", "/auth/register", "/auth/forgot-password", "/auth/reset-password"];

let renewing: Promise<boolean> | null = null;

/** Swap the refresh cookie for new cookies. Concurrent callers share one renewal. */
export function renewSession(): Promise<boolean> {
  if (!renewing) {
    renewing = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-CSRF-Token": csrfToken(true) },
    })
      .then(async (response) => {
        const result = await response.json().catch(() => null);
        if (response.ok) setSessionTiming(result?.data?.session);
        else clearSession();
        return response.ok;
      })
      .catch(() => false)
      .finally(() => {
        renewing = null;
      });
  }
  return renewing;
}

function send(endpoint: string, method: string, data: unknown) {
  const headers: Record<string, string> = {};
  const options: RequestInit = { method, headers, credentials: "same-origin" };

  if (CHANGES.has(method)) {
    headers["X-CSRF-Token"] = csrfToken();
  }
  if (data instanceof FormData) {
    options.body = data;
  } else if (data !== null && data !== undefined) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(data);
  }
  return fetch(`${API_BASE_URL}${endpoint}`, options);
}

/** Sends an HTTP request to the backend API. */
export async function apiRequest(endpoint: string, method: string = "GET", data: unknown = null) {
  let response = await send(endpoint, method, data);

  // The access token lasts a few minutes: renew it once and try again
  if (response.status === 401 && !NO_RENEW.some((path) => endpoint.startsWith(path))) {
    const wasSignedIn = sessionSecondsLeft() > 0;
    if (await renewSession()) {
      response = await send(endpoint, method, data);
    } else if (wasSignedIn) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
  }

  const result = await response.json().catch(() => ({ success: false, message: describeNonJson(response.status) }));
  if (response.ok && result?.data?.session) {
    setSessionTiming(result.data.session);
  }

  return {
    ok: response.ok,
    status: response.status,
    data: result,
  };
}

/** Downloads a file (such as a CSV export) from the API and saves it. */
export async function downloadFile(endpoint: string, filename: string) {
  let response = await fetch(`${API_BASE_URL}${endpoint}`, { credentials: "same-origin" });
  if (response.status === 401 && (await renewSession())) {
    response = await fetch(`${API_BASE_URL}${endpoint}`, { credentials: "same-origin" });
  }
  if (!response.ok) {
    return false;
  }

  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

/** A readable message when the server (or the nginx proxy in front of it) answers with a page instead of JSON. */
function describeNonJson(status: number) {
  if (status === 413) {
    return "This file is larger than the upload limit. Upload a smaller file, or raise MAX_UPLOAD_MB in .env and restart.";
  }
  if (status === 429) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (status === 502 || status === 503 || status === 504) {
    return "The server took too long or stopped responding. For very large datasets, raise REQUEST_TIMEOUT_SECONDS in .env and restart.";
  }
  return `Unexpected server response (HTTP ${status}).`;
}
