// API calls for scenarios and submitting answers

import { apiRequest } from "./api";
import type { Channel, Decision } from "../types/catch";

export type ReviewAction = "approve" | "reject" | "activate" | "archive" | "reopen";
export type QaChecklist = Record<string, boolean>;
export type ScenarioFilters = Record<string, string | number | null | undefined>;


/** API calls for scenarios and attempts. */
class ScenarioService {
  /** The next scenario for the player. */
  async getRandomScenario(type: Channel, includeCompleted = false, category?: string | null) {
    const params = new URLSearchParams({ include_completed: String(includeCompleted) });
    if (category) params.set("category", category);

    return apiRequest(`/scenarios/random/${type}?${params}`, "GET", null);
  }

  /** A scenario the player got wrong earlier. */
  async getReviewScenario(type: Channel) {
    return apiRequest(`/scenarios/review/${type}`, "GET", null);
  }

  /** Send a decision and its reasons to be scored. */
  async submitAttempt(data: {
    scenario_id: number;
    player_answer: Decision;
    selected_clues: string[];
    justification: string;
    clicked_link?: boolean;
    opened_attachment?: boolean;
  }) {
    return apiRequest("/simulation/attempt", "POST", data);
  }

  /** Admin: scenarios in pages, with filters. */
  async getScenarios(page = 1, filters: ScenarioFilters = {}) {
    const params = new URLSearchParams({ page: String(page), per_page: "25" });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, String(value));
    });

    return apiRequest(`/scenarios?${params}`, "GET", null);
  }

  /** Admin: one scenario. */
  async getScenario(scenarioId: number) {
    return apiRequest(`/scenarios/${scenarioId}`, "GET", null);
  }

  /** Admin: add a scenario. */
  async createScenario(data: object) {
    return apiRequest("/scenarios", "POST", data);
  }

  /** Admin: edit a scenario. */
  async updateScenario(scenarioId: number, data: object) {
    return apiRequest(`/scenarios/${scenarioId}`, "PUT", data);
  }

  /** Admin: delete a scenario. */
  async deleteScenario(scenarioId: number) {
    return apiRequest(`/scenarios/${scenarioId}`, "DELETE", null);
  }

  /** Admin: approve, reject, activate or archive a scenario. */
  async reviewScenario(scenarioId: number, action: ReviewAction, checklist?: QaChecklist) {
    return apiRequest(`/scenarios/${scenarioId}/review`, "POST", { action, checklist });
  }

  /** Admin: review every matching scenario (preview returns the count). */
  async bulkReview(action: ReviewAction, filters: ScenarioFilters, checklist?: QaChecklist, preview = false) {
    return apiRequest("/scenarios/bulk-review", "POST", { action, filters, checklist, preview });
  }
}

export default new ScenarioService();
