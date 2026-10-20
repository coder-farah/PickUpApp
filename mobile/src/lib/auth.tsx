import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, setUnauthorizedHandler, tokenStore } from "@/api/client";
import type { MeView, SessionView, UserView } from "@/api/types";
import { currentPushToken } from "./push";

type Auth = {
  status: "loading" | "signedOut" | "signedIn";
  user: UserView | null;
  signIn: (s: SessionView) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (u: UserView) => void;
};

const AuthContext = createContext<Auth | null>(null);

/** Who's signed in. The session token is in the keychain; the profile comes from /api/v1/me. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Auth["status"]>("loading");
  const [user, setUser] = useState<UserView | null>(null);

  const forget = useCallback(async () => {
    await tokenStore.clear();
    qc.clear();
    setUser(null);
    setStatus("signedOut");
  }, [qc]);

  useEffect(() => {
    setUnauthorizedHandler(() => void forget());
    (async () => {
      if (!(await tokenStore.get())) return setStatus("signedOut");
      try {
        const me = await api<MeView>("/api/v1/me");
        qc.setQueryData(["me"], me);
        setUser(me.user);
        setStatus("signedIn");
      } catch {
        // Offline at launch: stay signed in only if we can't tell. A 401 already cleared the token.
        setStatus((await tokenStore.get()) ? "signedIn" : "signedOut");
      }
    })();
  }, [forget, qc]);

  const value = useMemo<Auth>(
    () => ({
      status,
      user,
      setUser,
      signIn: async (s) => {
        await tokenStore.set(s.token);
        setUser(s.user);
        setStatus("signedIn");
      },
      signOut: async () => {
        const pushToken = await currentPushToken().catch(() => null);
        await api("/api/v1/auth/signout", { body: { pushToken } }).catch(() => undefined);
        await forget();
      },
    }),
    [status, user, forget],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
