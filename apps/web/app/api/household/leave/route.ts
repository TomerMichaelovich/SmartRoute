import { NextResponse } from "next/server";
import { householdRepository } from "@/src/infrastructure/container";
import { getCurrentUser } from "@/src/presentation/auth/dal";

/** REST counterpart of the `leaveHousehold` Server Action. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const membership = await householdRepository.findMembershipForUser(user.id);
  if (!membership) {
    return NextResponse.json({ ok: true });
  }

  if (membership.role === "owner") {
    const active = await householdRepository.countActiveMembers(membership.householdId);
    if (active > 1) {
      return NextResponse.json({ error: "owner_leave" }, { status: 409 });
    }
  }
  await householdRepository.removeMember(membership.householdId, user.id);
  return NextResponse.json({ ok: true });
}
