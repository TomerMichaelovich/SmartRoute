/**
 * Where the public site sends visitors: the mobile app in the stores, or
 * straight into the installed app for a shared link (household invite, shared
 * list). Must stay in sync with apps/mobile/app.json (package + scheme) and
 * apps/mobile/src/lib/install-referrer.ts (the referrer key).
 */
export const ANDROID_PACKAGE = "com.smartroute.app";
const APP_SCHEME = "smartroute";

/** Play Store listing isn't live until this is "true" - the button shows "coming soon" instead. */
export const PLAY_STORE_LIVE = process.env.NAVIO_PLAY_STORE_LIVE === "true";
/** App Store link; the button is hidden until it's set. */
export const APP_STORE_URL = process.env.NAVIO_APP_STORE_URL || null;

/**
 * Play Store listing URL. With `deepPath`, it's carried through the install as
 * a Play Install Referrer so the app can resume that link on first launch
 * (deferred deep link) - Android only; iOS has no equivalent.
 */
export function playStoreUrl(deepPath?: string): string {
  const base = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
  if (!deepPath) return base;
  return `${base}&referrer=${encodeURIComponent(`navio_path=${encodeURIComponent(deepPath)}`)}`;
}

/**
 * Android intent URL that opens `path` in the installed app, falling back to
 * the Play Store (with the path as referrer) when it isn't installed. Only a
 * backup for when the https App Link wasn't intercepted by the app (e.g. the
 * link was opened from inside a browser, or App Links verification failed).
 */
export function androidIntentUrl(path: string): string {
  const fallback = PLAY_STORE_LIVE ? `;S.browser_fallback_url=${encodeURIComponent(playStoreUrl(path))}` : "";
  return `intent://${path.replace(/^\//, "")}#Intent;scheme=${APP_SCHEME};package=${ANDROID_PACKAGE}${fallback};end`;
}

/** Business contact for the landing page's retailer CTA; the CTA is hidden until it's set. */
export const CONTACT_EMAIL = process.env.NAVIO_CONTACT_EMAIL || null;
