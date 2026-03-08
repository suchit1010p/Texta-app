import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getCurrentUser, loginUser, logoutUser, registerUser } from "../services/api";
import { getItem } from "../services/storage";

interface User {
    _id: string;
    username: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (identifier: string, password: string) => Promise<void>;
    register: (username: string, email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Restore session on boot
    useEffect(() => {
        const restoreSession = async () => {
            try {
                const token = await getItem("token");
                if (token) {
                    const profileRes = await getCurrentUser();
                    setUser(profileRes.data.data);
                }
            } catch (err) {
                // Token invalid/expired - handled by Axios interceptor clearing storage
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };
        restoreSession();
    }, []);

    const login = async (identifier: string, password: string) => {
        // The API layer saves the tokens via response destructuring if needed,
        // but the backend sends them in the login response anyway.
        const payload = identifier.includes("@")
            ? { email: identifier, password }
            : { username: identifier, password };
        const res = await loginUser(payload);

        // Set tokens in storage manually since the interceptor only runs on refresh
        const { accessToken, refreshToken, user: userData } = res.data.data;
        const { setItem } = require("../services/storage");
        await setItem("token", accessToken);
        await setItem("refreshToken", refreshToken);

        setUser(userData);
    };

    const register = async (username: string, email: string, password: string) => {
        const res = await registerUser(username, email, password);
        const { accessToken, refreshToken } = res.data.data;

        const { setItem } = require("../services/storage");
        await setItem("token", accessToken);
        await setItem("refreshToken", refreshToken);

        // Register doesn't return the full user without password usually, 
        // but if it does we can use it, otherwise fetch profile or set basic
        const profileRes = await getCurrentUser();
        setUser(profileRes.data.data);
    };

    const logout = async () => {
        try {
            await logoutUser();
        } catch {
            // Ignore if server fails, clear locally anyway
        }
        const { deleteItem } = require("../services/storage");
        await deleteItem("token");
        await deleteItem("refreshToken");
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: !!user,
                login,
                register,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
    return ctx;
}
