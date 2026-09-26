import { NextResponse } from "next/server";
import { householdRepository } from "@/src/infrastructure/container";
import { requireOwnedHousehold } from "@/src/presentation/auth/household-api";

/** REST counterpart of the `revokeInvite` Server Action. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ inviteId: string }> }) {
  const auth = await requireOwnedHousehold();
  if (auth instanceof NextResponse) return auth;

  const { inviteId } = await params;
  await householdRepository.revokeInvite(inviteId);
  return NextResponse.json({ ok: true });
}
