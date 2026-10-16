/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, type ReactNode } from "react";
import type { User } from "../types";

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (userData: User, token: string) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

interface Session {
    user: User | null;
    token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// localStorage is synchronous, so the session can be restored before the first render
// (no loading flash, and no setState inside an effect).
const readSession = (): Session => {
    try {
        const storedUser = localStorage.getItem("user");
        const storedToken = localStorage.getItem("token");
        if (storedUser && storedToken) {
            return { user: JSON.parse(storedUser), token: storedToken };
        }
    } catch {
        // corrupted storage: clear it and start logged out
        localStorage.removeItem("user");
        localStorage.removeItem("token");
    }
    return { user: null, token: null };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    // the axios client reads the token from localStorage on every request
    const [session, setSession] = useState<Session>(readSession);

    const login = (userData: User, newToken: string) => {
        setSession({ user: userData, token: newToken });
        localStorage.setItem("user", JSON.stringify(userData));
        localStorage.setItem("token", newToken);
    };

    const logout = () => {
        setSession({ user: null, token: null });
        localStorage.removeItem("user");
        localStorage.removeItem("token");
    };

    return (
        <AuthContext.Provider
            value={{
                user: session.user,
                token: session.token,
                login,
                logout,
                isAuthenticated: !!session.token,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
