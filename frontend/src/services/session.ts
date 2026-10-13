// The login for THIS browser tab. sessionStorage belongs to one tab, so an admin in one tab and a player
// in another stay signed in side by side. Refreshing a tab keeps its login; closing the tab ends it.

const TOKEN_KEY = "access_token";

// Logins used to be shared by every tab (localStorage). Remove any old shared token.
try {
  localStorage.removeItem(TOKEN_KEY);
} catch {
  // Storage can be blocked (private mode); there is then nothing to clean up
}

/** This tab's login token, or null when signed out. */
export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

/** Save this tab's login token. */
export function setToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

/** Sign this tab out (other tabs keep their own login). */
export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}
