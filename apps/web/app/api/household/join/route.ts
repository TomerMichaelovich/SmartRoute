import { NextResponse } from "next/server";
import { z } from "zod";
import { householdRepository, shoppingListRepository } from "@/src/infrastructure/container";
import { getCurrentUser } from "@/src/presentation/auth/dal";

const bodySchema = z.object({ code: z.string().trim().min(1) });

/**
 * Asks to join the list an invite code belongs to. The list's owner approves
 * the request from the list's sharing panel; until then it stays pending. A
 * user may take part in any number of lists.
 */
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
  const list = invite ? await shoppingListRepository.findByHousehold(invite.householdId) : null;
  if (!invite || !list) {
    return NextResponse.json({ status: "invalid" }, { status: 404 });
  }

  if (list.ownerUserId === user.id) {
    return NextResponse.json({ status: "already_member" });
  }
  const existing = await householdRepository.getMembership(invite.householdId, user.id);
  if (existing?.status === "active") {
    return NextResponse.json({ status: "already_member" });
  }

  await householdRepository.addPendingMember(invite.householdId, user.id);
  return NextResponse.json({ status: "requested" }, { status: 201 });
}
