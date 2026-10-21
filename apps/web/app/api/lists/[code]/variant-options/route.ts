import { NextResponse } from "next/server";
import { normalizeShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import { shoppingListRepository } from "@/src/infrastructure/container";
import { resolveListAccess } from "@/src/presentation/auth/list-access";
import { variantOptionsFor } from "@/src/presentation/lib/basket";

/**
 * The refinement popup's questions: list items whose generic product maps to
 * several concrete products ("חלב" -> 3%/1%/brands/sizes) and that the shopper
 * hasn't chosen for yet, each with its options (most widely carried first).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const list = await shoppingListRepository.findByShareCode(normalizeShareCode(code));
  if (!list) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!(await resolveListAccess(list))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  return NextResponse.json({ items: await variantOptionsFor(list) });
}
