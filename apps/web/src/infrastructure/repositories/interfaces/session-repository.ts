export interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: string;
}

export interface CreateSessionInput {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
}

export interface ISessionRepository {
  create(input: CreateSessionInput): Promise<void>;
  /** Returns the session if the hash matches and it hasn't expired. */
  findValidByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  touch(id: string, lastSeenAt: string): Promise<void>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
  /** "Log out of every device", and used when a member loses household access. */
  deleteAllForUser(userId: string): Promise<void>;
  deleteExpired(now: string): Promise<void>;
}
