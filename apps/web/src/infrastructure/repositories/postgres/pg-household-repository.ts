import { and, eq, gt, isNull } from "drizzle-orm";
import type {
  Household,
  HouseholdInvite,
  HouseholdMemberView,
  HouseholdMembership,
} from "@smartroute/core/domain/entities/household";
import { db } from "../../db/client";
import { householdInvites, householdMembers, households, users } from "../../db/schema";
import type { IHouseholdRepository } from "../interfaces/household-repository";
import {
  householdInviteSchema,
  householdMembershipSchema,
  householdRoleSchema,
  householdSchema,
  membershipStatusSchema,
} from "../schemas";

export class PgHouseholdRepository implements IHouseholdRepository {
  async create(name: string, ownerUserId: string): Promise<Household> {
    const now = new Date().toISOString();
    const household = { id: crypto.randomUUID(), name, createdBy: ownerUserId, createdAt: now };
    await db.insert(households).values(household);
    await db.insert(householdMembers).values({
      id: crypto.randomUUID(),
      householdId: household.id,
      userId: ownerUserId,
      role: "owner",
      status: "active",
      createdAt: now,
    });
    return householdSchema.parse(household);
  }

  async findById(id: string): Promise<Household | null> {
    const [row] = await db.select().from(households).where(eq(households.id, id));
    return row ? householdSchema.parse(row) : null;
  }

  async findMembershipForUser(userId: string): Promise<HouseholdMembership | null> {
    const [row] = await db
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.userId, userId));
    return row ? this.toMembership(row) : null;
  }

  async getMembership(
    householdId: string,
    userId: string,
  ): Promise<HouseholdMembership | null> {
    const [row] = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, userId),
        ),
      );
    return row ? this.toMembership(row) : null;
  }

  async listMembers(householdId: string): Promise<HouseholdMemberView[]> {
    const rows = await db
      .select({
        userId: householdMembers.userId,
        role: householdMembers.role,
        status: householdMembers.status,
        displayName: users.displayName,
        email: users.email,
      })
      .from(householdMembers)
      .innerJoin(users, eq(users.id, householdMembers.userId))
      .where(eq(householdMembers.householdId, householdId));

    return rows.map((r) => ({
      userId: r.userId,
      displayName: r.displayName,
      email: r.email,
      role: householdRoleSchema.parse(r.role),
      status: membershipStatusSchema.parse(r.status),
    }));
  }

  async addPendingMember(householdId: string, userId: string): Promise<void> {
    await db
      .insert(householdMembers)
      .values({
        id: crypto.randomUUID(),
        householdId,
        userId,
        role: "member",
        status: "pending",
        createdAt: new Date().toISOString(),
      })
      .onConflictDoNothing({
        target: [householdMembers.householdId, householdMembers.userId],
      });
  }

  async approveMember(householdId: string, userId: string): Promise<void> {
    await db
      .update(householdMembers)
      .set({ status: "active" })
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, userId),
        ),
      );
  }

  async removeMember(householdId: string, userId: string): Promise<void> {
    await db
      .delete(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, userId),
        ),
      );
  }

  async countActiveMembers(householdId: string): Promise<number> {
    const rows = await db
      .select({ userId: householdMembers.userId })
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.status, "active"),
        ),
      );
    return rows.length;
  }

  async createInvite(
    householdId: string,
    createdBy: string,
    code: string,
    expiresAt: string,
  ): Promise<HouseholdInvite> {
    const invite = {
      id: crypto.randomUUID(),
      householdId,
      code,
      createdBy,
      createdAt: new Date().toISOString(),
      expiresAt,
      revokedAt: null as string | null,
    };
    await db.insert(householdInvites).values(invite);
    return householdInviteSchema.parse(invite);
  }

  async findValidInviteByCode(code: string): Promise<HouseholdInvite | null> {
    const [row] = await db
      .select()
      .from(householdInvites)
      .where(
        and(
          eq(householdInvites.code, code),
          isNull(householdInvites.revokedAt),
          gt(householdInvites.expiresAt, new Date().toISOString()),
        ),
      );
    return row ? householdInviteSchema.parse(row) : null;
  }

  async listActiveInvites(householdId: string): Promise<HouseholdInvite[]> {
    const rows = await db
      .select()
      .from(householdInvites)
      .where(
        and(
          eq(householdInvites.householdId, householdId),
          isNull(householdInvites.revokedAt),
          gt(householdInvites.expiresAt, new Date().toISOString()),
        ),
      );
    return rows.map((r) => householdInviteSchema.parse(r));
  }

  async revokeInvite(inviteId: string): Promise<void> {
    await db
      .update(householdInvites)
      .set({ revokedAt: new Date().toISOString() })
      .where(eq(householdInvites.id, inviteId));
  }

  private toMembership(row: typeof householdMembers.$inferSelect): HouseholdMembership {
    return householdMembershipSchema.parse({
      householdId: row.householdId,
      userId: row.userId,
      role: row.role,
      status: row.status,
      createdAt: row.createdAt,
    });
  }
}
