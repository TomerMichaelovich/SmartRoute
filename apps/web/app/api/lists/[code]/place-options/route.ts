import { NextResponse } from "next/server";
import { resolveAvailability } from "@smartroute/core/application/classification/resolve-availability";
import { placeQuestions } from "@smartroute/core/application/routing/place-choice";
import { normalizeShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import {
  nodeRepository,
  productListingRepository,
  productRepository,
  shoppingListRepository,
} from "@/src/infrastructure/container";
import { resolveListAccess } from "@/src/presentation/auth/list-access";
import { placeSkuKeys } from "@/src/presentation/lib/place-sku-keys";

/**
 * Before routing at a mapped store: list items that several products carried
 * there answer to ("טחינה" -> the generic one or the chain's own), each with
 * its options and where in the store it is. Items with a saved choice that
 * applies here aren't asked again.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const storeId = new URL(request.url).searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ error: "storeId is required" }, { status: 400 });

  const list = await shoppingListRepository.findByShareCode(normalizeShareCode(code));
  if (!list) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!(await resolveListAccess(list))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const [listings, products, nodes] = await Promise.all([
    productListingRepository.findByStore(storeId),
    productRepository.findAllActive(),
    nodeRepository.findByStore(storeId),
  ]);
  const items = list.items.map((item) =>
    item.classification ? { ...item, classification: resolveAvailability(item.classification, storeId, listings, products) } : item,
  );
  const productById = new Map(products.map((p) => [p.id, p]));
  const nodeLabel = new Map(nodes.map((n) => [n.id, n.label]));
  const locationOf = (productId: string) => {
    const listing = listings.find((l) => l.productId === productId && l.storeId === storeId);
    return listing ? (nodeLabel.get(listing.nodeId) ?? null) : null;
  };

  return NextResponse.json({
    items: placeQuestions(items, storeId, listings, products, await placeSkuKeys(items, storeId, listings, products)).map((q) => ({
      itemId: q.itemId,
      rawText: q.rawText,
      options: q.productIds.map((productId) => ({
        productId,
        name: productById.get(productId)?.canonicalName ?? "",
        location: locationOf(productId),
      })),
    })),
  });
}
