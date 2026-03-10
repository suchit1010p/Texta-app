import axios from "axios";
import { getItem, setItem, deleteItem } from "./storage";
import Constants from "expo-constants";

const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
const appConfigApiUrl = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
const fallbackApiUrl = "https://0oedipcvpk.execute-api.ap-south-1.amazonaws.com/api/v1";

const API_URL = envApiUrl || appConfigApiUrl || fallbackApiUrl;

const api = axios.create({
    baseURL: API_URL,
    timeout: 15000,
    headers: { "Content-Type": "application/json" },
});

const ACCESS_TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";

const clearStoredAuth = async () => {
    await deleteItem(ACCESS_TOKEN_KEY);
    await deleteItem(REFRESH_TOKEN_KEY);
    await deleteItem("user");
};

api.interceptors.request.use(
    async (config) => {
        const token = await getItem(ACCESS_TOKEN_KEY);
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const isRefreshRequest =
            typeof originalRequest?.url === "string" &&
            originalRequest.url.includes("/auth/refreshToken");

        if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isRefreshRequest) {
            originalRequest._retry = true;

            try {
                const refreshToken = await getItem(REFRESH_TOKEN_KEY);
                if (!refreshToken) {
                    throw new Error("No refresh token");
                }

                const refreshResponse = await api.post("/auth/refreshToken", { refreshToken });
                const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
                    refreshResponse.data.data;

                await setItem(ACCESS_TOKEN_KEY, newAccessToken);
                await setItem(REFRESH_TOKEN_KEY, newRefreshToken);

                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                await clearStoredAuth();
                throw refreshError;
            }
        }

        throw error;
    }
);

export const loginUser = (credentials: { email?: string; username?: string; password: string }) => {
    return api.post("/auth/login", credentials);
};

export const registerUser = (username: string, email: string, password: string) => {
    return api.post("/auth/register", { username, email, password });
};

export const logoutUser = () => {
    return api.post("/auth/logout");
};

export const refreshAccessToken = (refreshToken: string) => {
    return api.post("/auth/refreshToken", { refreshToken });
};

export const getCurrentUser = () => {
    return api.get("/auth/profile");
};

export const createList = (data: { text: string; description?: string }) => {
    return api.post("/lists", data);
};

export const getAllLists = () => {
    return api.get("/lists");
};

export const getListById = (listId: string) => {
    return api.get(`/lists/${listId}`);
};

export const updateList = (listId: string, data: { text?: string; description?: string; url?: string[] }) => {
    return api.put(`/lists/${listId}`, data);
};

export const updateListStatus = (listId: string, status: "pending" | "in-progress" | "done") => {
    return api.patch(`/lists/${listId}`, { status });
};

export const deleteList = (listId: string) => {
    return api.delete(`/lists/${listId}`);
};

export const deleteAllLists = () => {
    return api.delete("/lists");
};

export const deleteMultipleLists = (listIds: string[]) => {
    return api.post("/lists/bulk-delete", { listIds });
};

export const generateUploadURLs = (listId: string, fileNames: string[]) => {
    return api.post("/lists/upload", { listid: listId, fileNames });
};

export const scheduleDeleteList = (listId: string, duration: string) => {
    return api.patch(`/lists/${listId}/schedule-delete`, { duration });
};
