import { apiRequest } from "./api";

class ScenarioService {
  async getScenarios(page = 1, perPage = 25) {
    const token = localStorage.getItem("access_token");

    return await apiRequest(`/scenarios?page=${page}&per_page=${perPage}`, "GET", null, token);
  }

  async createScenario(data: any) {
    const token = localStorage.getItem("access_token");

    return await apiRequest("/scenarios", "POST", data, token);
  }

  async getScenario(scenarioId: number) {
    const token = localStorage.getItem("access_token");

    return await apiRequest(`/scenarios/${scenarioId}`, "GET", null, token);
  }

  async updateScenario(scenarioId: number, data: any) {
    const token = localStorage.getItem("access_token");

    return await apiRequest(`/scenarios/${scenarioId}`, "PUT", data, token);
  }

  async deleteScenario(scenarioId: number) {
    const token = localStorage.getItem("access_token");

    return await apiRequest(`/scenarios/${scenarioId}`, "DELETE", null, token);
  }

  async getRandomScenario(type: string, includeCompleted = false) {
    const token = localStorage.getItem("access_token");

    return await apiRequest(
      `/scenarios/random/${type}?include_completed=${includeCompleted}`,
      "GET",
      null,
      token
    );
  }

  async evaluateAnswer(data: any) {
    const token = localStorage.getItem("access_token");

    return await apiRequest("/scenarios/evaluate", "POST", data, token);
  }

  async saveAttempt(data: {
    scenario_id: number;
    simulation_type: string;
    player_answer: string;
    correct: boolean;
    score: number;
  }) {
    const token = localStorage.getItem("access_token");

    return await apiRequest("/simulation/attempt", "POST", data, token);
  }
}

export default new ScenarioService();
