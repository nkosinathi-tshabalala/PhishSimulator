// API calls for accounts and signing in. The server keeps the session and sets HttpOnly cookies;
// no token ever passes through this code.

import { apiRequest, renewSession } from "./api";
import { clearSession } from "./session";

/** API calls for accounts and signing in. */
class AuthService {
  /** Create a player account. */
  async register(userData: Record<string, unknown>) {
    return await apiRequest("/auth/register", "POST", userData);
  }

  /** Sign in. The server answers with the session timing and sets the login cookies. */
  async login(credentials: { email: string; password: string }) {
    return await apiRequest("/auth/login", "POST", credentials);
  }

  /** Ask for a password reset email. */
  async requestPasswordReset(email: string) {
    return await apiRequest("/auth/forgot-password", "POST", { email });
  }

  /** Set a new password using the token from the reset email. */
  async resetPassword(token: string, newPassword: string, confirmPassword: string) {
    return await apiRequest("/auth/reset-password", "POST", {
      token,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
  }

  /** The signed-in user's details (and when the session ends if idle). */
  async getCurrentUser() {
    return await apiRequest("/auth/me", "GET");
  }

  /** Keep the session going (new cookies; the old refresh token stops working). */
  async refresh() {
    return await renewSession();
  }

  /** Save profile changes. */
  async updateProfile(profileData: Record<string, unknown>) {
    return await apiRequest("/auth/update-profile", "PUT", profileData);
  }

  /** Change the password. Other devices signed in to this account are signed out. */
  async changePassword(passwordData: Record<string, unknown>) {
    return await apiRequest("/auth/change-password", "PUT", passwordData);
  }

  /** Sign out: the server ends the session and clears the cookies. */
  async logout() {
    try {
      await apiRequest("/auth/logout", "POST");
    } finally {
      clearSession();
    }
  }
}

export default new AuthService();
