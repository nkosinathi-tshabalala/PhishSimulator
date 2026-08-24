import { apiRequest } from "./api";

class EmailService {
  private getToken() {
    return localStorage.getItem("access_token");
  }

  async getDispatcherContext() {
    return apiRequest("/email/dispatcher", "GET", null, this.getToken());
  }

  async createCampaign(
    scenarioId: number,
    name: string,
    targetOccupation: string | null,
  ) {
    return apiRequest(
      "/email/dispatcher/campaigns",
      "POST",
      { scenario_id: scenarioId, name, target_occupation: targetOccupation },
      this.getToken(),
    );
  }

  async launchCampaign(campaignId: number) {
    return apiRequest(
      `/email/dispatcher/campaigns/${campaignId}/launch`,
      "POST",
      null,
      this.getToken(),
    );
  }

  async getCampaignReport(campaignId: number) {
    return apiRequest(
      `/email/dispatcher/campaigns/${campaignId}/report`,
      "GET",
      null,
      this.getToken(),
    );
  }
}

export default new EmailService();