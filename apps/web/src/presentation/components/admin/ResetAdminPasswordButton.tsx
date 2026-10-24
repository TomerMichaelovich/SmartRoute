"use client";

import { useActionState } from "react";
import type { IssuedCredentials } from "@/src/presentation/actions/admin-staff-actions";
import { IssuedCredentialsNotice } from "./IssuedCredentialsNotice";

interface ResetAdminPasswordButtonProps {
  resetPassword: (prev: IssuedCredentials) => Promise<IssuedCredentials>;
}

export function ResetAdminPasswordButton({ resetPassword }: ResetAdminPasswordButtonProps) {
  const [state, action, pending] = useActionState(resetPassword, null);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("להנפיק סיסמה חדשה? הסיסמה הנוכחית תפסיק לעבוד והמשתמש ינותק.")) e.preventDefault();
      }}
      className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4"
    >
      <h2 className="text-base font-semibold text-neutral-900">סיסמה</h2>
      {state?.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}
      {state?.status === "issued" && <IssuedCredentialsNotice username={state.username} password={state.password} />}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg border border-neutral-300 px-4 py-2 font-medium text-neutral-800 disabled:text-neutral-400"
      >
        {pending ? "מנפיק..." : "הנפק סיסמה חדשה"}
      </button>
    </form>
  );
}
