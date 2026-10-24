import type { AdminPermissions, AdminUser } from "@smartroute/core/domain/entities/admin-user";

export interface IAdminUserRepository {
  findAll(): Promise<AdminUser[]>;
  findById(id: string): Promise<AdminUser | null>;
  /** With the password hash, for login only. */
  findForLogin(username: string): Promise<(AdminUser & { passwordHash: string }) | null>;
  /** Fails on a taken username (unique index); returns false then. */
  create(user: { id: string; username: string; passwordHash: string; displayName: string; permissions: AdminPermissions }): Promise<boolean>;
  update(id: string, patch: { displayName?: string; permissions?: AdminPermissions; isActive?: boolean }): Promise<void>;
  /** Sets a new password and bumps the session version, logging out open sessions. */
  resetPassword(id: string, passwordHash: string): Promise<void>;
  recordLogin(id: string): Promise<void>;
  delete(id: string): Promise<void>;
  /** Takes a deleted store out of everyone's mapping permissions. */
  removeStoreFromAll(storeId: string): Promise<void>;
}
