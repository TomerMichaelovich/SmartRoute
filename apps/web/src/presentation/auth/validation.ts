import { z } from "zod";
import { he } from "@smartroute/core/i18n/he";

/**
 * Shared by the web Server Actions (auth-actions.ts, form-based) and the
 * mobile-facing REST routes (app/api/auth/*, JSON-based) so both surfaces
 * enforce identical rules instead of drifting apart.
 */
export const emailSchema = z
  .string()
  .trim()
  .min(1, he.auth.errors.emailRequired)
  .email(he.auth.errors.emailInvalid);

export const passwordSchema = z.string().min(8, he.auth.errors.passwordTooShort);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1, he.auth.errors.nameRequired),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, he.auth.errors.passwordRequired),
});
