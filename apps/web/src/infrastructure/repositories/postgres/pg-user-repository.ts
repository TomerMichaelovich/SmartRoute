import { and, eq } from "drizzle-orm";
import type { AuthProvider, User } from "@smartroute/core/domain/entities/user";
import { db } from "../../db/client";
import { oauthAccounts, users } from "../../db/schema";
import type {
  CreateUserInput,
  IUserRepository,
} from "../interfaces/user-repository";
import { userSchema } from "../schemas";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class PgUserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    const [row] = await db.select().from(users).where(eq(users.id, id));
    return row ? userSchema.parse(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizeEmail(email)));
    return row ? userSchema.parse(row) : null;
  }

  async findByEmailWithSecret(
    email: string,
  ): Promise<(User & { passwordHash: string | null }) | null> {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizeEmail(email)));
    if (!row) return null;
    return { ...userSchema.parse(row), passwordHash: row.passwordHash };
  }

  async create(input: CreateUserInput): Promise<User> {
    const row = {
      id: input.id,
      email: normalizeEmail(input.email),
      displayName: input.displayName,
      passwordHash: input.passwordHash ?? null,
      createdAt: new Date().toISOString(),
    };
    await db.insert(users).values(row);
    return userSchema.parse(row);
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
  }

  async findByOAuth(
    provider: AuthProvider,
    providerAccountId: string,
  ): Promise<User | null> {
    const [link] = await db
      .select()
      .from(oauthAccounts)
      .where(
        and(
          eq(oauthAccounts.provider, provider),
          eq(oauthAccounts.providerAccountId, providerAccountId),
        ),
      );
    if (!link) return null;
    return this.findById(link.userId);
  }

  async linkOAuth(
    userId: string,
    provider: AuthProvider,
    providerAccountId: string,
  ): Promise<void> {
    await db
      .insert(oauthAccounts)
      .values({
        id: crypto.randomUUID(),
        userId,
        provider,
        providerAccountId,
        createdAt: new Date().toISOString(),
      })
      .onConflictDoNothing({
        target: [oauthAccounts.provider, oauthAccounts.providerAccountId],
      });
  }
}
