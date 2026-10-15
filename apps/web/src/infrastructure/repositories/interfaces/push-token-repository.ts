export interface IPushTokenRepository {
  /** Registers a device's token for a user, moving it over if another user had it. */
  upsert(userId: string, token: string): Promise<void>;
  /** Only removes the token if it belongs to `userId`. */
  delete(userId: string, token: string): Promise<void>;
  /** Drops tokens Expo reported as no longer registered (app uninstalled). */
  deleteTokens(tokens: string[]): Promise<void>;
  findTokensForUsers(userIds: string[]): Promise<string[]>;
}
