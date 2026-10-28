import { normalizeHebrewText } from "@smartroute/core/application/classification/normalize-hebrew-text";
import { findShelfGroup } from "@smartroute/core/domain/value-objects/shelf-group";
import { catalogAdminRepository } from "@/src/infrastructure/container";
import { requireAdmin } from "@/src/presentation/auth/admin";

const MAX_RESULTS = 8;

/**
 * Reads for the store's map editor, too large to send with the page now that whole
 * price files are imported:
 *   ?q=<text>                    products to add, not yet placed in the store
 *   ?node=<id>&group=<groupId>   a shelf group's products placed at one node
 */
export async function GET(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  try {
    await requireAdmin({ mapStore: storeId });
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const url = new URL(request.url);
  const nodeId = url.searchParams.get("node");
  const groupId = url.searchParams.get("group");
  if (nodeId && groupId) {
    return Response.json(await catalogAdminRepository.groupProductsAtNode(storeId, nodeId, groupId));
  }

  const hits = await catalogAdminRepository.searchUnlisted(
    storeId,
    normalizeHebrewText(url.searchParams.get("q") ?? ""),
    MAX_RESULTS,
  );
  return Response.json(
    hits.map((hit) => ({
      id: hit.id,
      canonicalName: hit.canonicalName,
      // Imported products say which shelf group they belong to; hand-made ones their department.
      hint: (hit.shelfGroup && findShelfGroup(hit.shelfGroup)?.name) || hit.department,
      notCarried: hit.imported && !hit.carried,
      excluded: hit.excluded,
    })),
  );
}
