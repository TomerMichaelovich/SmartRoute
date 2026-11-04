import { apiFetch } from "@/lib/api";

// The shopper is waiting to see the item added: past this, ask "did you mean" as before.
const TIMEOUT_MS = 1500;

/**
 * Whether the server recognizes a line the device's generic catalog doesn't - an alias
 * of products imported from price files ("ג'ין"). False when offline or slow.
 */
export async function isKnownLine(rawText: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await apiFetch(`/api/classify/known?text=${encodeURIComponent(rawText)}`, { signal: controller.signal });
    if (!res.ok) return false;
    const data: { known?: boolean } = await res.json();
    return data.known === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
