import { NextResponse } from "next/server";
import { z } from "zod";
import { householdRepository } from "@/src/infrastructure/container";
import { requireListRole } from "@/src/presentation/lib/list-sharing";

const bodySchema = z.object({ userId: z.string().min(1) });

/** Approves a pending join request to this list (owner only). */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const auth = await requireListRole(code, "owner");
  if (auth instanceof NextResponse) return auth;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const groupId = auth.list.householdId;
  const target = groupId ? await householdRepository.getMembership(groupId, parsed.data.userId) : null;
  if (!groupId || !target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (target.role === "owner") {
    return NextResponse.json({ error: "cannot_change_owner" }, { status: 400 });
  }
  await householdRepository.approveMember(groupId, parsed.data.userId);
  return NextResponse.json({ ok: true });
}
