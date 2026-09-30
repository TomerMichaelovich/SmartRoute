import { NextResponse } from "next/server";
import { he } from "@smartroute/core/i18n/he";
import { householdRepository, shoppingListRepository } from "@/src/infrastructure/container";
import { getCurrentUser } from "@/src/presentation/auth/dal";

/**
 * Preview for an invite link (https://navio.co.il/household/join/<code> - the
 * path predates per-list sharing and is kept so App Links and already-sent
 * links keep working). Each invite belongs to one list's sharing group; this
 * tells the join screen which list it is and whether the caller is already in.
 * Requesting the join itself is POST /api/household/join.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { code } = await params;
  const invite = await householdRepository.findValidInviteByCode(code);
  const list = invite ? await shoppingListRepository.findByHousehold(invite.householdId) : null;
  if (!invite || !list) {
    return NextResponse.json({ status: "invalid" });
  }

  const listName = list.name ?? he.myList.defaultName();
  const membership = await householdRepository.getMembership(invite.householdId, user.id);
  if (list.ownerUserId === user.id || membership?.status === "active") {
    return NextResponse.json({ status: "already_member", listName });
  }
  if (membership?.status === "pending") {
    return NextResponse.json({ status: "pending", listName });
  }
  return NextResponse.json({ status: "joinable", listName });
}
