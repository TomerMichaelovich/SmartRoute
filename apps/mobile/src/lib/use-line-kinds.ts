import { useEffect, useState } from "react";
import type { LineKind } from "@smartroute/core/application/routing/product-kind";
import { apiFetch } from "@/lib/api";

// Asked once typing pauses, not on every letter.
const TYPING_PAUSE_MS = 250;
const MIN_LENGTH = 2;

/**
 * The kinds of product the line being typed could mean ("קולה": בקבוק, פחית, שישייה), as
 * optional buttons. Only ever for the text as it is now, so a button can't be tapped for
 * what was typed a moment ago. None when offline: the line is simply added as typed.
 */
export function useLineKinds(text: string): LineKind[] {
  const line = text.trim();
  const [found, setFound] = useState<{ line: string; kinds: LineKind[] } | null>(null);

  useEffect(() => {
    if (line.length < MIN_LENGTH) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      apiFetch(`/api/classify/kinds?text=${encodeURIComponent(line)}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { kinds: [] }))
        .then((data: { kinds?: LineKind[] }) => setFound({ line, kinds: data.kinds ?? [] }))
        .catch(() => {});
    }, TYPING_PAUSE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [line]);

  return found?.line === line ? found.kinds : [];
}
