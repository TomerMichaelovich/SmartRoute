import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/src/infrastructure/auth/session";
import { analyticsRepository } from "@/src/infrastructure/container";
import { analyticsEventTypeSchema } from "@/src/infrastructure/repositories/schemas";

const requestSchema = z.object({
  type: analyticsEventTypeSchema,
  sessionId: z.string().min(1),
  storeId: z.string().optional(),
  routeId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  // Attribution comes from the caller's own session (cookie or bearer), so a
  // client can't file events under someone else's account.
  const userId = (await getSessionUserId()) ?? undefined;

  await analyticsRepository.append({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...parsed.data,
    userId,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
