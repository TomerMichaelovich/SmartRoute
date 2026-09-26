import type { User } from "@smartroute/core/domain/entities/user";
import { userRepository } from "@/src/infrastructure/container";
import type { GoogleProfile } from "./google-oauth";

const PROVIDER = "google" as const;

/**
 * Shared by the web OAuth callback and the mobile native-sign-in route:
 * 1. Known Google identity -> that account.
 * 2. Same email already registered (e.g. via password) -> link Google to it
 *    (Google has verified the address, so this is safe).
 * 3. Otherwise -> new passwordless account.
 */
export async function findOrCreateUserFromGoogleProfile(profile: GoogleProfile): Promise<User> {
  const existing = await userRepository.findByOAuth(PROVIDER, profile.providerAccountId);
  if (existing) return existing;

  const byEmail = await userRepository.findByEmail(profile.email);
  if (byEmail) {
    await userRepository.linkOAuth(byEmail.id, PROVIDER, profile.providerAccountId);
    return byEmail;
  }

  const user = await userRepository.create({
    id: crypto.randomUUID(),
    email: profile.email,
    displayName: profile.displayName,
    passwordHash: null,
  });
  await userRepository.linkOAuth(user.id, PROVIDER, profile.providerAccountId);
  return user;
}
