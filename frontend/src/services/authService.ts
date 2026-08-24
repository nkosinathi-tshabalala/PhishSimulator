import { apiRequest } from "./api";

class AuthService {
  async register(userData: any) {
    return await apiRequest("/auth/register", "POST", userData);
  }

  async login(credentials: any) {
    return await apiRequest("/auth/login", "POST", credentials);
  }

  async requestPasswordReset(email: string) {
    return await apiRequest("/auth/forgot-password", "POST", { email });
  }

  async getCurrentUser() {
    const token = localStorage.getItem("access_token");

    return await apiRequest("/auth/me", "GET", null, token);
  }

  async updateProfile(profileData: any) {
    const token = localStorage.getItem("access_token");

    return await apiRequest("/auth/update-profile", "PUT", profileData, token);
  }

  async changePassword(passwordData: any) {
    const token = localStorage.getItem("access_token");

    return await apiRequest(
      "/auth/change-password",
      "PUT",
      passwordData,
      token,
    );
  }

  async logout() {
    const token = localStorage.getItem("access_token");

    try {
      if (token) {
        await apiRequest("/auth/logout", "POST", null, token);
      }
    } finally {
      localStorage.removeItem("access_token");
    }
  }
}

export default new AuthService();
