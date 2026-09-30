import { and, count, desc, eq, gt, isNull, max, sql } from "drizzle-orm";
import type { AuthProvider } from "@smartroute/core/domain/entities/user";
import { db } from "../../db/client";
import { oauthAccounts, sessions, shoppingLists, shoppingTrips, users } from "../../db/schema";
import type { IUserAdminRepository, UserAccountSummary } from "../interfaces/user-admin-repository";
import { userSchema } from "../schemas";

export class PgUserAdminRepository implements IUserAdminRepository {
  async listSummaries(): Promise<UserAccountSummary[]> {
    return this.summaries();
  }

  async findSummary(userId: string): Promise<UserAccountSummary | null> {
    const [summary] = await this.summaries(userId);
    return summary ?? null;
  }

  /**
   * A handful of grouped queries joined in memory rather than one wide join -
   * each table would otherwise multiply the others' rows. Fine at pilot scale.
   */
  private async summaries(userId?: string): Promise<UserAccountSummary[]> {
    const now = new Date().toISOString();

    const [userRows, oauthRows, sessionRows, tripRows, listRows] = await Promise.all([
      db
        .select({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          createdAt: users.createdAt,
          hasPassword: sql<boolean>`${users.passwordHash} is not null`,
        })
        .from(users)
        .where(userId ? eq(users.id, userId) : undefined)
        .orderBy(desc(users.createdAt)),
      db
        .select({ userId: oauthAccounts.userId, provider: oauthAccounts.provider })
        .from(oauthAccounts)
        .where(userId ? eq(oauthAccounts.userId, userId) : undefined),
      db
        .select({
          userId: sessions.userId,
          lastSeenAt: max(sessions.lastSeenAt),
          activeCount: sql<number>`count(*) filter (where ${gt(sessions.expiresAt, now)})`.mapWith(Number),
        })
        .from(sessions)
        .where(userId ? eq(sessions.userId, userId) : undefined)
        .groupBy(sessions.userId),
      db
        .select({
          userId: shoppingTrips.userId,
          tripCount: count(),
          lastTripAt: max(shoppingTrips.completedAt),
        })
        .from(shoppingTrips)
        .where(userId ? eq(shoppingTrips.userId, userId) : undefined)
        .groupBy(shoppingTrips.userId),
      db
        .select({ userId: shoppingLists.ownerUserId, listCount: count() })
        .from(shoppingLists)
        .where(
          and(
            isNull(shoppingLists.deletedAt),
            userId ? eq(shoppingLists.ownerUserId, userId) : undefined,
          ),
        )
        .groupBy(shoppingLists.ownerUserId),
    ]);

    const providersByUser = new Map<string, AuthProvider[]>();
    for (const row of oauthRows) {
      const list = providersByUser.get(row.userId) ?? [];
      list.push(row.provider as AuthProvider);
      providersByUser.set(row.userId, list);
    }
    const sessionByUser = new Map(sessionRows.map((r) => [r.userId, r]));
    const tripsByUser = new Map(tripRows.flatMap((r) => (r.userId ? [[r.userId, r] as const] : [])));
    const listsByUser = new Map(listRows.flatMap((r) => (r.userId ? [[r.userId, r.listCount] as const] : [])));

    return userRows.map((row) => {
      const session = sessionByUser.get(row.id);
      const trips = tripsByUser.get(row.id);
      return {
        user: userSchema.parse(row),
        hasPassword: row.hasPassword,
        oauthProviders: providersByUser.get(row.id) ?? [],
        lastSeenAt: session?.lastSeenAt ?? null,
        activeSessionCount: session?.activeCount ?? 0,
        tripCount: trips?.tripCount ?? 0,
        lastTripAt: trips?.lastTripAt ?? null,
        listCount: listsByUser.get(row.id) ?? 0,
      };
    });
  }
}
