"use client";

import { useState } from "react";

/** Shown once, right after credentials are issued - the password can't be looked up again. */
export function IssuedCredentialsNotice({ username, password }: { username: string; password: string }) {
  const [copied, setCopied] = useState(false);
  const text = `שם משתמש: ${username}\nסיסמה: ${password}`;

  return (
    <div role="status" className="flex flex-col gap-2 rounded-lg border border-green-300 bg-green-50 p-3 text-sm">
      <p className="font-semibold text-green-800">פרטי הכניסה הונפקו. העתיקו אותם עכשיו: הסיסמה לא תוצג שוב.</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1" dir="ltr">
        <dt className="text-neutral-500">Username</dt>
        <dd className="font-mono text-neutral-900">{username}</dd>
        <dt className="text-neutral-500">Password</dt>
        <dd className="font-mono text-neutral-900">{password}</dd>
      </dl>
      <button
        type="button"
        onClick={() =>
          navigator.clipboard
            ?.writeText(text)
            .then(() => setCopied(true))
            .catch(() => {})
        }
        className="self-start rounded-lg border border-green-300 bg-white px-3 py-1 font-medium text-green-800"
      >
        {copied ? "✓ הועתק" : "העתק"}
      </button>
    </div>
  );
}
