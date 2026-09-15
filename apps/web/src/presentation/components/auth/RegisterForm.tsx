"use client";

import Link from "next/link";
import { useActionState } from "react";
import { register, type AuthFormState } from "@/src/presentation/actions/auth-actions";
import { AuthField } from "./AuthField";
import { GoogleButton } from "./GoogleButton";
import { Button } from "@/src/presentation/components/ui/Button";
import { he } from "@smartroute/core/i18n/he";

const EMPTY: AuthFormState = {};

export function RegisterForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(register, EMPTY);

  return (
    <div className="flex flex-col gap-5">
      <GoogleButton next={next} />

      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <span className="h-px flex-1 bg-neutral-200" />
        {he.auth.google.or}
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      <form action={action} className="flex flex-col gap-4">
        {next && <input type="hidden" name="next" value={next} />}
        <AuthField
          id="displayName"
          name="displayName"
          label={he.auth.register.nameLabel}
          placeholder={he.auth.register.namePlaceholder}
          autoComplete="name"
          defaultValue={state.values?.displayName}
          error={state.fieldErrors?.displayName}
          required
        />
        <AuthField
          id="email"
          name="email"
          type="email"
          dir="ltr"
          label={he.auth.register.emailLabel}
          autoComplete="email"
          defaultValue={state.values?.email}
          error={state.fieldErrors?.email}
          required
        />
        <AuthField
          id="password"
          name="password"
          type="password"
          dir="ltr"
          label={he.auth.register.passwordLabel}
          hint={he.auth.register.passwordHint}
          autoComplete="new-password"
          error={state.fieldErrors?.password}
          required
        />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <Button type="submit" fullWidth disabled={pending}>
          {pending ? he.common.loading : he.auth.register.submit}
        </Button>
      </form>

      <p className="text-center text-sm text-neutral-600">
        {he.auth.register.haveAccount}{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="font-semibold text-cyan-700"
        >
          {he.auth.register.goToLogin}
        </Link>
      </p>
    </div>
  );
}
