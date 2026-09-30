import { NextResponse } from "next/server";
import { generateShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import { householdRepository } from "@/src/infrastructure/container";
import { ensureSharingGroup, requireListRole } from "@/src/presentation/lib/list-sharing";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Reuse an existing link unless it's about to expire, so someone opening it
// a little later still gets in.
const REUSE_MIN_REMAINING_MS = 24 * 60 * 60 * 1000;

/**
 * The list's invite link (owner only). Each list keeps one link: an existing
 * one is returned as long as it has a day left, otherwise a fresh 7-day link
 * is created. The list becomes shared on its first invite. Joining through
 * the link still waits for the owner's approval.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const auth = await requireListRole(code, "owner");
  if (auth instanceof NextResponse) return auth;

  const groupId = await ensureSharingGroup(auth.list, auth.user);

  const reusable = (await householdRepository.listActiveInvites(groupId))
    .filter((invite) => Date.parse(invite.expiresAt) - Date.now() > REUSE_MIN_REMAINING_MS)
    .sort((a, b) => b.expiresAt.localeCompare(a.expiresAt))[0];
  if (reusable) {
    return NextResponse.json({ invite: reusable });
  }

  let inviteCode = generateShareCode(8);
  while (await householdRepository.findValidInviteByCode(inviteCode)) {
    inviteCode = generateShareCode(8);
  }
  const invite = await householdRepository.createInvite(
    groupId,
    auth.user.id,
    inviteCode,
    new Date(Date.now() + INVITE_TTL_MS).toISOString(),
  );
  return NextResponse.json({ invite }, { status: 201 });
}
