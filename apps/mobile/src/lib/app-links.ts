/**
 * The public site shared links point at. Links under these paths open the app
 * directly via Android App Links (see app.json's intentFilters and the web's
 * /.well-known/assetlinks.json); otherwise they land on the site's
 * download-the-app page. Deliberately not EXPO_PUBLIC_API_BASE_URL - in dev
 * that's a LAN address nobody else can open.
 */
export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL || "https://navio.co.il";

export function siteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}

const SHARED_LINK_PATH = /^\/(household\/join|my-list)\/[A-Za-z0-9-]+$/;

/** Whether `path` is one of the in-app routes a shared link may open. */
export function isSharedLinkPath(path: string): boolean {
  return SHARED_LINK_PATH.test(path);
}
