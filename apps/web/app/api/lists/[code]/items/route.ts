import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeHebrewText } from "@smartroute/core/application/classification/normalize-hebrew-text";
import { normalizeShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import { findShelfGroup } from "@smartroute/core/domain/value-objects/shelf-group";
import { shoppingListRepository } from "@/src/infrastructure/container";
import { shoppingListItemKindChoiceSchema } from "@/src/infrastructure/repositories/schemas";
import { classifyLines } from "@/src/presentation/lib/create-list";
import { resolveListAccess } from "@/src/presentation/auth/list-access";
import { notifyListChanged } from "@/src/presentation/lib/list-push";

// The button tapped while typing the line (from /api/classify/kinds).
const kindSchema = shoppingListItemKindChoiceSchema
  .pick({ groups: true, form: true, label: true })
  .refine((kind) => kind.groups.every((group) => findShelfGroup(group)));

const bodySchema = z.object({
  lines: z
    .array(z.object({ rawText: z.string().min(1), quantity: z.number().positive().optional(), kind: kindSchema.optional() }))
    .min(1),
});

/** Append one or more classified items to a list (row-level, merge-safe). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const list = await shoppingListRepository.findByShareCode(normalizeShareCode(code));
  if (!list) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const access = await resolveListAccess(list);
  if (!access) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const classified = await classifyLines(
    list.storeId,
    parsed.data.lines.map((l) => l.rawText),
    access.user?.id,
  );
  const chosenAt = new Date().toISOString();
  const items = classified.map((item, i) => {
    const kind = parsed.data.lines[i].kind;
    return {
      ...item,
      quantity: parsed.data.lines[i].quantity ?? item.quantity,
      ...(kind ? { kindChoice: { ...kind, text: normalizeHebrewText(item.rawText), chosenAt } } : {}),
    };
  });

  await shoppingListRepository.appendItems(list.id, items);
  notifyListChanged(list, access.user?.id);
  const updated = await shoppingListRepository.findById(list.id);
  return NextResponse.json({ list: updated }, { status: 201 });
}
