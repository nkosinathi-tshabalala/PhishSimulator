// Sends requests to the backend and keeps the login token up to date

import { getToken, setToken } from "./session";

// Backend address; set VITE_API_URL to change it (e.g. in Docker)
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";

// Fired when a signed-in request is rejected because the login expired
export const SESSION_EXPIRED_EVENT = "session-expired";

/** Sends an HTTP request to the backend API. */
export async function apiRequest(
    endpoint: string,
    method: string = "GET",
    data: any = null,
    token: string | null = null
) {
    const headers: HeadersInit = {};

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const options: RequestInit = { method, headers };

    if (data instanceof FormData) {
        options.body = data;
    } else if (data) {
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(data);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const result = await response.json().catch(() => ({ success: false, message: "Unexpected server response." }));

    const renewedToken = response.headers.get("X-New-Token");
    if (renewedToken && getToken()) {
        setToken(renewedToken);
    }

    if (response.status === 401 && token) {
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }

    return {
        ok: response.ok,
        status: response.status,
        data: result,
    };
}

/** Downloads a file (such as a CSV export) from the API and saves it. */
export async function downloadFile(endpoint: string, filename: string, token: string | null) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
        return false;
    }

    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return true;
}
