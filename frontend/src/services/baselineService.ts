// API calls for the baseline quiz

import { apiRequest } from "./api";
import { getToken } from "./session";

/** API calls for the baseline quiz. */
class BaselineService {
    /** Admin: all quiz questions. */
    async getQuestions() {
        const token = getToken();

        return await apiRequest(
            "/baseline/questions",
            "GET",
            null,
            token
        );

    }

    /** Admin: add a question. */
    async createQuestion(data: any) {
        const token = getToken();

        return await apiRequest(
            "/baseline/questions",
            "POST",
            data,
            token
        );

    }

    /** Admin: edit a question. */
    async updateQuestion(id: number, data: any) {
        const token = getToken();

        return await apiRequest(
            `/baseline/questions/${id}`,
            "PUT",
            data,
            token
        );

    }

    /** Admin: delete a question. */
    async deleteQuestion(id: number) {
        const token = getToken();

        return await apiRequest(
            `/baseline/questions/${id}`,
            "DELETE",
            null,
            token
        );

    }

    /** Admin: one question. */
    async getQuestion(id: number) {
        const token = getToken();

        return await apiRequest(
            `/baseline/questions/${id}`,
            "GET",
            null,
            token
        );

    }

    /** The player's last completed quiz. */
    async getLatestResult() {
        const token = getToken();

        return await apiRequest(
            "/baseline/latest-result",
            "GET",
            null,
            token
        );
    }

    /** Start a new quiz. */
    async startAssessment(data: any) {
        const token = getToken();

        return await apiRequest(
            "/baseline/start",
            "POST",
            data,
            token
        );

    }

    /** Save one answer. */
    async submitResponse(data: any) {
        const token = getToken();

        return await apiRequest(
            "/baseline/submit-response",
            "POST",
            data,
            token
        );

    }

    /** Finish the quiz and get the result. */
    async completeAssessment(data: any) {
        const token = getToken();

        return await apiRequest(
            "/baseline/complete",
            "POST",
            data,
            token
        );

    }

}

export default new BaselineService();