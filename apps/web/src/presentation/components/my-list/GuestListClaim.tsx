"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ShoppingList } from "@smartroute/core/domain/entities/shopping-list";
import { Button } from "@/src/presentation/components/ui/Button";
import { he } from "@smartroute/core/i18n/he";
import {
  clearMyListCode,
  getMyListCode,
  setMyListCode,
} from "@/src/presentation/lib/my-list-storage";

const DONE_FLAG = "navio:guestClaimChecked";

type ClaimResponse =
  | { status: "already_yours" | "claimed" | "kept_existing" | "new_empty"; list: ShoppingList }
  | { status: "not_claimable" | "not_found" }
  | { status: "conflict"; guestList: ShoppingList; existingList: ShoppingList; existingCount: number };

/**
 * Runs once after login/registration: if the browser still holds a guest
 * list's shareCode, it attaches that list to the account. On a conflict
 * (the account already has a list) it shows the user a choice - nothing is
 * merged or overwritten without an explicit pick.
 *
 * Mounted on pages a freshly-authenticated user is likely to land on
 * (home, "my lists").
 */
export function GuestListClaim({ loggedIn }: { loggedIn: boolean }) {
  const router = useRouter();
  const ran = useRef(false);
  const [conflict, setConflict] = useState<Extract<ClaimResponse, { status: "conflict" }> | null>(
    null,
  );
  const [claimed, setClaimed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loggedIn || ran.current) return;
    ran.current = true;

    let sessionChecked = false;
    try {
      sessionChecked = window.sessionStorage.getItem(DONE_FLAG) === "1";
    } catch {
      // sessionStorage blocked - just proceed, the call is idempotent.
    }
    if (sessionChecked) return;

    const code = getMyListCode();
    if (!code) {
      markDone();
      return;
    }

    void send({ shareCode: code });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  function markDone() {
    try {
      window.sessionStorage.setItem(DONE_FLAG, "1");
    } catch {
      // ignore
    }
  }

  async function send(body: { shareCode: string; resolution?: "keep_existing" | "new_empty" }) {
    setBusy(true);
    try {
      const res = await fetch("/api/lists/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as ClaimResponse;

      if (data.status === "conflict") {
        setConflict(data);
        return;
      }

      if (
        data.status === "claimed" ||
        data.status === "already_yours" ||
        data.status === "kept_existing" ||
        data.status === "new_empty"
      ) {
        if (data.list.shareCode) setMyListCode(data.list.shareCode);
        if (data.status === "claimed") setClaimed(true);
      } else {
        // not_claimable | not_found - the guest code is stale, drop it.
        clearMyListCode();
      }

      setConflict(null);
      markDone();
      router.refresh();
    } catch {
      // Best-effort - the guest code stays put and we retry on the next load.
      ran.current = false;
    } finally {
      setBusy(false);
    }
  }

  if (conflict) {
    return (
      <Overlay>
        <h2 className="text-lg font-bold text-neutral-900">{he.myList.claim.conflictTitle}</h2>
        <p className="text-sm text-neutral-600">{he.myList.claim.conflictBody}</p>
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex flex-col gap-1">
            <Button
              fullWidth
              disabled={busy}
              onClick={() => send({ shareCode: getMyListCode() ?? "", resolution: "keep_existing" })}
            >
              {he.myList.claim.keepExisting}
            </Button>
            <span className="text-xs text-neutral-500">{he.myList.claim.keepExistingHint}</span>
          </div>
          <div className="flex flex-col gap-1">
            <Button
              variant="secondary"
              fullWidth
              disabled={busy}
              onClick={() => send({ shareCode: getMyListCode() ?? "", resolution: "new_empty" })}
            >
              {he.myList.claim.newEmpty}
            </Button>
            <span className="text-xs text-neutral-500">{he.myList.claim.newEmptyHint}</span>
          </div>
        </div>
      </Overlay>
    );
  }

  if (claimed) {
    return (
      <Overlay>
        <h2 className="text-lg font-bold text-neutral-900">{he.myList.claim.claimedTitle}</h2>
        <p className="text-sm text-neutral-600">{he.myList.claim.claimedBody}</p>
        <Button fullWidth onClick={() => setClaimed(false)}>
          {he.myList.claim.dismiss}
        </Button>
      </Overlay>
    );
  }

  return null;
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5">
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-2xl bg-white p-5 shadow-xl">
        {children}
      </div>
    </div>
  );
}
