import "server-only";
import { cache } from "react";
import type { Household, HouseholdMembership } from "@smartroute/core/domain/entities/household";
import type { User } from "@smartroute/core/domain/entities/user";
import { householdRepository } from "@/src/infrastructure/container";
import { getCurrentUser } from "./dal";

export interface UserHousehold {
  user: User;
  membership: HouseholdMembership;
  household: Household;
}

/**
 * The current user's household context (one per user in the pilot). Returns
 * null for guests and for users not in any household. `membership.status` is
 * "pending" until the owner approves.
 */
export const getUserHousehold = cache(async (): Promise<UserHousehold | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const membership = await householdRepository.findMembershipForUser(user.id);
  if (!membership) return null;

  const household = await householdRepository.findById(membership.householdId);
  if (!household) return null;

  return { user, membership, household };
});

/**
 * Authorization gate for anything that touches a household's shared data.
 * Membership is checked live on every call, so removing a member revokes
 * access immediately - no session invalidation needed.
 */
export async function assertActiveMember(
  householdId: string,
  userId: string,
): Promise<HouseholdMembership> {
  const membership = await householdRepository.getMembership(householdId, userId);
  if (!membership || membership.status !== "active") {
    throw new Error("Not an active member of this household");
  }
  return membership;
}
