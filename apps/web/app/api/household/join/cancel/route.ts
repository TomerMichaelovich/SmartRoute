import { NextResponse } from "next/server";
import { householdRepository } from "@/src/infrastructure/container";
import { getCurrentUser } from "@/src/presentation/auth/dal";

/** REST counterpart of the `cancelJoinRequest` Server Action. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const membership = await householdRepository.findMembershipForUser(user.id);
  if (membership && membership.status === "pending") {
    await householdRepository.removeMember(membership.householdId, user.id);
  }
  return NextResponse.json({ ok: true });
}
