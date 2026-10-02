"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, AUTH_EXPIRED_EVENT } from "./api";
import type { User } from "./types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    api
      .me()
      .then(setUserState)
      .catch(() => setUserState(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleExpired = () => {
      setUserState(null);
      setSessionExpired(true);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  }, []);

  const setUser = useCallback((next: User) => {
    setUserState(next);
    setSessionExpired(false);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const loggedIn = await api.login(email, password);
      setUser(loggedIn);
      return loggedIn;
    },
    [setUser],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const created = await api.register(name, email, password);
      setUser(created);
      return created;
    },
    [setUser],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUserState(null);
      setSessionExpired(false);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, sessionExpired, login, register, logout, setUser }),
    [user, loading, sessionExpired, login, register, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>.");
  return context;
}

/** Only allow same-site relative redirects, so ?next= can't send learners to another site. */
export function safeRedirectPath(path: string | null, fallback = "/dashboard"): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
}
