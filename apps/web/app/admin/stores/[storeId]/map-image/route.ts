import { storeRepository } from "@/src/infrastructure/container";
import { requireAdmin } from "@/src/presentation/auth/admin";

// The walkable-area editor reads the map photo's pixels in a canvas, which needs a same-origin
// (or CORS-enabled) image. Serving the blob through here avoids depending on the blob host's CORS.
export async function GET(_request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const { storeId } = await params;
  const store = await storeRepository.findById(storeId);
  // Relative (public/) images are same-origin already; only absolute blob URLs are proxied.
  if (!store?.mapImageUrl.startsWith("https://")) return new Response("Not found", { status: 404 });

  const upstream = await fetch(store.mapImageUrl, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) return new Response("Image unavailable", { status: 502 });
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/octet-stream",
      "Cache-Control": "private, no-store",
    },
  });
}
