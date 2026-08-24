import { apiRequest } from "./api";

class AnalyticsService {
  async getPublicPlatformSummary() {
    return apiRequest("/analytics/public-summary");
  }

  async getAdminDashboardStats() {
    return apiRequest(
      "/analytics/admin-dashboard",
      "GET",
      null,
      localStorage.getItem("access_token")
    );
  }

  async getAdminAnalytics() {
    return apiRequest(
      "/analytics/admin",
      "GET",
      null,
      localStorage.getItem("access_token")
    );
  }

  async getMonitoredUsers() {
    return apiRequest(
      "/analytics/users",
      "GET",
      null,
      localStorage.getItem("access_token")
    );
  }

  async getMonitoredUser(userId: number) {
    return apiRequest(
      `/analytics/users/${userId}`,
      "GET",
      null,
      localStorage.getItem("access_token")
    );
  }

  async deleteUser(userId: number) {
    return apiRequest(
      `/analytics/users/${userId}`,
      "DELETE",
      null,
      localStorage.getItem("access_token")
    );
  }

  async getMyPerformance() {
    return apiRequest(
      "/analytics/my-performance",
      "GET",
      null,
      localStorage.getItem("access_token")
    );
  }
}

export default new AnalyticsService();