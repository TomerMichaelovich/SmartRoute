"use client";

import { useState } from "react";
import { revokeInvite } from "@/src/presentation/actions/household-actions";
import { he } from "@smartroute/core/i18n/he";

export function InviteLink({ inviteId, code }: { inviteId: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/household/join/${code}`
      : `/household/join/${code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable - the link text is shown below regardless.
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-3">
      <p className="text-xs text-neutral-500">{he.household.invite.linkLabel}</p>
      <code className="break-all rounded-lg bg-neutral-50 px-2 py-1.5 text-xs text-neutral-700" dir="ltr">
        {url}
      </code>
      <div className="flex gap-3 text-sm">
        <button type="button" onClick={copy} className="font-medium text-cyan-700">
          {copied ? he.household.invite.copied : he.household.invite.copy}
        </button>
        <form action={revokeInvite}>
          <input type="hidden" name="inviteId" value={inviteId} />
          <button type="submit" className="text-red-600">
            {he.household.invite.revoke}
          </button>
        </form>
      </div>
    </div>
  );
}
