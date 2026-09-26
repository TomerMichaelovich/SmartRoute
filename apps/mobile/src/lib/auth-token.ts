import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "navio:sessionToken";

// In-memory mirror so apiFetch can attach the header synchronously without an
// async SecureStore read on every request; kept in sync by set/clearToken.
let currentToken: string | null = null;

export function getCurrentToken(): string | null {
  return currentToken;
}

export async function loadStoredToken(): Promise<string | null> {
  try {
    currentToken = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    currentToken = null;
  }
  return currentToken;
}

export async function setToken(token: string): Promise<void> {
  currentToken = token;
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    // Best-effort - the in-memory token still works for the rest of this app session.
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
