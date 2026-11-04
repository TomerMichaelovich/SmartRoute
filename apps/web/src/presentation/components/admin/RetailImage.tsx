"use client";

import { useState } from "react";
import { retailImageUrl } from "@/src/presentation/lib/retail-image";

/**
 * The chain's photo of an imported product's barcode, loaded straight from its image
 * server when the admin looks (nothing is copied or stored). A click opens the large one.
 * Barcodes without a photo show the empty frame.
 */
export function RetailImage({ itemKey, className = "h-8 w-8" }: { itemKey: string | null | undefined; className?: string }) {
  const [failed, setFailed] = useState(false);
  const small = retailImageUrl(itemKey);
  const frame = `${className} shrink-0 rounded-lg border border-neutral-200`;
  if (!small || failed) return <span className={`${frame} border-dashed`} />;
  return (
    <a href={retailImageUrl(itemKey, "large")!} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
      {/* eslint-disable-next-line @next/next/no-img-element -- another site's image, shown as is; next/image would proxy it through our server */}
      <img src={small} alt="" loading="lazy" onError={() => setFailed(true)} className={`${frame} bg-white object-contain`} />
    </a>
  );
}
