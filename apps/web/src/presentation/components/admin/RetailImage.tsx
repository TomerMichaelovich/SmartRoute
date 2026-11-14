"use client";

import { useState } from "react";
import { retailImageUrl } from "@/src/presentation/lib/retail-image";

/**
 * The chain's photo of an imported product's barcode, loaded straight from its image
 * server when the admin looks (nothing is copied or stored). A click opens the large one.
 * Newer products only answer at the trim path, so that is the fallback (and then the
 * click opens it, as their large one is out of reach). Barcodes without a photo show the
 * empty frame.
 */
export function RetailImage({ itemKey, className = "h-8 w-8" }: { itemKey: string | null | undefined; className?: string }) {
  const [stage, setStage] = useState<"small" | "trim" | "failed">("small");
  const src = stage === "failed" ? null : retailImageUrl(itemKey, stage);
  const frame = `${className} shrink-0 rounded-lg border border-neutral-200`;
  if (!src) return <span className={`${frame} border-dashed`} />;
  return (
    <a href={stage === "trim" ? src : retailImageUrl(itemKey, "large")!} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
      {/* eslint-disable-next-line @next/next/no-img-element -- another site's image, shown as is; next/image would proxy it through our server */}
      <img src={src} alt="" loading="lazy" onError={() => setStage(stage === "small" ? "trim" : "failed")} className={`${frame} bg-white object-contain`} />
    </a>
  );
}
