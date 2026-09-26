import type { ShoppingList } from "@smartroute/core/domain/entities/shopping-list";
import { apiFetch } from "@/lib/api";
import { getMyListCode, setMyListCode, clearMyListCode } from "@/lib/my-list-storage";

export type ClaimResponse =
  | { status: "already_yours" | "claimed" | "kept_existing" | "new_empty"; list: ShoppingList }
  | { status: "not_claimable" | "not_found" }
  | { status: "conflict"; guestList: ShoppingList; existingList: ShoppingList; existingCount: number };

/**
 * RN port of the web's GuestListClaim: after a fresh login/registration/
 * Google sign-in, attach any locally-held guest shareCode to the account.
 * Callers (AuthContext) decide what to do with a "conflict" response - never
 * resolved automatically, so nothing is ever merged/overwritten silently.
 */
export async function claimGuestListIfAny(
  resolution?: "keep_existing" | "new_empty",
): Promise<ClaimResponse | null> {
  const code = await getMyListCode();
  if (!code) return null;

  const res = await apiFetch("/api/lists/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shareCode: code, resolution }),
  });
  const data = (await res.json()) as ClaimResponse;

  if (
    data.status === "claimed" ||
    data.status === "already_yours" ||
    data.status === "kept_existing" ||
    data.status === "new_empty"
  ) {
    if (data.list.shareCode) await setMyListCode(data.list.shareCode);
  } else if (data.status === "not_claimable" || data.status === "not_found") {
    await clearMyListCode();
  }

  return data;
}
