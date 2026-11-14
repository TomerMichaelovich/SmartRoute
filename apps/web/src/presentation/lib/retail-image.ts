/**
 * Rami Levy's own product photo of a barcode, as their image server serves it. For the
 * admin's eyes only - telling what a cut-off price-file name really is - never shown to
 * shoppers: the photos are theirs to publish, not ours. Their internal codes
 * ("rami-levy:…", weighed items) have none.
 *
 * Products added in recent years keep small/large under an internal id of theirs
 * (/product/{barcode}/{id}/…), so the barcode-only path is denied for them; "trim" (a
 * 320px-wide crop) sits at the barcode-only path for old and new alike.
 */
export function retailImageUrl(itemKey: string | null | undefined, size: "small" | "large" | "trim" = "small"): string | null {
  if (!itemKey || !/^\d+$/.test(itemKey)) return null;
  return `https://img.rami-levy.co.il/product/${itemKey}/${size}.jpg`;
}
