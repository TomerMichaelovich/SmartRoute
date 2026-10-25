import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Linking, Platform } from "react-native";
import { apiFetch } from "@/lib/api";
import { getMyListCode } from "@/lib/my-list-storage";
import { updateMyListWidget } from "@/widgets/refresh-my-list-widget";

/**
 * Instant widget sync for shared lists. When another participant changes a
 * shared list, the server (apps/web's list-push.ts) sends this device a silent
 * data-only push; the background task below then refreshes the home-screen
 * widget - within seconds, even with the app closed, instead of Android's
 * ~30-minute widget refresh. Those are never shown to the user.
 *
 * The server also sends a *visible* "items-added" push ("עמית: גזר, חלב") when
 * someone else adds to a shared list - from the app or the WhatsApp bot - so
 * the notification permission is requested once signed in. Android only.
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

function notificationType(notification: Notifications.Notification): string | undefined {
  const data = notification.request.content.data as ListChangedPayload | undefined;
  return data?.type;
}

/** Must run at module scope of the entry file (index.tsx), so it's defined when Android starts the app headless. */
export function registerListPushTask(): void {
  if (Platform.OS !== "android") return;

  // Show "items-added" even while the app is open; nothing else is meant to be seen.
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const show = notificationType(notification) === "items-added";
      return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
    },
  });
  // Tapping "items-added" opens that list.
  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as ListChangedPayload | undefined;
    if (data?.type === "items-added" && data.shareCode) {
      void Linking.openURL(`smartroute://my-list/${data.shareCode}`);
    }
  });

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
  if (Platform.OS === "android") {
    try {
      // Expo sends to the "default" channel when none is named.
      await Notifications.setNotificationChannelAsync("default", {
        name: "עדכוני רשימה",
        importance: Notifications.AndroidImportance.HIGH,
      });
      // Android 13+ asks once; declining only hides the visible pushes - widget sync still works.
      await Notifications.requestPermissionsAsync();
    } catch (error) {
      console.warn("[list-push] notification setup failed", error);
    }
  }
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
