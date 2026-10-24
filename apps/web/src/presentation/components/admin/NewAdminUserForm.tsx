"use client";

import { useActionState } from "react";
import type { IssuedCredentials } from "@/src/presentation/actions/admin-staff-actions";
import { AdminPermissionFields } from "./AdminPermissionFields";
import { IssuedCredentialsNotice } from "./IssuedCredentialsNotice";

interface NewAdminUserFormProps {
  stores: { id: string; name: string; address: string }[];
  createAdminUser: (prev: IssuedCredentials, formData: FormData) => Promise<IssuedCredentials>;
}

export function NewAdminUserForm({ stores, createAdminUser }: NewAdminUserFormProps) {
  const [state, action, pending] = useActionState(createAdminUser, null);

  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-base font-semibold text-neutral-900">משתמש ניהול חדש</h2>
      <input name="displayName" placeholder="שם (למשל: דני - מיפוי)" required className="rounded-lg border border-neutral-300 p-2" />
      <input
        name="username"
        placeholder="שם משתמש באנגלית (ריק = יונפק אוטומטית)"
        autoCapitalize="none"
        dir="ltr"
        className="rounded-lg border border-neutral-300 p-2 text-start"
      />
      <AdminPermissionFields stores={stores} />
      <p className="text-xs text-neutral-500">סיסמה תונפק אוטומטית ותוצג פעם אחת אחרי היצירה.</p>
      {state?.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}
      {state?.status === "issued" && <IssuedCredentialsNotice username={state.username} password={state.password} />}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white disabled:bg-neutral-300"
      >
        {pending ? "יוצר..." : "צור והנפק סיסמה"}
      </button>
    </form>
  );
}
