import { NextResponse } from "next/server";
import { householdRepository } from "@/src/infrastructure/container";
import { requireListRole } from "@/src/presentation/lib/list-sharing";

/** A participant (not the owner) leaves a list shared with them. */
export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const auth = await requireListRole(code, "member");
  if (auth instanceof NextResponse) return auth;

  if (auth.kind === "owner" || !auth.list.householdId) {
    return NextResponse.json({ error: "owner_cannot_leave" }, { status: 400 });
  }
  await householdRepository.removeMember(auth.list.householdId, auth.user.id);
  return NextResponse.json({ ok: true });
}
