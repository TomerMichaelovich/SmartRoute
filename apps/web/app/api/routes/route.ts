import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveAvailability } from "@smartroute/core/application/classification/resolve-availability";
import { placeDecisions } from "@smartroute/core/application/routing/place-choice";
import { buildRoute, choosePlaces } from "@smartroute/core/application/routing/route-service";
import {
  edgeRepository,
  nodeRepository,
  productListingRepository,
  routeRepository,
  shoppingListRepository,
  storeRepository,
} from "@/src/infrastructure/container";
import { shoppingListItemSchema } from "@/src/infrastructure/repositories/schemas";
import { resolveListAccess } from "@/src/presentation/auth/list-access";
import { genericSkuKeysFor, placeSkuKeys } from "@/src/presentation/lib/place-sku-keys";
import { productsFor } from "@/src/presentation/lib/products-for";

const requestSchema = z.object({
  storeId: z.string().min(1),
  shoppingListId: z.string().min(1),
  // Sent by the client rather than re-read from storage so Classification
  // Review corrections (edited matchedProductId) are reflected in the route
  // without needing a separate "update shopping list" endpoint.
  items: z.array(shoppingListItemSchema).min(1),
  // Re-planning mid-shop: item ids already collected, in tick order (see buildRoute).
  completedItemIds: z.array(z.string()).optional(),
  skippedItemIds: z.array(z.string()).optional(),
  nextStopNodeId: z.string().optional(),
});

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { storeId, shoppingListId } = parsed.data;

  // This also overwrites the list's items, so only someone who may edit the
  // list can route it (guest lists: anyone holding them, as everywhere else).
  const shoppingList = await shoppingListRepository.findById(shoppingListId);
  if (!shoppingList) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!(await resolveListAccess(shoppingList))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [store, nodes, edges, listings, products] = await Promise.all([
    storeRepository.findById(storeId),
    nodeRepository.findByStore(storeId),
    edgeRepository.findByStore(storeId),
    productListingRepository.findByStore(storeId),
    productsFor({ items: parsed.data.items, storeId }),
  ]);

  // Items were classified against the list's own store, which for a mobile home-screen
  // list is just a placeholder (the branch is picked only now) - re-resolve them against
  // the branch actually being routed, so a same-name product carried here is used.
  const available = parsed.data.items.map((item) =>
    item.classification
      ? { ...item, classification: resolveAvailability(item.classification, storeId, listings, products) }
      : item,
  );
  // Several products here answer to one item ("טחינה": generic or the chain's own,
  // on different shelves): the shopper's saved pick, else whichever keeps the walk
  // shortest. A barcode picked in the cheapest-basket popup that's linked to one
  // of them settles it too. Mid-shop the current pick stays put - the shopper may be heading to it.
  const replanning = Boolean(parsed.data.nextStopNodeId || parsed.data.completedItemIds?.length);
  const genericSkuKeys = await genericSkuKeysFor(available, storeId, listings, products);
  const skuKeys = await placeSkuKeys(available, storeId, listings, products, genericSkuKeys);
  const { chosen, flexible } = placeDecisions(available, storeId, listings, products, skuKeys, genericSkuKeys);
  if (replanning) {
    for (const item of available) {
      const current = item.classification?.matchedProductId;
      if (current && flexible.get(item.id)?.includes(current)) flexible.delete(item.id);
    }
  }
  let placed = new Map<string, string>();
  try {
    if (store && nodes.length > 0) {
      placed = choosePlaces({ storeId, items: available, flexible, listings, nodes, edges, mapWidth: store.mapWidth, mapHeight: store.mapHeight });
    }
  } catch {
    // A map gap (unreachable stop): keep the classified picks; buildRoute below reports it.
  }
  for (const [itemId, productId] of placed) chosen.set(itemId, productId);
  const items = available.map((item) => {
    const productId = chosen.get(item.id);
    if (!productId || !item.classification || productId === item.classification.matchedProductId) return item;
    // Routed here, so it's available here, whatever resolveAvailability said of the classified one.
    const classification = { ...item.classification, matchedProductId: productId, confidence: 1, source: "dictionary" as const };
    delete classification.availableAtStore;
    return { ...item, classification };
  });
  // Persist Classification Review corrections so the shopping list stays in sync -
  // the route page reads item display names from stored shopping-list items, not
  // from this request body, so without this the checklist would keep showing the
  // pre-correction product name. A product imported from this branch's price file
  // isn't written back, though: the list keeps the kind of product the line names
  // ("גבינה צהובה"), which the next branch and the cheapest basket read as before.
  // (Compared with the items as sent: resolveAvailability may already have swapped in
  // an imported product answering to the same name.)
  const productById = new Map(products.map((p) => [p.id, p]));
  const stored = items.map((item, i) => {
    const sent = parsed.data.items[i];
    const matched = item.classification?.matchedProductId;
    return productById.get(matched ?? "")?.sourceItemKey && matched !== sent.classification?.matchedProductId ? sent : item;
  });
  await shoppingListRepository.updateItems(shoppingListId, stored, new Date().toISOString());

  if (!store || nodes.length === 0) {
    return NextResponse.json({ error: `Store not found: ${storeId}` }, { status: 404 });
  }

  let route;
  try {
    route = buildRoute({
      routeId: crypto.randomUUID(),
      storeId,
      shoppingListId,
      items,
      listings,
      nodes,
      edges,
      mapWidth: store.mapWidth,
      mapHeight: store.mapHeight,
      completedItemIds: parsed.data.completedItemIds,
      skippedItemIds: parsed.data.skippedItemIds,
      nextStopNodeId: parsed.data.nextStopNodeId,
    });
  } catch (err) {
    // buildRoute() throws when the store's node graph has no entrance and/or checkout - a data
    // gap in the admin-authored map, not an unexpected failure. Surface it as a distinguishable
    // 400 so the client can explain it instead of showing a generic "something went wrong".
    const message = err instanceof Error ? err.message : "";
    if (message.includes("missing an entrance or checkout")) {
      return NextResponse.json({ code: "missing_entrance_or_checkout" }, { status: 400 });
    }
    // nearestNeighborOrder() throws when a stop is unreachable from the current position -
    // a gap in the admin-authored edge graph (missing connections), not an unexpected failure.
    if (message.startsWith("No path from")) {
      return NextResponse.json({ code: "disconnected_graph" }, { status: 400 });
    }
    throw err;
  }

  await routeRepository.create(route);

  return NextResponse.json(route, { status: 201 });
}
