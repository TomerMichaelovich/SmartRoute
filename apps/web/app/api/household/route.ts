import { NextResponse } from "next/server";
import { z } from "zod";
import { householdRepository, shoppingListRepository } from "@/src/infrastructure/container";
import { getCurrentUser } from "@/src/presentation/auth/dal";

/**
 * REST counterpart of the household page's server-side assembly (app/household/page.tsx)
 * and the `createHousehold` action, for the mobile app.
 *
 * GET: the caller's full household context in one round trip - membership,
 * household, sorted members (owner first), the owner's active invites, and
 * whether a shared list already exists. `household: null` means "no household
 * yet" (the "none" state on web).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const membership = await householdRepository.findMembershipForUser(user.id);
  if (!membership) {
    return NextResponse.json({ household: null });
  }

  const household = await householdRepository.findById(membership.householdId);
  if (!household) {
    return NextResponse.json({ household: null });
  }

  if (membership.status === "pending") {
    return NextResponse.json({ household, membership, members: [], invites: [], sharedList: null });
  }

  const isOwner = membership.role === "owner";
  const [members, invites, sharedList] = await Promise.all([
    householdRepository.listMembers(household.id),
    isOwner ? householdRepository.listActiveInvites(household.id) : Promise.resolve([]),
    shoppingListRepository.findByHousehold(household.id),
  ]);
  members.sort((a, b) => {
    const rank = (m: (typeof members)[number]) => (m.role === "owner" ? 0 : m.status === "active" ? 1 : 2);
    return rank(a) - rank(b);
  });

  return NextResponse.json({ household, membership, members, invites, sharedList });
}

const createSchema = z.object({ name: z.string().trim().min(1) });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  // One household per user in the pilot.
  if (await householdRepository.findMembershipForUser(user.id)) {
    return NextResponse.json({ error: "already_in_household" }, { status: 409 });
  }

  const household = await householdRepository.create(parsed.data.name, user.id);
  return NextResponse.json({ household }, { status: 201 });
}
