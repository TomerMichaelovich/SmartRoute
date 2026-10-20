import { Share } from "react-native";
import { he } from "@smartroute/core/i18n/he";
import { siteUrl } from "@/lib/app-links";

/** Invite link URL - the /household/join path is kept for App Links and already-sent links. */
export function inviteUrl(code: string): string {
  return siteUrl(`/household/join/${code}`);
}

/**
 * Opens the native share sheet with a list invite naming who sends it ("X invited you to
 * join list Y"). Resolves once it's dismissed.
 */
export async function shareInvite(inviterName: string, listName: string, code: string): Promise<void> {
  try {
    await Share.share({ message: he.myList.sharing.inviteMessage(inviterName, listName, inviteUrl(code)) });
  } catch {
    // User dismissed the share sheet.
  }
}
