import { NextResponse } from "next/server";
import { z } from "zod";
import { buildRoute } from "@/src/application/routing/route-service";
import {
  edgeRepository,
  nodeRepository,
  productRepository,
  routeRepository,
} from "@/src/infrastructure/container";
import { shoppingListItemSchema } from "@/src/infrastructure/repositories/json/schemas";

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

  const [nodes, edges, products] = await Promise.all([
    nodeRepository.findByStore(storeId),
    edgeRepository.findByStore(storeId),
    productRepository.findAllActive(),
  ]);

  if (nodes.length === 0) {
    return NextResponse.json({ error: `Store not found: ${storeId}` }, { status: 404 });
  }

  const route = buildRoute({
    routeId: crypto.randomUUID(),
    storeId,
    shoppingListId,
    items,
    products,
    nodes,
    edges,
  });

  await routeRepository.create(route);

  return NextResponse.json(route, { status: 201 });
}
