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

    const headers: HeadersInit = {};

    // Attach JWT
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const options: RequestInit = {
        method,
        headers
    };

    // Handle request body
    if (data) {

        if (data instanceof FormData) {

            // IMPORTANT:
            // Do NOT set Content-Type.
            // The browser sets the multipart boundary automatically.
            options.body = data;

        } else {

            headers["Content-Type"] = "application/json";

            options.body = JSON.stringify(data);

        }

    }

    const response = await fetch(
        `${API_BASE_URL}${endpoint}`,
        options
    );

    const result = await response.json();

    return {

        ok: response.ok,

        status: response.status,

        data: result

    };

}