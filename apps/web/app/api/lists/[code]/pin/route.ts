import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import { shoppingListRepository } from "@/src/infrastructure/container";
import { resolveListAccess } from "@/src/presentation/auth/list-access";
import { notifyListChanged } from "@/src/presentation/lib/list-push";

const requestSchema = z.object({ pinned: z.boolean() });

/**
 * Pins or unpins one of the caller's own lists. A pinned list stays on the home screen -
 * and shared with its participants - after shopping (see POST /api/trips).
 */
export async function PUT(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const list = await shoppingListRepository.findByShareCode(normalizeShareCode(code));
  if (!list) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const access = await resolveListAccess(list);
  if (access?.kind !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await shoppingListRepository.setPinned(list.id, parsed.data.pinned);
  notifyListChanged(list, access.user?.id);
  return NextResponse.json({ ...list, isPinned: parsed.data.pinned, isActive: parsed.data.pinned || list.isActive });
}
