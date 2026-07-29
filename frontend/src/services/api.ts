const API_BASE_URL = "http://127.0.0.1:5000/api";

/**
 * Sends an HTTP request to the backend API.
 */
export async function apiRequest(
    endpoint: string,
    method: string = "GET",
    data: any = null,
    token: string | null = null
) {
    const headers: HeadersInit = {
        "Content-Type": "application/json"
    };

    // Attach JWT if available
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers,
        body: data ? JSON.stringify(data) : null
    });

    const result = await response.json();

    return {
        ok: response.ok,
        status: response.status,
        data: result
    };
}