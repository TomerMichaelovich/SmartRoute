import { NextResponse } from "next/server";
import { householdRepository } from "@/src/infrastructure/container";
import { getCurrentUser } from "@/src/presentation/auth/dal";

/**
 * REST counterpart of the /household/join/[code] page's read side - lets the
 * mobile join screen show which household the code belongs to (and whether
 * the caller is already a member of it or another one) before asking for
 * confirmation. Requesting the join itself is POST /api/household/join.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { code } = await params;
  const invite = await householdRepository.findValidInviteByCode(code);
  if (!invite) {
    return NextResponse.json({ status: "invalid" });
  }

  const [household, membership] = await Promise.all([
    householdRepository.findById(invite.householdId),
    householdRepository.findMembershipForUser(user.id),
  ]);

  if (membership?.householdId === invite.householdId) {
    return NextResponse.json({ status: "already_member", household });
  }
  if (membership) {
    return NextResponse.json({ status: "already_in_other", household });
  }
  return NextResponse.json({ status: "joinable", household });
}
