"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { userRepository } from "@/src/infrastructure/container";
import { hashPassword, verifyPassword } from "@/src/infrastructure/auth/password";
import { createSession, destroySession } from "@/src/infrastructure/auth/session";
import { he } from "@smartroute/core/i18n/he";

export interface AuthFormState {
  error?: string;
  fieldErrors?: { email?: string; password?: string; displayName?: string };
  values?: { email?: string; displayName?: string };
}

const emailSchema = z
  .string()
  .trim()
  .min(1, he.auth.errors.emailRequired)
  .email(he.auth.errors.emailInvalid);

const passwordSchema = z.string().min(8, he.auth.errors.passwordTooShort);

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1, he.auth.errors.nameRequired),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, he.auth.errors.passwordRequired),
});

function safeNext(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw : "";
  // Only allow same-origin absolute paths, never a full URL (open-redirect guard).
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function register(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });

  const values = {
    email: String(formData.get("email") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
  };

  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    return {
      values,
      fieldErrors: {
        email: f.email?.[0],
        password: f.password?.[0],
        displayName: f.displayName?.[0],
      },
    };
  }

  const existing = await userRepository.findByEmail(parsed.data.email);
  if (existing) {
    return { values, fieldErrors: { email: he.auth.errors.emailTaken } };
  }

  const user = await userRepository.create({
    id: crypto.randomUUID(),
    email: parsed.data.email,
    displayName: parsed.data.displayName,
    passwordHash: await hashPassword(parsed.data.password),
  });

  await createSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function login(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  const values = { email: String(formData.get("email") ?? "") };

  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    return {
      values,
      fieldErrors: { email: f.email?.[0], password: f.password?.[0] },
    };
  }

  const record = await userRepository.findByEmailWithSecret(parsed.data.email);
  const ok = await verifyPassword(parsed.data.password, record?.passwordHash);
  if (!record || !ok) {
    return { values, error: he.auth.errors.invalidCredentials };
  }

  await createSession(record.id);
  redirect(safeNext(formData.get("next")));
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}
