/**
 * Wipes device-local, list-related state on logout so the next person on this
 * device doesn't see the previous user's list, saved route progress, or the
 * home widget. Auth itself lives in an httpOnly cookie the server clears - this
 * only covers what client JS wrote.
 *
 * Deliberately does NOT clear `smartroute:sessionId` (an anonymous analytics
 * id, not tied to the account).
 */
export function clearLocalUserData(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (key === "smartroute:myListCode" || key.startsWith("smartroute:route:")) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) window.localStorage.removeItem(key);
  } catch {
    // Best-effort - a blocked localStorage means there was nothing to leak anyway.
  }
  try {
    // So the guest-list claim check runs again for the next person who logs in.
    window.sessionStorage.removeItem("navio:guestClaimChecked");
  } catch {
    // ignore
  }
}
