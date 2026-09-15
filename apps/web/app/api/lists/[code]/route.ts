import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import type { ShoppingListItem } from "@smartroute/core/domain/entities/shopping-list";
import { shoppingListRepository, storeRepository } from "@/src/infrastructure/container";
import { classifyLines } from "@/src/presentation/lib/create-list";
import { resolveListAccess } from "@/src/presentation/auth/list-access";
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
  if (!(await resolveListAccess(list))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (expectedUpdatedAt && !force && expectedUpdatedAt !== list.updatedAt) {
    return NextResponse.json({ error: "stale", current: list }, { status: 409 });
  }

  const existingItems = incoming.filter((item): item is ShoppingListItem => "id" in item);
  const newLines = incoming.filter(
    (item): item is z.infer<typeof newLineSchema> => !("id" in item),
  );

  let newItems: ShoppingListItem[] = [];
  if (newLines.length > 0) {
    const classified = await classifyLines(
      list.storeId,
      newLines.map((line) => line.rawText),
    );
    newItems = classified.map((item, i) => ({ ...item, quantity: newLines[i].quantity }));
  }

  const items = [...existingItems, ...newItems];
  const updatedAt = new Date().toISOString();
  await shoppingListRepository.updateItems(list.id, items, updatedAt);

  return NextResponse.json({ ...list, items, updatedAt });
}
