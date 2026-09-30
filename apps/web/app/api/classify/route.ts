import { NextResponse } from "next/server";
import { z } from "zod";
import {
  analyticsRepository,
  storeRepository,
} from "@/src/infrastructure/container";
import { createShoppingList } from "@/src/presentation/lib/create-list";
import { getCurrentUser } from "@/src/presentation/auth/dal";

const requestSchema = z.object({
  // Optional: the mobile home screen's "create list" plans a list before any
  // branch is chosen (the branch is picked when continuing to a route). Such
  // lists are filed under the first active store, since a list needs one to
  // classify against - routing itself uses whichever branch is picked later.
  storeId: z.string().min(1).optional(),
  rawItems: z.array(z.string().min(1)).min(1),
  // Optional user-facing name ("weekly shop", "dinner with friends"), for
  // account holders juggling several lists. Blank => the UI's default name.
  name: z.string().trim().max(60).optional(),
  // Optional: lets us attribute item_classified events to the shopper's session.
  sessionId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { rawItems, sessionId } = parsed.data;
  const name = parsed.data.name || null;

  const store = parsed.data.storeId
    ? await storeRepository.findById(parsed.data.storeId)
    : ((await storeRepository.findActive())[0] ?? null);
  if (!store) {
    return NextResponse.json({ error: `Store not found: ${parsed.data.storeId ?? "(no active store)"}` }, { status: 404 });
  }
  const storeId = store.id;

  // A list created while logged in belongs to that user immediately and
  // joins their active lists; guest lists stay ownerless until claimed.
  const user = await getCurrentUser();

  const shoppingList = await createShoppingList({
    storeId,
    rawItems,
    ownerUserId: user?.id ?? null,
    name,
  });

  if (sessionId) {
    await Promise.all(
      shoppingList.items.map((item) =>
        analyticsRepository.append({
          id: crypto.randomUUID(),
          type: "item_classified",
          sessionId,
          userId: user?.id,
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
