import { NextResponse } from "next/server";
import { z } from "zod";
import { householdRepository } from "@/src/infrastructure/container";
import { requireOwnedHousehold } from "@/src/presentation/auth/household-api";

const bodySchema = z.object({ userId: z.string().min(1) });

/** REST counterpart of the `removeMember` Server Action. */
export async function POST(request: Request) {
  const auth = await requireOwnedHousehold();
  if (auth instanceof NextResponse) return auth;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (parsed.data.userId === auth.user.id) {
    return NextResponse.json({ error: "cannot_remove_self" }, { status: 400 });
  }
  await householdRepository.removeMember(auth.membership.householdId, parsed.data.userId);
  return NextResponse.json({ ok: true });
}
