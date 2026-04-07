"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { authAPI } from "@/lib/api";
import { secureTokenStore } from "@/lib/secure-token-store";
import { wsClient } from "@/lib/websocket";
import { registerServiceWorker } from "@/lib/sw-register";
import "@/lib/i18n";
import type { User } from "@/lib/types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const token = secureTokenStore.getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      const { data } = await authAPI.me();
      if (data.success && data.data) {
        setUser(data.data);
      }
    } catch {
      secureTokenStore.clearToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
    registerServiceWorker();
  }, [loadUser]);

  // Connect/disconnect WebSocket based on auth state
  useEffect(() => {
    if (user) {
      wsClient.connect();
    } else {
      wsClient.disconnect();
    }
    return () => wsClient.disconnect();
  }, [user]);

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await authAPI.login(username, password);
    if (data.success && data.data) {
      secureTokenStore.setToken(data.data.access_token);
      setUser(data.data.user);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } finally {
      secureTokenStore.clearToken();
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
    }),
    [user, isLoading, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return context;
}
