"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { AuthUser } from "@/types";

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  /** Authenticated fetch — injects Bearer token, silently refreshes on 401 (AC1.3). */
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  setCredentials: (user: AuthUser, accessToken: string) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);
  const router = useRouter();

  // On mount, try the refresh cookie to restore a previous session (AC1.3).
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/refresh", { method: "POST" });
        if (res.ok) {
          const { accessToken } = (await res.json()) as { accessToken: string };
          tokenRef.current = accessToken;
          const meRes = await fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (meRes.ok) {
            const { user: u } = (await meRes.json()) as { user: AuthUser };
            setUser(u);
          }
        }
      } catch {
        // Network failure — stay logged out.
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Use a stable ref-based fetch so apiFetch never re-creates on token change.
  const apiFetch = useCallback(
    async (path: string, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers);
      if (tokenRef.current) {
        headers.set("Authorization", `Bearer ${tokenRef.current}`);
      }
      const res = await fetch(path, { ...init, headers });

      if (res.status === 401 && tokenRef.current) {
        // Try to silently refresh (AC1.3).
        const refreshRes = await fetch("/api/auth/refresh", { method: "POST" });
        if (refreshRes.ok) {
          const { accessToken } = (await refreshRes.json()) as {
            accessToken: string;
          };
          tokenRef.current = accessToken;
          headers.set("Authorization", `Bearer ${accessToken}`);
          return fetch(path, { ...init, headers });
        }
        // Refresh failed — force logout.
        tokenRef.current = null;
        setUser(null);
        router.push("/login");
      }

      return res;
    },
    [router]
  );

  const setCredentials = useCallback((u: AuthUser, accessToken: string) => {
    tokenRef.current = accessToken;
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    tokenRef.current = null;
    setUser(null);
    router.push("/login");
  }, [apiFetch, router]);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, apiFetch, setCredentials, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
