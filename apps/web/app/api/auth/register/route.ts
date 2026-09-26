import { NextResponse } from "next/server";
import { userRepository } from "@/src/infrastructure/container";
import { hashPassword } from "@/src/infrastructure/auth/password";
import { createSession } from "@/src/infrastructure/auth/session";
import { registerSchema } from "@/src/presentation/auth/validation";
import { he } from "@smartroute/core/i18n/he";

/**
 * REST counterpart of the `register` Server Action (auth-actions.ts), for the
 * mobile app - React Native can't invoke a "use server" action directly, only
 * plain HTTP. Same validation, same user/session creation; returns the raw
 * session token in the JSON body instead of relying on a cookie jar, since
 * the mobile app stores it itself (expo-secure-store) and sends it back as
 * `Authorization: Bearer <token>`.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    return NextResponse.json(
      { error: "invalid", fieldErrors: { email: f.email?.[0], password: f.password?.[0], displayName: f.displayName?.[0] } },
      { status: 400 },
    );
  }

  const existing = await userRepository.findByEmail(parsed.data.email);
  if (existing) {
    return NextResponse.json(
      { error: "invalid", fieldErrors: { email: he.auth.errors.emailTaken } },
      { status: 409 },
    );
  }

  const user = await userRepository.create({
    id: crypto.randomUUID(),
    email: parsed.data.email,
    displayName: parsed.data.displayName,
    passwordHash: await hashPassword(parsed.data.password),
  });

  const { token, expiresAt } = await createSession(user.id);
  return NextResponse.json({ user, token, expiresAt: expiresAt.toISOString() }, { status: 201 });
}
