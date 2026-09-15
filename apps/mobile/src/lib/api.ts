const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error(
    "EXPO_PUBLIC_API_BASE_URL is not set - point it at the running `next dev` server's LAN address (see apps/web/next.config.ts's allowedDevOrigins).",
  );
}

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

/**
 * Store/product asset URLs (mapImageUrl, product icon src) come back as either an absolute
 * Vercel Blob URL (admin-uploaded photos) or a root-relative path served by the web app's own
 * public/ folder (seeded demo stores, e.g. "/store-maps/ramat-gan-1.svg") - only the latter
 * needs the API base URL prefix to resolve on a device with no relative-URL context.
 */
export function resolveAssetUrl(url: string): string {
  return /^https?:\/\//.test(url) ? url : apiUrl(url);
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}
