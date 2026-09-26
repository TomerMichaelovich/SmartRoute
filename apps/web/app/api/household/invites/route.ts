import { NextResponse } from "next/server";
import { generateShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import { householdRepository } from "@/src/infrastructure/container";
import { requireOwnedHousehold } from "@/src/presentation/auth/household-api";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** REST counterpart of the `createInvite` Server Action. */
export async function POST() {
  const auth = await requireOwnedHousehold();
  if (auth instanceof NextResponse) return auth;

  let code = generateShareCode(8);
  while (await householdRepository.findValidInviteByCode(code)) {
    code = generateShareCode(8);
  }
  const invite = await householdRepository.createInvite(
    auth.membership.householdId,
    auth.user.id,
    code,
    new Date(Date.now() + INVITE_TTL_MS).toISOString(),
  );
  return NextResponse.json({ invite }, { status: 201 });
}
