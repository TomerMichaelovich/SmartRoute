/**
 * Rami Levy's own product photo of a barcode, as their image server serves it. For the
 * admin's eyes only - telling what a cut-off price-file name really is - never shown to
 * shoppers: the photos are theirs to publish, not ours. Their own internal codes
 * ("rami-levy:…", weighed items) are looked up by the bare code - some have a photo,
 * e.g. packed produce sold by weight; other chains' internal codes mean nothing there.
 *
 * Products added in recent years keep small/large under an internal id of theirs
 * (/product/{barcode}/{id}/…), so the barcode-only path is denied for them; "trim" (a
 * 320px-wide crop) sits at the barcode-only path for old and new alike.
 */
export function retailImageUrl(itemKey: string | null | undefined, size: "small" | "large" | "trim" = "small"): string | null {
  const code = itemKey?.replace(/^rami-levy:/, "");
  if (!code || !/^\d+$/.test(code)) return null;
  return `https://img.rami-levy.co.il/product/${code}/${size}.jpg`;
}
