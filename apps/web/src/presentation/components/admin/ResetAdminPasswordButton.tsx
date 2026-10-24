"use client";

import { useActionState } from "react";
import type { IssuedCredentials } from "@/src/presentation/actions/admin-staff-actions";
import { IssuedCredentialsNotice } from "./IssuedCredentialsNotice";

interface ResetAdminPasswordButtonProps {
  resetPassword: (prev: IssuedCredentials, formData: FormData) => Promise<IssuedCredentials>;
}

export function ResetAdminPasswordButton({ resetPassword }: ResetAdminPasswordButtonProps) {
  const [state, action, pending] = useActionState(resetPassword, null);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("להחליף את הסיסמה? הסיסמה הנוכחית תפסיק לעבוד והמשתמש ינותק.")) e.preventDefault();
      }}
      className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4"
    >
      <h2 className="text-base font-semibold text-neutral-900">סיסמה</h2>
      <input
        type="password"
        name="password"
        placeholder="סיסמה חדשה (לפחות 8 תווים, ריק = תונפק אוטומטית)"
        autoComplete="new-password"
        minLength={8}
        maxLength={128}
        dir="ltr"
        className="rounded-lg border border-neutral-300 p-2 text-start"
      />
      {state?.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}
      {state?.status === "issued" && <IssuedCredentialsNotice username={state.username} password={state.password} />}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg border border-neutral-300 px-4 py-2 font-medium text-neutral-800 disabled:text-neutral-400"
      >
        {pending ? "מחליף..." : "החלף סיסמה"}
      </button>
    </form>
  );
}
