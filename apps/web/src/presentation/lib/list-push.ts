import "server-only";
import { after } from "next/server";
import type { ShoppingList } from "@smartroute/core/domain/entities/shopping-list";
import { householdRepository, pushTokenRepository } from "@/src/infrastructure/container";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
/** Expo accepts at most 100 messages per request. */
const EXPO_BATCH_SIZE = 100;

interface ExpoPushTicket {
  status: "ok" | "error";
  details?: { error?: string };
}

/**
 * After a shared list changes, sends its other participants' devices a silent
 * (data-only, no visible notification) push, so their home-screen widget
 * refreshes within seconds even with the app closed - Android otherwise only
 * refreshes widgets every ~30 minutes. The mobile side is
 * apps/mobile/src/lib/list-push.ts. Runs after the response is sent and never
 * fails the request; personal and guest lists have nobody else to notify.
 */
export function notifyListChanged(list: ShoppingList, actorUserId: string | undefined): void {
  if (!list.householdId || !list.shareCode) return;
  const householdId = list.householdId;
  const shareCode = list.shareCode;

  after(async () => {
    try {
      const members = await householdRepository.listMembers(householdId);
      const userIds = new Set(members.filter((m) => m.status === "active").map((m) => m.userId));
      if (list.ownerUserId) userIds.add(list.ownerUserId);
      if (actorUserId) userIds.delete(actorUserId);

      const tokens = await pushTokenRepository.findTokensForUsers([...userIds]);
      for (let i = 0; i < tokens.length; i += EXPO_BATCH_SIZE) {
        await sendBatch(tokens.slice(i, i + EXPO_BATCH_SIZE), shareCode);
      }
    } catch (error) {
      console.error("[list-push] failed to notify list participants", error);
    }
  });
}

async function sendBatch(tokens: string[], shareCode: string): Promise<void> {
  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    // No title/body = a headless background notification: nothing is shown, the
    // app's background task runs instead. High priority so Android delivers it
    // promptly instead of batching it until the device next wakes up.
    body: JSON.stringify(
      tokens.map((to) => ({
        to,
        data: { type: "list-changed", shareCode },
        priority: "high",
        _contentAvailable: true,
      })),
    ),
  });
  if (!res.ok) throw new Error(`Expo push HTTP ${res.status}`);

  const { data: tickets } = (await res.json()) as { data: ExpoPushTicket[] };
  const unregistered = tokens.filter((_, i) => tickets[i]?.details?.error === "DeviceNotRegistered");
  await pushTokenRepository.deleteTokens(unregistered);
}
