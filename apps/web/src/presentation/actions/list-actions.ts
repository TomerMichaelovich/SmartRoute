"use server";

import { revalidatePath } from "next/cache";
import { shoppingListRepository } from "@/src/infrastructure/container";
import { requireUser } from "@/src/presentation/auth/dal";

/**
 * Every action re-checks that the target list is owned by the caller - a
 * client-side UI restriction is never enough (see the Next auth guide's
 * "Server Actions" note).
 */
async function assertOwnedList(listId: string): Promise<void> {
  const user = await requireUser("/my-lists");
  const list = await shoppingListRepository.findById(listId);
  if (!list || list.ownerUserId !== user.id || list.deletedAt) {
    throw new Error("Not authorized for this list");
  }
}

export async function setActiveList(formData: FormData): Promise<void> {
  const listId = String(formData.get("listId") ?? "");
  const user = await requireUser("/my-lists");
  await assertOwnedList(listId);
  await shoppingListRepository.setActive(listId, user.id);
  revalidatePath("/my-lists");
  revalidatePath("/");
}

export async function renameList(formData: FormData): Promise<void> {
  const listId = String(formData.get("listId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  await assertOwnedList(listId);
  if (name) {
    await shoppingListRepository.rename(listId, name);
    revalidatePath("/my-lists");
  }
}

export async function deleteList(formData: FormData): Promise<void> {
  const listId = String(formData.get("listId") ?? "");
  await assertOwnedList(listId);
  await shoppingListRepository.softDelete(listId, new Date().toISOString());
  revalidatePath("/my-lists");
  revalidatePath("/");
}
