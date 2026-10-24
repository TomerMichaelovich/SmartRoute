"use server";

import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, buildSessionToken, type AdminSessionSubject } from "@/src/infrastructure/admin-session";
import { verifyPassword } from "@/src/infrastructure/auth/password";
import { adminUserRepository } from "@/src/infrastructure/container";

function ownerPasswordMatches(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** An empty username is the owner's login (ADMIN_PASSWORD); anything else is an admin user. */
async function authenticate(username: string, password: string): Promise<AdminSessionSubject | null> {
  if (!username) return ownerPasswordMatches(password) ? { kind: "owner" } : null;
  const user = await adminUserRepository.findForLogin(username);
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) return null;
  await adminUserRepository.recordLogin(user.id);
  return { kind: "user", id: user.id, sessionVersion: user.sessionVersion };
}

export async function login(formData: FormData): Promise<void> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const subject = await authenticate(username, password);
  if (!subject) {
    redirect("/admin/login?error=1");
  }

  const { value, expires } = buildSessionToken(subject);
  const store = await cookies();
  store.set(ADMIN_SESSION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires,
    path: "/",
  });

  redirect("/admin");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_SESSION_COOKIE);
  redirect("/admin/login");
}
