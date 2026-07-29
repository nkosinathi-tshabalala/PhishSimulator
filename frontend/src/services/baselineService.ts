import { apiRequest } from "./api";

class BaselineService {

    async getQuestions() {

        const token = localStorage.getItem("access_token");

        return await apiRequest(
            "/baseline/questions",
            "GET",
            null,
            token
        );

    }

    async createQuestion(data: any) {

        const token = localStorage.getItem("access_token");

        return await apiRequest(
            "/baseline/questions",
            "POST",
            data,
            token
        );

    }

    async updateQuestion(id: number, data: any) {

        const token = localStorage.getItem("access_token");

        return await apiRequest(
            `/baseline/questions/${id}`,
            "PUT",
            data,
            token
        );

    }

    async deleteQuestion(id: number) {

        const token = localStorage.getItem("access_token");

        return await apiRequest(
            `/baseline/questions/${id}`,
            "DELETE",
            null,
            token
        );

    }

    async getQuestion(id: number) {

        const token = localStorage.getItem("access_token");

        return await apiRequest(
            `/baseline/questions/${id}`,
            "GET",
            null,
            token
        );

    }

    async getLatestResult() {
        const token = localStorage.getItem("access_token");

        return await apiRequest(
            "/baseline/latest-result",
            "GET",
            null,
            token
        );
    }

    async startAssessment(data: any) {

        const token = localStorage.getItem("access_token");

        return await apiRequest(
            "/baseline/start",
            "POST",
            data,
            token
        );

    }

    async submitResponse(data: any) {

        const token = localStorage.getItem("access_token");

        return await apiRequest(
            "/baseline/submit-response",
            "POST",
            data,
            token
        );

    }

    async completeAssessment(data: any) {

        const token = localStorage.getItem("access_token");

        return await apiRequest(
            "/baseline/complete",
            "POST",
            data,
            token
        );

    }

}

export default new BaselineService();