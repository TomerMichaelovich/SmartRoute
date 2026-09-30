import type { AuthProvider, User } from "@smartroute/core/domain/entities/user";

/** One registered account as the admin panel sees it - never includes secrets. */
export interface UserAccountSummary {
  user: User;
  /** Signed up (or later set) an email + password. */
  hasPassword: boolean;
  oauthProviders: AuthProvider[];
  /** Latest activity across all of the user's sessions (devices). */
  lastSeenAt: string | null;
  activeSessionCount: number;
  tripCount: number;
  lastTripAt: string | null;
  /** Own lists, excluding soft-deleted ones. */
  listCount: number;
}

/** Read-only, cross-table views over accounts for the admin panel. */
export interface IUserAdminRepository {
  listSummaries(): Promise<UserAccountSummary[]>;
  findSummary(userId: string): Promise<UserAccountSummary | null>;
}
