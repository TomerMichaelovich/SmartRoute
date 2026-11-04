import { NextResponse } from "next/server";
import { resolveAvailability } from "@smartroute/core/application/classification/resolve-availability";
import { placeQuestions } from "@smartroute/core/application/routing/place-choice";
import { findShelfGroup } from "@smartroute/core/domain/value-objects/shelf-group";
import { normalizeShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import { nodeRepository, productListingRepository, shoppingListRepository } from "@/src/infrastructure/container";
import { resolveListAccess } from "@/src/presentation/auth/list-access";
import { genericSkuKeysFor, placeSkuKeys } from "@/src/presentation/lib/place-sku-keys";
import { productsFor } from "@/src/presentation/lib/products-for";

/**
 * Before routing at a mapped store: list items whose products stand in more than
 * one place there ("טחינה" -> the generic one or the chain's own; "גבינה צהובה" ->
 * the cheese fridge or the deli), one option per place. A place holding one product
 * is named after it; one holding several after its shelf group (or the generic
 * product among them), with how many there are. Items with a saved choice that
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
    productsFor({ items: list.items, storeId }),
    nodeRepository.findByStore(storeId),
  ]);
  const items = list.items.map((item) =>
    item.classification ? { ...item, classification: resolveAvailability(item.classification, storeId, listings, products) } : item,
  );
  const productById = new Map(products.map((p) => [p.id, p]));
  const nodeLabel = new Map(nodes.map((n) => [n.id, n.label]));
  const placeName = (productId: string, productIds: string[]) => {
    const representative = productById.get(productId);
    const name = representative?.canonicalName ?? "";
    if (productIds.length === 1) return name;
    // Several on one shelf: named by the generic product among them, else by their shelf group.
    const groups = new Set(productIds.map((id) => productById.get(id)?.shelfGroup));
    const group = representative?.sourceItemKey && groups.size === 1 ? findShelfGroup([...groups][0] ?? "") : undefined;
    return `${group?.name ?? name} (${productIds.length} מוצרים)`;
  };

  const genericSkuKeys = await genericSkuKeysFor(items, storeId, listings, products);
  const skuKeys = await placeSkuKeys(items, storeId, listings, products, genericSkuKeys);
  return NextResponse.json({
    // Same shape as before places were grouped, so installed app versions read it unchanged.
    items: placeQuestions(items, storeId, listings, products, skuKeys, genericSkuKeys).map((q) => ({
      itemId: q.itemId,
      rawText: q.rawText,
      options: q.options.map((o) => ({
        productId: o.productId,
        name: placeName(o.productId, o.productIds),
        location: nodeLabel.get(o.nodeId) ?? null,
      })),
    })),
  });
}
