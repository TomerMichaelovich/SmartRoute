import { NextResponse } from "next/server";
import { z } from "zod";
import {
  analyticsRepository,
  storeRepository,
} from "@/src/infrastructure/container";
import { createShoppingList } from "@/src/presentation/lib/create-list";
import { getCurrentUser } from "@/src/presentation/auth/dal";

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

  // A list created while logged in belongs to that user immediately and
  // becomes their active list; guest lists stay ownerless until claimed.
  const user = await getCurrentUser();

  const shoppingList = await createShoppingList({
    storeId,
    rawItems,
    ownerUserId: user?.id ?? null,
  });

  if (sessionId) {
    await Promise.all(
      shoppingList.items.map((item) =>
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
