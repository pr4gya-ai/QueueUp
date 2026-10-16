import axios, { isAxiosError } from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// An expired or invalid token would otherwise leave every page failing silently.
// Login/register also answer 401 for bad credentials, so those are left alone.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const url: string = error?.config?.url ?? "";
        if (error?.response?.status === 401 && !url.includes("/api/auth/")) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            if (window.location.pathname !== "/login") window.location.assign("/login");
        }
        return Promise.reject(error);
    }
);

// Turns anything thrown by a request into a message fit for a toast.
export const getErrorMessage = (error: unknown, fallback = "Something went wrong"): string => {
    if (isAxiosError(error)) {
        const data = error.response?.data;
        if (typeof data === "string" && data) return data;
        if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
            return data.message;
        }
        if (error.code === "ERR_NETWORK") return "Cannot reach the server. Is the backend running?";
        return error.message || fallback;
    }
    return error instanceof Error ? error.message : fallback;
};

export default api;
