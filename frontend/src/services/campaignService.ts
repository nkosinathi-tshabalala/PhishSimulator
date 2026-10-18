// API calls for email phishing campaigns (admin only)

import { apiRequest } from "./api";

/** An email the admin writes themselves instead of using a scenario. */
export interface CustomEmail {
  sender: string;
  subject: string;
  message: string;
  is_phishing: boolean;
  cues: string[];
  /** File name of a look-alike attachment (no real file is sent). */
  attachment?: string;
}


/** Admin-only email phishing campaigns. All sending happens on the backend. */
class CampaignService {
  /** Data the campaign page needs. */
  async getContext() {
    return apiRequest("/campaigns", "GET", null);
  }

  /** Save a draft campaign for the chosen players: from a scenario, or a custom email the admin wrote. */
  async createCampaign(source: { scenarioId: number } | { custom: CustomEmail }, name: string, recipients: string[]) {
    const email = "custom" in source ? { custom: source.custom } : { scenario_id: source.scenarioId };
    return apiRequest("/campaigns", "POST", { ...email, name, recipients });
  }

  /** Player: results of the campaign emails sent to them. */
  async getInbox() {
    return apiRequest("/campaigns/inbox", "GET", null);
  }

  /** Player: they opened the feedback for one result. */
  async markSeen(resultId: number) {
    return apiRequest(`/campaigns/inbox/${resultId}/seen`, "POST", null);
  }

  /** Send a campaign. */
  async launchCampaign(campaignId: number) {
    return apiRequest(`/campaigns/${campaignId}/launch`, "POST", null);
  }

  /** A campaign's results. */
  async getReport(campaignId: number) {
    return apiRequest(`/campaigns/${campaignId}`, "GET", null);
  }

  /** Public: who a training email was sent to and its warning signs (for the caught / reported pages). */
  async getLanding(trackingToken: string) {
    return apiRequest(`/campaigns/landing/${encodeURIComponent(trackingToken)}`, "GET");
  }

  /** Delete a campaign that was never successfully sent. */
  async deleteCampaign(campaignId: number) {
    return apiRequest(`/campaigns/${campaignId}`, "DELETE", null);
  }
}

export default new CampaignService();
