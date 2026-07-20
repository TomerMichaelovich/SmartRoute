import { NextResponse } from "next/server";
import { z } from "zod";
import { analyticsRepository } from "@/src/infrastructure/container";
import { analyticsEventTypeSchema } from "@/src/infrastructure/repositories/json/schemas";

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

  await analyticsRepository.append({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...parsed.data,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
