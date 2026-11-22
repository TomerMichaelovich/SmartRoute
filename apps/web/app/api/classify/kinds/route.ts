import { NextResponse } from "next/server";
import { exactAliasMatch } from "@smartroute/core/application/classification/imported-aliases";
import { normalizeHebrewText } from "@smartroute/core/application/classification/normalize-hebrew-text";
import { lineKinds, lineNamesPack } from "@smartroute/core/application/routing/product-kind";
import { importedCatalogRepository } from "@/src/infrastructure/container";

/**
 * GET ?text=<line>: the kinds of product the line could mean, as buttons offered while it's
 * being typed ("קולה" -> בקבוק, פחית, שישייה; "חומוס" -> ממרח, שימורים, יבש, קפוא). None
 * when there's nothing to tell apart, or the line already says. The same for every shopper.
 */
export async function GET(request: Request) {
  const text = normalizeHebrewText(new URL(request.url).searchParams.get("text") ?? "").slice(0, 200);
  if (!text || lineNamesPack(text)) return NextResponse.json({ kinds: [] });
  const hit = exactAliasMatch(text, await importedCatalogRepository.aliasIndex());
  if (!hit) return NextResponse.json({ kinds: [] });
  const products = await importedCatalogRepository.productsByAlias(normalizeHebrewText(hit.text));
  return NextResponse.json(
    { kinds: lineKinds(products) },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
  );
}
