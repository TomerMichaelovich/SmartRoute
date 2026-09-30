import * as SecureStore from "expo-secure-store";

// SecureStore keys may only contain [A-Za-z0-9._-] - anything else (e.g. the
// "navio:sessionToken" this used to be) makes every read/write throw, which
// the catches below hid: the token then lived in memory only and every app
// restart logged the user out.
const TOKEN_KEY = "navio.sessionToken";

// In-memory mirror so apiFetch can attach the header synchronously without an
// async SecureStore read on every request; kept in sync by set/clearToken.
let currentToken: string | null = null;

export function getCurrentToken(): string | null {
  return currentToken;
}

export async function loadStoredToken(): Promise<string | null> {
  try {
    currentToken = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (err) {
    console.warn("[auth-token] failed to read the stored session token", err);
    currentToken = null;
  }
  return currentToken;
}

export async function setToken(token: string): Promise<void> {
  currentToken = token;
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (err) {
    // The in-memory token still works for the rest of this app session, but the
    // user will be logged out on the next launch - make that visible.
    console.warn("[auth-token] failed to persist the session token", err);
  }
}

export async function clearToken(): Promise<void> {
  currentToken = null;
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // ignore
  }
}
