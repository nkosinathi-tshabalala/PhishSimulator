import { apiRequest } from "./api";

class AuthService {

    async register(userData: any) {
        return await apiRequest(
            "/auth/register",
            "POST",
            userData
        );
    }

    async login(credentials: any) {
        return await apiRequest(
            "/auth/login",
            "POST",
            credentials
        );
    }

    async getCurrentUser() {

        const token = localStorage.getItem("access_token");

        return await apiRequest(
            "/auth/me",
            "GET",
            null,
            token
        );
    }

    async updateProfile(profileData: any) {

        const token = localStorage.getItem("access_token");

        return await apiRequest(
            "/auth/update-profile",
            "PUT",
            profileData,
            token
        );
    }

    logout() {

        localStorage.removeItem("access_token");
    }
}

export default new AuthService();