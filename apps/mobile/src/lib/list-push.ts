import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { apiFetch } from "@/lib/api";
import { getMyListCode } from "@/lib/my-list-storage";
import { updateMyListWidget } from "@/widgets/refresh-my-list-widget";

/**
 * Instant widget sync for shared lists. When another participant changes a
 * shared list, the server (apps/web's list-push.ts) sends this device a silent
 * data-only push; the background task below then refreshes the home-screen
 * widget - within seconds, even with the app closed, instead of Android's
 * ~30-minute widget refresh. Nothing is ever shown to the user, so no
 * notification permission is requested. Android only (the widget is too).
 */
const LIST_PUSH_TASK = "navio-list-changed-push";

interface ListChangedPayload {
  type?: string;
  shareCode?: string;
}

/** Expo delivers the push's `data` as a JSON string under one of these keys depending on app state. */
function parsePayload(data: Record<string, unknown>): ListChangedPayload {
  for (const key of ["dataString", "body"]) {
    const raw = data[key];
    if (typeof raw !== "string") continue;
    try {
      return JSON.parse(raw) as ListChangedPayload;
    } catch {
      // Not JSON - try the next key.
    }
  }
  return data as ListChangedPayload;
}

/** Must run at module scope of the entry file (index.tsx), so it's defined when Android starts the app headless. */
export function registerListPushTask(): void {
  if (Platform.OS !== "android") return;
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(LIST_PUSH_TASK, async ({ data }) => {
    if (!data || "actionIdentifier" in data) return;
    const payload = parsePayload(data.data ?? {});
    if (payload.type !== "list-changed") return;
    // Only the list shown on the widget matters; another shared list changing is a no-op.
    if (payload.shareCode && payload.shareCode !== (await getMyListCode())) return;
    await updateMyListWidget();
  });
  Notifications.registerTaskAsync(LIST_PUSH_TASK).catch((error) => {
    console.warn("[list-push] failed to register the background task", error);
  });
}

async function getPushToken(): Promise<string | null> {
  if (Platform.OS !== "android") return null;
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (error) {
    // No Firebase config in this build, or no Play Services - widget sync falls back to polling.
    console.warn("[list-push] no push token", error);
    return null;
  }
}

/** Call once signed in; links this device to the account so shared-list changes reach it. */
export async function registerPushToken(): Promise<void> {
  const token = await getPushToken();
  if (!token) return;
  try {
    await apiFetch("/api/push-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch {
    // Retried on the next launch.
  }
}

/** Call before signing out, while the session is still valid. */
export async function unregisterPushToken(): Promise<void> {
  const token = await getPushToken();
  if (!token) return;
  try {
    await apiFetch("/api/push-tokens", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch {
    // Best-effort - the server also drops tokens Expo reports as unregistered.
  }
}
