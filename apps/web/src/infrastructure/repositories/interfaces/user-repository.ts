import type { AuthProvider, User } from "@smartroute/core/domain/entities/user";

export interface CreateUserInput {
  id: string;
  email: string;
  displayName: string;
  passwordHash?: string | null;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  /** Includes the password hash - infrastructure-only, for login verification. */
  findByEmailWithSecret(
    email: string,
  ): Promise<(User & { passwordHash: string | null }) | null>;
  create(input: CreateUserInput): Promise<User>;
  setPasswordHash(userId: string, passwordHash: string): Promise<void>;

  findByOAuth(
    provider: AuthProvider,
    providerAccountId: string,
  ): Promise<User | null>;
  linkOAuth(
    userId: string,
    provider: AuthProvider,
    providerAccountId: string,
  ): Promise<void>;
}
