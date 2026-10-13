// API calls for accounts and signing in

import { apiRequest } from "./api";
import { getToken, clearToken } from "./session";

/** API calls for accounts and signing in. */
class AuthService {
  /** Create a player account. */
  async register(userData: any) {
    return await apiRequest("/auth/register", "POST", userData);
  }

  /** Sign in and get a token. */
  async login(credentials: any) {
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

  /** The signed-in user's details. */
  async getCurrentUser() {
    const token = getToken();

    return await apiRequest("/auth/me", "GET", null, token);
  }

  /** Save profile changes. */
  async updateProfile(profileData: any) {
    const token = getToken();

    return await apiRequest("/auth/update-profile", "PUT", profileData, token);
  }

  /** Change the password. */
  async changePassword(passwordData: any) {
    const token = getToken();

    return await apiRequest(
      "/auth/change-password",
      "PUT",
      passwordData,
      token,
    );
  }

  /** Sign out and forget the token. */
  async logout() {
    const token = getToken();

    try {
      if (token) {
        await apiRequest("/auth/logout", "POST", null, token);
      }
    } finally {
      clearToken();
    }
  }
}

export default new AuthService();
