"use server";

import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizePermissions, type AdminPermissions, type AdminPrincipal } from "@smartroute/core/domain/entities/admin-user";
import { generatePassword, hashPassword } from "@/src/infrastructure/auth/password";
import { adminUserRepository, storeRepository } from "@/src/infrastructure/container";
import { requireAdmin } from "@/src/presentation/auth/admin";

/** What the panel shows once after issuing credentials - the password is never stored in the clear. */
export type IssuedCredentials = { status: "issued"; username: string; password: string } | { status: "error"; message: string } | null;

const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

/** Permissions from the form, keeping only stores that exist. */
async function permissionsFromForm(formData: FormData): Promise<AdminPermissions> {
  const permissions = normalizePermissions({
    sections: formData.getAll("sections").map(String),
    storeIds: formData.getAll("storeIds").map(String),
  });
  const storeIds = new Set((await storeRepository.findAll()).map((s) => s.id));
  return { ...permissions, storeIds: permissions.storeIds.filter((id) => storeIds.has(id)) };
}

const isSelf = (principal: AdminPrincipal, id: string) => principal.kind === "user" && principal.id === id;

export async function createAdminUser(_prev: IssuedCredentials, formData: FormData): Promise<IssuedCredentials> {
  await requireAdmin("staff");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const requested = String(formData.get("username") ?? "").trim().toLowerCase();
  if (!displayName) return { status: "error", message: "יש למלא שם" };
  if (requested && !USERNAME_PATTERN.test(requested)) {
    return { status: "error", message: "שם משתמש: 3-32 תווים, אותיות באנגלית, ספרות, נקודה, מקף או קו תחתון" };
  }

  const permissions = await permissionsFromForm(formData);
  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  // An empty username is issued for them; retry the rare collision.
  for (let attempt = 0; attempt < (requested ? 1 : 5); attempt++) {
    const username = requested || `navio-${randomInt(1000, 10000)}`;
    const created = await adminUserRepository.create({ id: crypto.randomUUID(), username, passwordHash, displayName, permissions });
    if (created) {
      revalidatePath("/admin/staff");
      return { status: "issued", username, password };
    }
  }
  return { status: "error", message: requested ? "שם המשתמש תפוס" : "לא הצלחנו להנפיק שם משתמש, נסו שוב" };
}

export async function updateAdminUser(id: string, formData: FormData): Promise<void> {
  const principal = await requireAdmin("staff");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const permissions = await permissionsFromForm(formData);
  let isActive = formData.get("isActive") === "on";
  // Nobody locks themselves out of this screen.
  if (isSelf(principal, id)) {
    isActive = true;
    if (!permissions.sections.includes("staff")) permissions.sections.push("staff");
  }
  await adminUserRepository.update(id, { ...(displayName ? { displayName } : {}), permissions, isActive });
  revalidatePath("/admin/staff");
  revalidatePath(`/admin/staff/${id}`);
}

// Used through useActionState, which also passes the previous state - not needed here.
export async function resetAdminUserPassword(id: string): Promise<IssuedCredentials> {
  await requireAdmin("staff");
  const user = await adminUserRepository.findById(id);
  if (!user) return { status: "error", message: "המשתמש לא נמצא" };
  const password = generatePassword();
  await adminUserRepository.resetPassword(id, await hashPassword(password));
  return { status: "issued", username: user.username, password };
}

export async function deleteAdminUser(id: string): Promise<void> {
  const principal = await requireAdmin("staff");
  if (isSelf(principal, id)) return;
  await adminUserRepository.delete(id);
  revalidatePath("/admin/staff");
  redirect("/admin/staff");
}
