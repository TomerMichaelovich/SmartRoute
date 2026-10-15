import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client";
import { pushTokens } from "../../db/schema";
import type { IPushTokenRepository } from "../interfaces/push-token-repository";

export class PgPushTokenRepository implements IPushTokenRepository {
  async upsert(userId: string, token: string): Promise<void> {
    const now = new Date().toISOString();
    await db
      .insert(pushTokens)
      .values({ id: crypto.randomUUID(), userId, token, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: pushTokens.token, set: { userId, updatedAt: now } });
  }

  async delete(userId: string, token: string): Promise<void> {
    await db.delete(pushTokens).where(and(eq(pushTokens.token, token), eq(pushTokens.userId, userId)));
  }

  async deleteTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await db.delete(pushTokens).where(inArray(pushTokens.token, tokens));
  }

  async findTokensForUsers(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const rows = await db
      .select({ token: pushTokens.token })
      .from(pushTokens)
      .where(inArray(pushTokens.userId, userIds));
    return rows.map((r) => r.token);
  }
}
