import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import { shoppingListRepository } from "@/src/infrastructure/container";
import { shoppingListItemVariantSchema } from "@/src/infrastructure/repositories/schemas";
import { resolveListAccess } from "@/src/presentation/auth/list-access";
import { notifyListChanged } from "@/src/presentation/lib/list-push";

const patchSchema = z.object({
  quantity: z.number().positive().nullable().optional(),
  checked: z.boolean().optional(),
  notFound: z.boolean().optional(),
  // The cheapest-basket refinement choice; null clears it.
  variant: shoppingListItemVariantSchema.nullable().optional(),
});

async function loadAndAuthorize(code: string) {
  const list = await shoppingListRepository.findByShareCode(normalizeShareCode(code));
  if (!list) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const access = await resolveListAccess(list);
  if (!access) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return { list, access };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string; itemId: string }> },
) {
  const { code, itemId } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const auth = await loadAndAuthorize(code);
  if (auth instanceof NextResponse) return auth;
  const { list, access } = auth;

  if (parsed.data.quantity !== undefined) {
    await shoppingListRepository.setItemQuantity(list.id, itemId, parsed.data.quantity);
  }
  if (parsed.data.checked !== undefined) {
    await shoppingListRepository.setItemChecked(
      list.id,
      itemId,
      parsed.data.checked,
      access.user ? { userId: access.user.id, name: access.user.displayName } : null,
    );
  }
  if (parsed.data.notFound !== undefined) {
    await shoppingListRepository.setItemNotFound(list.id, itemId, parsed.data.notFound);
  }
  if (parsed.data.variant !== undefined) {
    await shoppingListRepository.setItemVariant(list.id, itemId, parsed.data.variant);
  }

  notifyListChanged(list, access.user?.id);
  const updated = await shoppingListRepository.findById(list.id);
  return NextResponse.json({ list: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ code: string; itemId: string }> },
) {
  const { code, itemId } = await params;
  const auth = await loadAndAuthorize(code);
  if (auth instanceof NextResponse) return auth;

  await shoppingListRepository.removeItem(auth.list.id, itemId);
  notifyListChanged(auth.list, auth.access.user?.id);
  const updated = await shoppingListRepository.findById(auth.list.id);
  return NextResponse.json({ list: updated });
}
