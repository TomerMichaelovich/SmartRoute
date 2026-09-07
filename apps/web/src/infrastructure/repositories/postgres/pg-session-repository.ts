import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "../../db/client";
import { sessions } from "../../db/schema";
import type {
  CreateSessionInput,
  ISessionRepository,
  SessionRecord,
} from "../interfaces/session-repository";

export class PgSessionRepository implements ISessionRepository {
  async create(input: CreateSessionInput): Promise<void> {
    const now = new Date().toISOString();
    await db.insert(sessions).values({
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: input.expiresAt,
    });
  }

  async findValidByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const [row] = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          gt(sessions.expiresAt, new Date().toISOString()),
        ),
      );
    return row
      ? { id: row.id, userId: row.userId, expiresAt: row.expiresAt }
      : null;
  }

  async touch(id: string, lastSeenAt: string): Promise<void> {
    await db.update(sessions).set({ lastSeenAt }).where(eq(sessions.id, id));
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }

  async deleteExpired(now: string): Promise<void> {
    await db.delete(sessions).where(lt(sessions.expiresAt, now));
  }
}
