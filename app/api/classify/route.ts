import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveAvailability } from "@/src/application/classification/resolve-availability";
import type { ShoppingList, ShoppingListItem } from "@/src/domain/entities/shopping-list";
import {
  analyticsRepository,
  classificationService,
  productListingRepository,
  shoppingListRepository,
  storeRepository,
} from "@/src/infrastructure/container";

const requestSchema = z.object({
  storeId: z.string().min(1),
  rawItems: z.array(z.string().min(1)).min(1),
  // Optional: lets us attribute item_classified events to the shopper's session.
  sessionId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { storeId, rawItems, sessionId } = parsed.data;

  const store = await storeRepository.findById(storeId);
  if (!store) {
    return NextResponse.json({ error: `Store not found: ${storeId}` }, { status: 404 });
  }

  const [rawClassifications, listings] = await Promise.all([
    classificationService.classifyBatch(rawItems),
    productListingRepository.findByStore(storeId),
  ]);
  const classifications = rawClassifications.map((c) => resolveAvailability(c, storeId, listings));

  const items: ShoppingListItem[] = rawItems.map((rawText, i) => ({
    id: crypto.randomUUID(),
    rawText,
    classification: classifications[i],
  }));

  const shoppingList: ShoppingList = {
    id: crypto.randomUUID(),
    storeId,
    items,
    createdAt: new Date().toISOString(),
  };

  await shoppingListRepository.create(shoppingList);

  if (sessionId) {
    await Promise.all(
      items.map((item) =>
        analyticsRepository.append({
          id: crypto.randomUUID(),
          type: "item_classified",
          sessionId,
          storeId,
          payload: {
            source: item.classification?.source,
            confidence: item.classification?.confidence,
          },
          timestamp: new Date().toISOString(),
        }),
      ),
    );
  }

  return NextResponse.json(shoppingList, { status: 201 });
}
