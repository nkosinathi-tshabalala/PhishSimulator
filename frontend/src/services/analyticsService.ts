// API calls for stats, progress and user monitoring

import { apiRequest, downloadFile } from "./api";
import { getToken } from "./session";

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
      getToken()
    );
  }

  /** Admin analytics charts, narrowed by filters such as "range=30d&channel=SMS". */
  async getAdminAnalytics(query = "") {
    return apiRequest(
      `/analytics/admin${query ? `?${query}` : ""}`,
      "GET",
      null,
      getToken()
    );
  }

  /** Every user for the admin. */
  async getMonitoredUsers() {
    return apiRequest(
      "/analytics/users",
      "GET",
      null,
      getToken()
    );
  }

  /** One user's details for the admin. */
  async getMonitoredUser(userId: number) {
    return apiRequest(
      `/analytics/users/${userId}`,
      "GET",
      null,
      getToken()
    );
  }

  /** Delete a user and their data. */
  async deleteUser(userId: number) {
    return apiRequest(
      `/analytics/users/${userId}`,
      "DELETE",
      null,
      getToken()
    );
  }

  /** Download every player's progress as CSV (rank not included). */
  async exportPlayerProgress() {
    return downloadFile(
      "/analytics/export/players.csv",
      "player_progress.csv",
      getToken()
    );
  }

  /** The signed-in player's activity per day for one year (this year when none is given). */
  async getMyActivity(year?: number) {
    return apiRequest(
      `/analytics/my-activity${year ? `?year=${year}` : ""}`,
      "GET",
      null,
      getToken()
    );
  }

  /** The signed-in player's progress, optionally narrowed by filters such as "range=7d". */
  async getMyPerformance(query = "") {
    return apiRequest(
      `/analytics/my-performance${query ? `?${query}` : ""}`,
      "GET",
      null,
      getToken()
    );
  }
}

export default new AnalyticsService();