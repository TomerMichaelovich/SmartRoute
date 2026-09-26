import { NextResponse } from "next/server";
import { userRepository } from "@/src/infrastructure/container";
import { verifyPassword } from "@/src/infrastructure/auth/password";
import { createSession } from "@/src/infrastructure/auth/session";
import { loginSchema } from "@/src/presentation/auth/validation";
import { he } from "@smartroute/core/i18n/he";

/** REST counterpart of the `login` Server Action - see register/route.ts for why. */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    return NextResponse.json(
      { error: "invalid", fieldErrors: { email: f.email?.[0], password: f.password?.[0] } },
      { status: 400 },
    );
  }

  const record = await userRepository.findByEmailWithSecret(parsed.data.email);
  const ok = await verifyPassword(parsed.data.password, record?.passwordHash);
  if (!record || !ok) {
    return NextResponse.json({ error: he.auth.errors.invalidCredentials }, { status: 401 });
  }

  const { token, expiresAt } = await createSession(record.id);
  const user = { id: record.id, email: record.email, displayName: record.displayName, createdAt: record.createdAt };
  return NextResponse.json({ user, token, expiresAt: expiresAt.toISOString() });
}
