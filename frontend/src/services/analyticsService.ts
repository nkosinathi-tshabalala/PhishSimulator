// API calls for stats, progress and user monitoring

import { apiRequest, downloadFile } from "./api";

/** API calls for stats and user monitoring. */
class AnalyticsService {
  /** Public totals for the landing page. */
  async getPublicPlatformSummary() {
    return apiRequest("/analytics/public-summary");
  }

  /** Admin dashboard numbers. */
  async getAdminDashboardStats() {
    return apiRequest(
      "/analytics/admin-dashboard",
      "GET",
      null,
      localStorage.getItem("access_token")
    );
  }

  /** Admin analytics charts, narrowed by filters such as "range=30d&channel=SMS". */
  async getAdminAnalytics(query = "") {
    return apiRequest(
      `/analytics/admin${query ? `?${query}` : ""}`,
      "GET",
      null,
      localStorage.getItem("access_token")
    );
  }

  /** Every user for the admin. */
  async getMonitoredUsers() {
    return apiRequest(
      "/analytics/users",
      "GET",
      null,
      localStorage.getItem("access_token")
    );
  }

  /** One user's details for the admin. */
  async getMonitoredUser(userId: number) {
    return apiRequest(
      `/analytics/users/${userId}`,
      "GET",
      null,
      localStorage.getItem("access_token")
    );
  }

  /** Delete a user and their data. */
  async deleteUser(userId: number) {
    return apiRequest(
      `/analytics/users/${userId}`,
      "DELETE",
      null,
      localStorage.getItem("access_token")
    );
  }

  /** Download every player's progress as CSV (rank not included). */
  async exportPlayerProgress() {
    return downloadFile(
      "/analytics/export/players.csv",
      "player_progress.csv",
      localStorage.getItem("access_token")
    );
  }

  /** The signed-in player's progress, optionally narrowed by filters such as "range=7d". */
  async getMyPerformance(query = "") {
    return apiRequest(
      `/analytics/my-performance${query ? `?${query}` : ""}`,
      "GET",
      null,
      localStorage.getItem("access_token")
    );
  }
}

export default new AnalyticsService();