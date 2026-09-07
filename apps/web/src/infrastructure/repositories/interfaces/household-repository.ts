import type {
  Household,
  HouseholdInvite,
  HouseholdMemberView,
  HouseholdMembership,
} from "@smartroute/core/domain/entities/household";

export interface IHouseholdRepository {
  /** Creates the household and its owner membership (active) in one call. */
  create(name: string, ownerUserId: string): Promise<Household>;
  findById(id: string): Promise<Household | null>;

  /** The household this user belongs to (active or pending), or null. */
  findMembershipForUser(userId: string): Promise<HouseholdMembership | null>;
  getMembership(householdId: string, userId: string): Promise<HouseholdMembership | null>;
  listMembers(householdId: string): Promise<HouseholdMemberView[]>;

  addPendingMember(householdId: string, userId: string): Promise<void>;
  approveMember(householdId: string, userId: string): Promise<void>;
  removeMember(householdId: string, userId: string): Promise<void>;
  countActiveMembers(householdId: string): Promise<number>;

  createInvite(householdId: string, createdBy: string, code: string, expiresAt: string): Promise<HouseholdInvite>;
  findValidInviteByCode(code: string): Promise<HouseholdInvite | null>;
  listActiveInvites(householdId: string): Promise<HouseholdInvite[]>;
  revokeInvite(inviteId: string): Promise<void>;
}
