import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import { sameInstant } from "@smartroute/core/application/shopping-list/same-instant";
import type { ShoppingListItem } from "@smartroute/core/domain/entities/shopping-list";
import { shoppingListRepository, storeRepository } from "@/src/infrastructure/container";
import { classifyLines } from "@/src/presentation/lib/create-list";
import { resolveListAccess } from "@/src/presentation/auth/list-access";
import { notifyItemsAdded, notifyListChanged } from "@/src/presentation/lib/list-push";
import { shoppingListItemSchema } from "@/src/infrastructure/repositories/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const list = await shoppingListRepository.findByShareCode(normalizeShareCode(code));
  if (!list) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!(await resolveListAccess(list))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const store = await storeRepository.findById(list.storeId);
  return NextResponse.json({ list, store });
}

const newLineSchema = z.object({
  rawText: z.string().min(1),
  quantity: z.number().optional(),
});

const requestSchema = z.object({
  items: z.array(z.union([shoppingListItemSchema, newLineSchema])),
  expectedUpdatedAt: z.string().optional(),
  force: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const body: unknown = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { items: incoming, expectedUpdatedAt, force } = parsed.data;

  const list = await shoppingListRepository.findByShareCode(normalizeShareCode(code));
  if (!list) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const access = await resolveListAccess(list);
  if (!access) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Compared as instants: the client may hold the ISO spelling while the row reads back in
  // Postgres's, and a string mismatch flagged the user's own previous save as someone else's.
  if (expectedUpdatedAt && !force && !sameInstant(expectedUpdatedAt, list.updatedAt)) {
    return NextResponse.json({ error: "stale", current: list }, { status: 409 });
  }

  const existingItems = incoming.filter((item): item is ShoppingListItem => "id" in item);
  const newLines = incoming.filter(
    (item): item is z.infer<typeof newLineSchema> => !("id" in item),
  );

  let newItems: ShoppingListItem[] = [];
  if (newLines.length > 0) {
    // Attributed, so other participants can be told who added what (e.g. mid-shop).
    const classified = await classifyLines(
      list.storeId,
      newLines.map((line) => line.rawText),
      access.user?.id,
    );
    newItems = classified.map((item, i) => ({ ...item, quantity: newLines[i].quantity }));
  }

  const items = [...existingItems, ...newItems];
  const updatedAt = new Date().toISOString();
  await shoppingListRepository.updateItems(list.id, items, updatedAt);
  notifyListChanged(list, access.user?.id);
  notifyItemsAdded(list, access.user, newLines.map((line) => line.rawText));

  // Read back, so updatedAt is spelled exactly as every later read of the list will spell it.
  const saved = await shoppingListRepository.findById(list.id);
  return NextResponse.json(saved ?? { ...list, items, updatedAt });
}

/** Deletes (soft) one of the caller's own lists - it leaves their home screen for good. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const list = await shoppingListRepository.findByShareCode(normalizeShareCode(code));
  if (!list) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if ((await resolveListAccess(list))?.kind !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await shoppingListRepository.softDelete(list.id, new Date().toISOString());
  return new NextResponse(null, { status: 204 });
}
