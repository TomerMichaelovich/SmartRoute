import { NextResponse } from "next/server";
import { z } from "zod";
import { pushTokenRepository } from "@/src/infrastructure/container";
import { getCurrentUser } from "@/src/presentation/auth/dal";

const bodySchema = z.object({
  token: z.string().regex(/^Expo(nent)?PushToken\[.+\]$/),
});

/** The mobile app registers its Expo push token after sign-in (see list-push.ts). */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  await pushTokenRepository.upsert(user.id, parsed.data.token);
  return NextResponse.json({ ok: true });
}

/** Called on sign-out, so a shared device stops receiving the previous user's list pushes. */
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  await pushTokenRepository.delete(user.id, parsed.data.token);
  return NextResponse.json({ ok: true });
}
