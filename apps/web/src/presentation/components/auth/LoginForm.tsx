"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { login, type AuthFormState } from "@/src/presentation/actions/auth-actions";
import { AuthField } from "./AuthField";
import { GoogleButton } from "./GoogleButton";
import { Button } from "@/src/presentation/components/ui/Button";
import { he } from "@smartroute/core/i18n/he";

const EMPTY: AuthFormState = {};

export function LoginForm({ next, oauthError }: { next?: string; oauthError?: boolean }) {
  const [state, action, pending] = useActionState(login, EMPTY);
  const [showForgot, setShowForgot] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <GoogleButton next={next} />

      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <span className="h-px flex-1 bg-neutral-200" />
        {he.auth.google.or}
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      {oauthError && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {he.auth.errors.googleFailed}
        </p>
      )}

      <form action={action} className="flex flex-col gap-4">
        {next && <input type="hidden" name="next" value={next} />}
        <AuthField
          id="email"
          name="email"
          type="email"
          dir="ltr"
          label={he.auth.login.emailLabel}
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
          label={he.auth.login.passwordLabel}
          autoComplete="current-password"
          error={state.fieldErrors?.password}
          required
        />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <Button type="submit" fullWidth disabled={pending}>
          {pending ? he.common.loading : he.auth.login.submit}
        </Button>
      </form>

      <div className="text-center text-sm">
        <button
          type="button"
          onClick={() => setShowForgot((v) => !v)}
          className="text-neutral-500 underline"
        >
          {he.auth.login.forgotPassword}
        </button>
        {showForgot && (
          <p className="mt-2 text-xs text-neutral-500">
            {he.auth.login.forgotPasswordHelp}
          </p>
        )}
      </div>

      <p className="text-center text-sm text-neutral-600">
        {he.auth.login.noAccount}{" "}
        <Link
          href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
          className="font-semibold text-cyan-700"
        >
          {he.auth.login.goToRegister}
        </Link>
      </p>
    </div>
  );
}
