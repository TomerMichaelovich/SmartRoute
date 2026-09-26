import { NextResponse } from "next/server";
import { z } from "zod";
import { householdRepository } from "@/src/infrastructure/container";
import { getCurrentUser } from "@/src/presentation/auth/dal";

const bodySchema = z.object({ code: z.string().trim().min(1) });

/** REST counterpart of the `requestJoin` Server Action. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const invite = await householdRepository.findValidInviteByCode(parsed.data.code);
  if (!invite) {
    return NextResponse.json({ status: "invalid" }, { status: 404 });
  }

  const existing = await householdRepository.findMembershipForUser(user.id);
  if (existing) {
    if (existing.householdId === invite.householdId) {
      return NextResponse.json({ status: "already_member" });
    }
    return NextResponse.json({ status: "already_in_other" });
  }

  await householdRepository.addPendingMember(invite.householdId, user.id);
  return NextResponse.json({ status: "requested" }, { status: 201 });
}
