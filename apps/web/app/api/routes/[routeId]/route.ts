import { NextResponse } from "next/server";
import {
  nodeRepository,
  productRepository,
  routeRepository,
  shoppingListRepository,
  storeRepository,
} from "@/src/infrastructure/container";

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

  const [store, nodes, shoppingList, products] = await Promise.all([
    storeRepository.findById(route.storeId),
    nodeRepository.findByStore(route.storeId),
    shoppingListRepository.findById(route.shoppingListId),
    productRepository.findAllActive(),
  ]);
  if (!store || !shoppingList) {
    return NextResponse.json({ error: `Store or shopping list not found for route: ${routeId}` }, { status: 404 });
  }

  const productById = new Map(products.map((p) => [p.id, p]));
  const itemById = new Map(shoppingList.items.map((i) => [i.id, i]));

  const stopViews = route.stops.map((stop) => ({
    stop,
    items: stop.itemIds.map((itemId) => {
      const item = itemById.get(itemId);
      const product = item?.classification?.matchedProductId
        ? productById.get(item.classification.matchedProductId)
        : undefined;
      return {
        id: itemId,
        displayName: product?.canonicalName ?? item?.rawText ?? itemId,
        imageUrl: product?.imageUrl,
      };
    }),
  }));

  const mapImageUrl = store.mapImageUrl
    ? `${store.mapImageUrl}?v=${encodeURIComponent(store.updatedAt)}`
    : "";

  return NextResponse.json({ route, store, nodes, mapImageUrl, stopViews });
}
