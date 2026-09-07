"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import { householdRepository } from "@/src/infrastructure/container";
import { requireUser } from "@/src/presentation/auth/dal";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createHousehold(formData: FormData): Promise<void> {
  const user = await requireUser("/household");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  // One household per user in the pilot.
  if (await householdRepository.findMembershipForUser(user.id)) {
    redirect("/household");
  }

  await householdRepository.create(name, user.id);
  redirect("/household");
}

async function requireOwnedHousehold(): Promise<{ userId: string; householdId: string }> {
  const user = await requireUser("/household");
  const membership = await householdRepository.findMembershipForUser(user.id);
  if (!membership || membership.status !== "active" || membership.role !== "owner") {
    throw new Error("Not a household owner");
  }
  return { userId: user.id, householdId: membership.householdId };
}

export async function createInvite(): Promise<void> {
  const { userId, householdId } = await requireOwnedHousehold();
  let code = generateShareCode(8);
  while (await householdRepository.findValidInviteByCode(code)) {
    code = generateShareCode(8);
  }
  await householdRepository.createInvite(
    householdId,
    userId,
    code,
    new Date(Date.now() + INVITE_TTL_MS).toISOString(),
  );
  revalidatePath("/household");
}

export async function revokeInvite(formData: FormData): Promise<void> {
  await requireOwnedHousehold();
  const inviteId = String(formData.get("inviteId") ?? "");
  if (inviteId) {
    await householdRepository.revokeInvite(inviteId);
    revalidatePath("/household");
  }
}

export async function approveMember(formData: FormData): Promise<void> {
  const { householdId } = await requireOwnedHousehold();
  const userId = String(formData.get("userId") ?? "");
  if (userId) {
    await householdRepository.approveMember(householdId, userId);
    revalidatePath("/household");
  }
}

export async function removeMember(formData: FormData): Promise<void> {
  const { householdId, userId: ownerId } = await requireOwnedHousehold();
  const targetUserId = String(formData.get("userId") ?? "");
  if (targetUserId && targetUserId !== ownerId) {
    await householdRepository.removeMember(householdId, targetUserId);
    revalidatePath("/household");
  }
}

export async function leaveHousehold(): Promise<void> {
  const user = await requireUser("/household");
  const membership = await householdRepository.findMembershipForUser(user.id);
  if (!membership) redirect("/household");

  if (membership.role === "owner") {
    const active = await householdRepository.countActiveMembers(membership.householdId);
    if (active > 1) {
      // Owner must hand off / clear the household first.
      redirect("/household?error=owner_leave");
    }
  }
  await householdRepository.removeMember(membership.householdId, user.id);
  redirect("/household");
}

export async function requestJoin(formData: FormData): Promise<void> {
  const user = await requireUser("/household");
  const code = String(formData.get("code") ?? "").trim();

  const invite = await householdRepository.findValidInviteByCode(code);
  if (!invite) redirect("/household/join/invalid");

  const existing = await householdRepository.findMembershipForUser(user.id);
  if (existing) {
    if (existing.householdId === invite.householdId) redirect("/household");
    redirect(`/household/join/${code}?error=already_in_other`);
  }

  await householdRepository.addPendingMember(invite.householdId, user.id);
  redirect("/household");
}

export async function cancelJoinRequest(): Promise<void> {
  const user = await requireUser("/household");
  const membership = await householdRepository.findMembershipForUser(user.id);
  if (membership && membership.status === "pending") {
    await householdRepository.removeMember(membership.householdId, user.id);
  }
  redirect("/household");
}
