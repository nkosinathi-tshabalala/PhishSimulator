// API calls for baseline assessments (CATCH "Check")

import { apiRequest } from "./api";
import { getToken } from "./session";

/** API calls for baseline assessments. */
class BaselineService {
    // ---------- admin: baseline assessments ----------

    /** Admin: every baseline assessment with its questions, by role. */
    async getTemplates() {
        return await apiRequest("/baseline/templates", "GET", null, getToken());
    }

    /** Admin: add an empty baseline assessment for a role. */
    async createTemplate(data: { name?: string; occupation: string | null; description?: string }) {
        return await apiRequest("/baseline/templates", "POST", data, getToken());
    }

    /** Admin: rename an assessment or change its role or description. */
    async updateTemplate(id: number, data: { name: string; occupation: string | null; description?: string }) {
        return await apiRequest(`/baseline/templates/${id}`, "PUT", data, getToken());
    }

    /** Admin: delete an assessment nobody has taken. */
    async deleteTemplate(id: number) {
        return await apiRequest(`/baseline/templates/${id}`, "DELETE", null, getToken());
    }

    /** Admin: switch an assessment on or off for its role. */
    async setTemplateActive(id: number, active: boolean) {
        return await apiRequest(`/baseline/templates/${id}/active`, "POST", { active }, getToken());
    }

    /** Admin: add the template-bank assessments and questions that are not here yet. */
    async loadTemplateBank() {
        return await apiRequest("/baseline/templates/load-bank", "POST", null, getToken());
    }

    // ---------- admin: questions ----------

    /** Admin: add a question to an assessment. */
    async createQuestion(data: any) {
        return await apiRequest("/baseline/questions", "POST", data, getToken());
    }

    /** Admin: edit a question (or move it to another assessment). */
    async updateQuestion(id: number, data: any) {
        return await apiRequest(`/baseline/questions/${id}`, "PUT", data, getToken());
    }

    /** Admin: delete a question. */
    async deleteQuestion(id: number) {
        return await apiRequest(`/baseline/questions/${id}`, "DELETE", null, getToken());
    }

    // ---------- players ----------

    /** The player's baseline assessments: new ones and ones already taken. */
    async getAvailable() {
        return await apiRequest("/baseline/available", "GET", null, getToken());
    }

    /** One of the player's completed results. */
    async getResult(assessmentId: number) {
        return await apiRequest(`/baseline/assessments/${assessmentId}`, "GET", null, getToken());
    }

    /** The player's last completed assessment. */
    async getLatestResult() {
        return await apiRequest("/baseline/latest-result", "GET", null, getToken());
    }

    /** Start a baseline assessment (the chosen one, or the first one not taken yet). */
    async startAssessment(data: { template_id?: number } = {}) {
        return await apiRequest("/baseline/start", "POST", data, getToken());
    }

    /** Save one answer. */
    async submitResponse(data: any) {
        return await apiRequest("/baseline/submit-response", "POST", data, getToken());
    }

    /** Finish the assessment and get the result. */
    async completeAssessment(data: any) {
        return await apiRequest("/baseline/complete", "POST", data, getToken());
    }
}

export default new BaselineService();
