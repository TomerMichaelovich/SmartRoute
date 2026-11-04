/**
 * Rami Levy's own product photo of a barcode, as their image server serves it. For the
 * admin's eyes only - telling what a cut-off price-file name really is - never shown to
 * shoppers: the photos are theirs to publish, not ours. Their internal codes
 * ("rami-levy:…", weighed items) have none.
 */
export function retailImageUrl(itemKey: string | null | undefined, size: "small" | "large" = "small"): string | null {
  if (!itemKey || !/^\d+$/.test(itemKey)) return null;
  return `https://img.rami-levy.co.il/product/${itemKey}/${size}.jpg`;
}
