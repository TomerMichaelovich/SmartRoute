import { NextResponse } from "next/server";
import { effectivePlaceChoice } from "@smartroute/core/application/routing/place-choice";
import { effectiveKindChoice } from "@smartroute/core/application/routing/product-kind";
import {
  nodeRepository,
  productListingRepository,
  routeRepository,
  shoppingListRepository,
  storeRepository,
} from "@/src/infrastructure/container";
import { resolveListAccess } from "@/src/presentation/auth/list-access";
import { productsFor } from "@/src/presentation/lib/products-for";

// GET-by-id counterpart to POST /api/routes (route.ts, one level up), which creates routes.
// Needed because the web app's /route/[routeId] page fetches route/store/nodes/shoppingList/
// products directly via repositories inside a Server Component and joins them into
// display-ready "stopViews" there - there was no HTTP surface for that read before this,
// and the mobile app (React Native, no Server Components) can only reach data over REST.
// Promotions are intentionally left out of stopViews here - that's a separate, not-yet-built
// mobile feature (see ChecklistStopView.promotion on web).
export async function GET(_request: Request, { params }: { params: Promise<{ routeId: string }> }) {
  const { routeId } = await params;
  const route = await routeRepository.findById(routeId);
  if (!route) {
    return NextResponse.json({ error: `Route not found: ${routeId}` }, { status: 404 });
  }

  const [store, nodes, shoppingList] = await Promise.all([
    storeRepository.findById(route.storeId),
    nodeRepository.findByStore(route.storeId),
    shoppingListRepository.findById(route.shoppingListId),
  ]);
  if (!store || !shoppingList) {
    return NextResponse.json({ error: `Store or shopping list not found for route: ${routeId}` }, { status: 404 });
  }
  // A route shows its shopping list's items - same access rule as the list itself.
  if (!(await resolveListAccess(shoppingList))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const products = await productsFor({ items: shoppingList.items });
  const productById = new Map(products.map((p) => [p.id, p]));
  const itemById = new Map(shoppingList.items.map((i) => [i.id, i]));
  // Where the products picked for items stand here: a pick made at another branch says nothing.
  const hasPicks = shoppingList.items.some((i) => effectivePlaceChoice(i)?.productId);
  const placeOfProduct = new Map<string, string>();
  for (const listing of hasPicks ? await productListingRepository.findByStore(route.storeId) : []) {
    if (!placeOfProduct.has(listing.productId)) placeOfProduct.set(listing.productId, listing.nodeId);
  }

  const itemView = (itemId: string, stopNodeId?: string) => {
    const item = itemById.get(itemId);
    const product = item?.classification?.matchedProductId
      ? productById.get(item.classification.matchedProductId)
      : undefined;
    const pickedId = item ? effectivePlaceChoice(item)?.productId : undefined;
    const picked = pickedId && placeOfProduct.get(pickedId) === stopNodeId ? productById.get(pickedId) : undefined;
    const kind = item ? effectiveKindChoice(item) : null;
    return {
      id: itemId,
      // What the shopper is really after here, not the generic product the line was classified as.
      displayName: picked?.canonicalName ?? (kind ? `${item!.rawText} · ${kind.label}` : (product?.canonicalName ?? item?.rawText ?? itemId)),
      imageUrl: (picked ?? product)?.imageUrl,
    };
  };

  const stopViews = route.stops.map((stop) => ({ stop, items: stop.itemIds.map((id) => itemView(id, stop.nodeId)) }));
  // The list items left out of the route (not identified, or not carried by this store), so
  // the shopper can see which ones - route.unresolvedItemIds alone only gives their count.
  // Items removed from the list since the route was planned are dropped.
  const unresolvedItems = route.unresolvedItemIds
    .filter((itemId) => itemById.has(itemId))
    .map((itemId) => ({ id: itemId, displayName: itemView(itemId).displayName }));

  const mapImageUrl = store.mapImageUrl
    ? `${store.mapImageUrl}?v=${encodeURIComponent(store.updatedAt)}`
    : "";

  return NextResponse.json({ route, store, nodes, mapImageUrl, stopViews, unresolvedItems });
}
