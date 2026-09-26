import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import type { User } from "@smartroute/core/domain/entities/user";
import { he } from "@smartroute/core/i18n/he";
import { apiFetch } from "@/lib/api";
import { clearToken, loadStoredToken, setToken } from "@/lib/auth-token";
import { claimGuestListIfAny } from "@/lib/guest-claim";
import { clearLocalUserData } from "@/lib/local-cleanup";

export interface AuthFieldErrors {
  email?: string;
  password?: string;
  displayName?: string;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  fieldErrors?: AuthFieldErrors;
}

interface AuthContextValue {
  status: "loading" | "guest" | "authenticated";
  user: User | null;
  googleAvailable: boolean;
  register(email: string, password: string, displayName: string): Promise<AuthResult>;
  login(email: string, password: string): Promise<AuthResult>;
  loginWithGoogle(): Promise<AuthResult>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The *web* OAuth client ID (same one the web app uses for GOOGLE_CLIENT_ID) -
 * NOT an Android/iOS client ID. The native Google Sign-In SDK resolves the
 * Android/iOS client automatically from the app's own package name + signing
 * certificate (registered in Google Cloud Console); `webClientId` here is
 * only what makes it also mint a server-verifiable idToken, whose `aud`
 * ends up being this web client id - see google-oauth.ts's
 * allowedGoogleAudiences() on the backend.
 */
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_AVAILABLE = Boolean(GOOGLE_WEB_CLIENT_ID);

if (GOOGLE_AVAILABLE) {
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
}

/**
 * After any successful sign-in, attach a locally-held guest list (if any) to
 * the account - mirrors the web's GuestListClaim, just surfaced as a native
 * Alert instead of a custom overlay since this only ever needs a yes/no-style
 * choice. Never resolves a conflict on its own: nothing is merged/overwritten
 * without the user picking.
 */
async function runGuestClaim(): Promise<void> {
  const result = await claimGuestListIfAny();
  if (!result) return;

  if (result.status === "claimed") {
    Alert.alert(he.myList.claim.claimedTitle, he.myList.claim.claimedBody);
    return;
  }

  if (result.status === "conflict") {
    Alert.alert(he.myList.claim.conflictTitle, he.myList.claim.conflictBody, [
      {
        text: he.myList.claim.keepExisting,
        onPress: () => void claimGuestListIfAny("keep_existing"),
      },
      {
        text: he.myList.claim.newEmpty,
        onPress: () => void claimGuestListIfAny("new_empty"),
      },
    ]);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "guest" | "authenticated">("loading");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    (async () => {
      const token = await loadStoredToken();
      if (!token) {
        setStatus("guest");
        return;
      }
      try {
        const res = await apiFetch("/api/auth/me");
        if (res.ok) {
          const data: { user: User } = await res.json();
          setUser(data.user);
          setStatus("authenticated");
          return;
        }
      } catch {
        // Network error on boot - fall through to guest; the token stays
        // stored and gets re-checked next launch instead of being dropped.
      }
      setStatus("guest");
    })();
  }, []);

  const applySession = useCallback(async (nextUser: User, token: string) => {
    await setToken(token);
    setUser(nextUser);
    setStatus("authenticated");
    void runGuestClaim();
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName: string): Promise<AuthResult> => {
      try {
        const res = await apiFetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, displayName }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data.error === "invalid" ? undefined : data.error, fieldErrors: data.fieldErrors };
        }
        await applySession(data.user, data.token);
        return { ok: true };
      } catch {
        return { ok: false, error: he.common.error };
      }
    },
    [applySession],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        const res = await apiFetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data.error, fieldErrors: data.fieldErrors };
        }
        await applySession(data.user, data.token);
        return { ok: true };
      } catch {
        return { ok: false, error: he.common.error };
      }
    },
    [applySession],
  );

  const loginWithGoogle = useCallback(async (): Promise<AuthResult> => {
    if (!GOOGLE_AVAILABLE) {
      return { ok: false, error: he.auth.errors.googleFailed };
    }
    try {
      console.log("[loginWithGoogle] checking Play Services...");
      const hasPlayServices = await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      console.log("[loginWithGoogle] hasPlayServices ->", hasPlayServices, "- opening sign-in...");
      const response = await GoogleSignin.signIn();
      console.log("[loginWithGoogle] signIn() resolved, type =", response.type);
      if (!isSuccessResponse(response)) {
        // User cancelled the account picker - not an error to surface.
        return { ok: false };
      }
      const idToken = response.data.idToken;
      if (!idToken) {
        console.error("[loginWithGoogle] GoogleSignin.signIn() returned no idToken", response.data);
        return { ok: false, error: he.auth.errors.googleFailed };
      }
      console.log("[loginWithGoogle] got idToken, POSTing to /api/auth/google/token...");
      const res = await apiFetch("/api/auth/google/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      console.log("[loginWithGoogle] server responded, status =", res.status);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        console.error("[loginWithGoogle] /api/auth/google/token failed", res.status, data);
        return { ok: false, error: he.auth.errors.googleFailed };
      }
      console.log("[loginWithGoogle] applying session...");
      await applySession(data.user, data.token);
      console.log("[loginWithGoogle] done, session applied");
      return { ok: true };
    } catch (err) {
      console.error("[loginWithGoogle] threw", err);
      return { ok: false, error: he.auth.errors.googleFailed };
    }
  }, [applySession]);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Best-effort - clearing the local token still logs the device out.
    }
    await clearToken();
    await clearLocalUserData();
    setUser(null);
    setStatus("guest");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, googleAvailable: GOOGLE_AVAILABLE, register, login, loginWithGoogle, logout }),
    [status, user, register, login, loginWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
