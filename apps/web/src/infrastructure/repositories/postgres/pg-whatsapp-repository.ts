import { and, eq, gt, isNull } from "drizzle-orm";
import { generateShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import { db } from "../../db/client";
import {
  whatsappLinkCodes,
  whatsappLinks,
  whatsappListResets,
  whatsappProcessedMessages,
} from "../../db/schema";
import type { IWhatsAppRepository, WhatsAppLink, WhatsAppListReset } from "../interfaces/whatsapp-repository";

function toLink(row: typeof whatsappLinks.$inferSelect): WhatsAppLink {
  return {
    phone: row.phone,
    userId: row.userId,
    listId: row.listId,
    lastInboundAt: row.lastInboundAt,
    lastAddedItemIds: row.lastAddedItemIds,
  };
}

export class PgWhatsAppRepository implements IWhatsAppRepository {
  async createLinkCode(userId: string, listId: string, ttlMinutes: number): Promise<string> {
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
    // The unique index catches the (rare) collision; just try another code.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateShareCode(6);
      const inserted = await db
        .insert(whatsappLinkCodes)
        .values({ id: crypto.randomUUID(), code, userId, listId, expiresAt })
        .onConflictDoNothing()
        .returning({ code: whatsappLinkCodes.code });
      if (inserted.length > 0) return code;
    }
    throw new Error("Could not mint a unique WhatsApp link code");
  }

  async consumeLinkCode(code: string): Promise<{ userId: string; listId: string } | null> {
    const now = new Date().toISOString();
    // One statement, so a code can't be used twice even by two racing messages.
    const [row] = await db
      .update(whatsappLinkCodes)
      .set({ usedAt: now })
      .where(
        and(
          eq(whatsappLinkCodes.code, code),
          isNull(whatsappLinkCodes.usedAt),
          gt(whatsappLinkCodes.expiresAt, now),
        ),
      )
      .returning({ userId: whatsappLinkCodes.userId, listId: whatsappLinkCodes.listId });
    return row ?? null;
  }

  async upsertLink(phone: string, userId: string, listId: string): Promise<void> {
    const now = new Date().toISOString();
    await db
      .insert(whatsappLinks)
      .values({ id: crypto.randomUUID(), phone, userId, listId, createdAt: now, lastInboundAt: now })
      .onConflictDoUpdate({ target: whatsappLinks.phone, set: { userId, listId, lastInboundAt: now } });
  }

  async findLinkByPhone(phone: string): Promise<WhatsAppLink | null> {
    const [row] = await db.select().from(whatsappLinks).where(eq(whatsappLinks.phone, phone));
    return row ? toLink(row) : null;
  }

  async findLinksByList(listId: string): Promise<WhatsAppLink[]> {
    const rows = await db.select().from(whatsappLinks).where(eq(whatsappLinks.listId, listId));
    return rows.map(toLink);
  }

  async findLinkByUserAndList(userId: string, listId: string): Promise<WhatsAppLink | null> {
    const [row] = await db
      .select()
      .from(whatsappLinks)
      .where(and(eq(whatsappLinks.userId, userId), eq(whatsappLinks.listId, listId)))
      .limit(1);
    return row ? toLink(row) : null;
  }

  async deleteLink(phone: string): Promise<void> {
    await db.delete(whatsappLinks).where(eq(whatsappLinks.phone, phone));
  }

  async touchInbound(phone: string): Promise<void> {
    await db
      .update(whatsappLinks)
      .set({ lastInboundAt: new Date().toISOString() })
      .where(eq(whatsappLinks.phone, phone));
  }

  async setLastAdded(phone: string, itemIds: string[]): Promise<void> {
    await db.update(whatsappLinks).set({ lastAddedItemIds: itemIds }).where(eq(whatsappLinks.phone, phone));
  }

  async markMessageProcessed(messageId: string): Promise<boolean> {
    const inserted = await db
      .insert(whatsappProcessedMessages)
      .values({ messageId })
      .onConflictDoNothing()
      .returning({ messageId: whatsappProcessedMessages.messageId });
    return inserted.length > 0;
  }

  async recordFinishedTrip(listId: string, tripItemIds: string[], leftoverItemIds: string[]): Promise<void> {
    const now = new Date().toISOString();
    const values = { tripItemIds, leftoverItemIds, finishedAt: now, askedAt: null, pendingText: null };
    await db
      .insert(whatsappListResets)
      .values({ listId, ...values })
      .onConflictDoUpdate({ target: whatsappListResets.listId, set: values });
  }

  async findListReset(listId: string): Promise<WhatsAppListReset | null> {
    const [row] = await db.select().from(whatsappListResets).where(eq(whatsappListResets.listId, listId));
    return row ?? null;
  }

  async markListResetAsked(listId: string, pendingText: string | null): Promise<void> {
    await db
      .update(whatsappListResets)
      .set({ askedAt: new Date().toISOString(), pendingText })
      .where(eq(whatsappListResets.listId, listId));
  }

  async deleteListReset(listId: string): Promise<boolean> {
    const deleted = await db
      .delete(whatsappListResets)
      .where(eq(whatsappListResets.listId, listId))
      .returning({ listId: whatsappListResets.listId });
    return deleted.length > 0;
  }
}
