import { asc, eq, sql } from "drizzle-orm";
import { normalizePermissions, type AdminPermissions, type AdminUser } from "@smartroute/core/domain/entities/admin-user";
import { db } from "../../db/client";
import { adminUsers } from "../../db/schema";
import type { IAdminUserRepository } from "../interfaces/admin-user-repository";

type Row = typeof adminUsers.$inferSelect;

function toAdminUser(row: Row): AdminUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    permissions: normalizePermissions(row.permissions),
    isActive: row.isActive,
    sessionVersion: row.sessionVersion,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
  };
}

const normalizeUsername = (username: string) => username.trim().toLowerCase();

export class PgAdminUserRepository implements IAdminUserRepository {
  async findAll(): Promise<AdminUser[]> {
    const rows = await db.select().from(adminUsers).orderBy(asc(adminUsers.username));
    return rows.map(toAdminUser);
  }

  async findById(id: string): Promise<AdminUser | null> {
    const [row] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
    return row ? toAdminUser(row) : null;
  }

  async findForLogin(username: string): Promise<(AdminUser & { passwordHash: string }) | null> {
    const [row] = await db.select().from(adminUsers).where(eq(adminUsers.username, normalizeUsername(username)));
    return row ? { ...toAdminUser(row), passwordHash: row.passwordHash } : null;
  }

  async create(user: {
    id: string;
    username: string;
    passwordHash: string;
    displayName: string;
    permissions: AdminPermissions;
  }): Promise<boolean> {
    const now = new Date().toISOString();
    const inserted = await db
      .insert(adminUsers)
      .values({ ...user, username: normalizeUsername(user.username), createdAt: now, updatedAt: now })
      .onConflictDoNothing({ target: adminUsers.username })
      .returning({ id: adminUsers.id });
    return inserted.length > 0;
  }

  async update(id: string, patch: { displayName?: string; permissions?: AdminPermissions; isActive?: boolean }): Promise<void> {
    await db
      .update(adminUsers)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(adminUsers.id, id));
  }

  async resetPassword(id: string, passwordHash: string): Promise<void> {
    await db
      .update(adminUsers)
      .set({ passwordHash, sessionVersion: sql`${adminUsers.sessionVersion} + 1`, updatedAt: new Date().toISOString() })
      .where(eq(adminUsers.id, id));
  }

  async recordLogin(id: string): Promise<void> {
    await db.update(adminUsers).set({ lastLoginAt: new Date().toISOString() }).where(eq(adminUsers.id, id));
  }

  async delete(id: string): Promise<void> {
    await db.delete(adminUsers).where(eq(adminUsers.id, id));
  }

  async removeStoreFromAll(storeId: string): Promise<void> {
    await db.execute(sql`
      UPDATE admin_users
      SET permissions = jsonb_set(permissions, '{storeIds}', (permissions->'storeIds') - ${storeId}::text)
      WHERE permissions->'storeIds' ? ${storeId}`);
  }
}
