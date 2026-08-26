import { NextResponse } from "next/server";
import { z } from "zod";
import { buildRoute } from "@/src/application/routing/route-service";
import {
  edgeRepository,
  nodeRepository,
  productListingRepository,
  routeRepository,
  shoppingListRepository,
  storeRepository,
} from "@/src/infrastructure/container";
import { shoppingListItemSchema } from "@/src/infrastructure/repositories/schemas";

const requestSchema = z.object({
  storeId: z.string().min(1),
  shoppingListId: z.string().min(1),
  // Sent by the client rather than re-read from storage so Classification
  // Review corrections (edited matchedProductId) are reflected in the route
  // without needing a separate "update shopping list" endpoint.
  items: z.array(shoppingListItemSchema).min(1),
});

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { storeId, shoppingListId, items } = parsed.data;

  const [store, nodes, edges, listings] = await Promise.all([
    storeRepository.findById(storeId),
    nodeRepository.findByStore(storeId),
    edgeRepository.findByStore(storeId),
    productListingRepository.findByStore(storeId),
    // Persist Classification Review corrections so the shopping list stays in sync -
    // the route page reads item display names from stored shopping-list items, not
    // from this request body, so without this the checklist would keep showing the
    // pre-correction product name.
    shoppingListRepository.updateItems(shoppingListId, items, new Date().toISOString()),
  ]);

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
