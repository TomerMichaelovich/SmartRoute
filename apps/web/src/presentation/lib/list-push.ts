import "server-only";
import { after } from "next/server";
import type { ShoppingList } from "@smartroute/core/domain/entities/shopping-list";
import { summarizeItems } from "@smartroute/core/application/shopping-list/format-list-message";
import {
  householdRepository,
  pushTokenRepository,
  whatsappRepository,
} from "@/src/infrastructure/container";
import { isWhatsAppConfigured, sendText } from "@/src/infrastructure/whatsapp/client";

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
      const tokens = await pushTokenRepository.findTokensForUsers(await otherParticipants(list, householdId, actorUserId));
      // No title/body = a headless background notification: nothing is shown, the
      // app's background task runs instead. High priority so Android delivers it
      // promptly instead of batching it until the device next wakes up.
      await sendPushes(tokens, () => ({
        data: { type: "list-changed", shareCode },
        priority: "high",
        _contentAvailable: true,
      }));
    } catch (error) {
      console.error("[list-push] failed to notify list participants", error);
    }
  });
}

/** Replies are free only within 24h of the person's last message; stay a bit inside it. */
const WHATSAPP_FREE_WINDOW_MS = 23.5 * 60 * 60 * 1000;

/**
 * Tells a shared list's other participants that items were added ("עמית: גזר, חלב"):
 * a visible push to their phones, and a WhatsApp message to anyone linked to this
 * list on WhatsApp who wrote to the bot in the last 24h (free then - otherwise it'd
 * be a paid business-initiated message, so they're skipped). Runs after the response.
 */
export function notifyItemsAdded(
  list: ShoppingList,
  actor: { id: string; displayName: string } | null,
  itemNames: string[],
): void {
  if (!list.householdId || !list.shareCode || itemNames.length === 0) return;
  const householdId = list.householdId;
  const shareCode = list.shareCode;
  const listName = list.name ?? "רשימת הקניות";
  const summary = summarizeItems(itemNames);
  const who = actor?.displayName?.trim();
  const body = who ? `${who}: ${summary}` : summary;

  after(async () => {
    try {
      const recipients = await otherParticipants(list, householdId, actor?.id);
      if (recipients.length === 0) return;

      const tokens = await pushTokenRepository.findTokensForUsers(recipients);
      await sendPushes(tokens, () => ({
        title: `נוסף לרשימה "${listName}"`,
        body,
        data: { type: "items-added", shareCode },
        sound: "default",
        priority: "high",
      }));

      if (isWhatsAppConfigured()) {
        const recipientSet = new Set(recipients);
        const links = await whatsappRepository.findLinksByList(list.id);
        const now = Date.now();
        for (const link of links) {
          if (!recipientSet.has(link.userId)) continue;
          if (now - new Date(link.lastInboundAt).getTime() > WHATSAPP_FREE_WINDOW_MS) continue;
          await sendText(link.phone, `➕ נוסף לרשימה "${listName}"\n${body}`).catch((error) =>
            console.error("[list-push] WhatsApp notify failed", error),
          );
        }
      }
    } catch (error) {
      console.error("[list-push] failed to notify about added items", error);
    }
  });
}

/** The list's active members plus its owner, minus whoever made the change. */
async function otherParticipants(
  list: ShoppingList,
  householdId: string,
  actorUserId: string | undefined,
): Promise<string[]> {
  const members = await householdRepository.listMembers(householdId);
  const userIds = new Set(members.filter((m) => m.status === "active").map((m) => m.userId));
  if (list.ownerUserId) userIds.add(list.ownerUserId);
  if (actorUserId) userIds.delete(actorUserId);
  return [...userIds];
}

async function sendPushes(tokens: string[], message: () => Record<string, unknown>): Promise<void> {
  for (let i = 0; i < tokens.length; i += EXPO_BATCH_SIZE) {
    await sendBatch(tokens.slice(i, i + EXPO_BATCH_SIZE), message);
  }
}

async function sendBatch(tokens: string[], message: () => Record<string, unknown>): Promise<void> {
  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(tokens.map((to) => ({ to, ...message() }))),
  });
  if (!res.ok) throw new Error(`Expo push HTTP ${res.status}`);

  const { data: tickets } = (await res.json()) as { data: ExpoPushTicket[] };
  const unregistered = tokens.filter((_, i) => tickets[i]?.details?.error === "DeviceNotRegistered");
  await pushTokenRepository.deleteTokens(unregistered);
}
