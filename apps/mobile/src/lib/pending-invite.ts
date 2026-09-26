import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * A household invite code the user opened but couldn't act on yet (not signed
 * in, or the app was only just installed). Persisted so the join resumes after
 * login/registration - see PendingInviteResume in _layout.tsx. Cleared once the
 * join screen has shown it.
 */
const PENDING_INVITE_STORAGE_KEY = "smartroute:pendingInvite";

export async function getPendingInvite(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PENDING_INVITE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function setPendingInvite(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_INVITE_STORAGE_KEY, code);
  } catch {
    // Best-effort - worst case the user reopens the invite link after logging in.
  }
}

export async function clearPendingInvite(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
  } catch {
    // Best-effort, see setPendingInvite.
  }
}
