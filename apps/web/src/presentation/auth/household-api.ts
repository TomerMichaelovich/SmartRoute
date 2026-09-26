import "server-only";
import { NextResponse } from "next/server";
import type { User } from "@smartroute/core/domain/entities/user";
import type { HouseholdMembership } from "@smartroute/core/domain/entities/household";
import { householdRepository } from "@/src/infrastructure/container";
import { getCurrentUser } from "./dal";

/**
 * Shared by the household REST routes (mobile) - same authorization rules as
 * the Server Actions in household-actions.ts, just returning a NextResponse
 * instead of redirecting.
 */
export async function requireActiveMembership(): Promise<
  { user: User; membership: HouseholdMembership } | NextResponse
> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await householdRepository.findMembershipForUser(user.id);
  if (!membership || membership.status !== "active") {
    return NextResponse.json({ error: "not_a_member" }, { status: 403 });
  }
  return { user, membership };
}

export async function requireOwnedHousehold(): Promise<
  { user: User; membership: HouseholdMembership } | NextResponse
> {
  const result = await requireActiveMembership();
  if (result instanceof NextResponse) return result;
  if (result.membership.role !== "owner") {
    return NextResponse.json({ error: "not_owner" }, { status: 403 });
  }
  return result;
}
