import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import { shoppingListRepository } from "@/src/infrastructure/container";
import { resolveListAccess } from "@/src/presentation/auth/list-access";

const requestSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

/** Renames one of the caller's own lists. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const list = await shoppingListRepository.findByShareCode(normalizeShareCode(code));
  if (!list) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if ((await resolveListAccess(list))?.kind !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await shoppingListRepository.rename(list.id, parsed.data.name);
  return NextResponse.json({ ...list, name: parsed.data.name });
}
