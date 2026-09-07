export type HouseholdRole = "owner" | "member";
export type MembershipStatus = "active" | "pending";

export interface Household {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

export interface HouseholdMembership {
  householdId: string;
  userId: string;
  role: HouseholdRole;
  status: MembershipStatus;
  createdAt: string;
}

/** A member row joined with the user's display fields, for the members list. */
export interface HouseholdMemberView {
  userId: string;
  displayName: string;
  email: string;
  role: HouseholdRole;
  status: MembershipStatus;
}

export interface HouseholdInvite {
  id: string;
  householdId: string;
  code: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}
