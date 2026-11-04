import { NextResponse } from "next/server";
import { exactAliasMatch } from "@smartroute/core/application/classification/imported-aliases";
import { normalizeHebrewText } from "@smartroute/core/application/classification/normalize-hebrew-text";
import { importedCatalogRepository } from "@/src/infrastructure/container";

/**
 * GET ?text=<line>: whether the line is exactly an alias of products imported from
 * price files ("ג'ין"), as typed or without counts and brands. The app asks before
 * offering "did you mean...?" for a line its generic catalog doesn't know
 * (suggestBeforeAdding) - it isn't a typo if the stores carry it under that name.
 */
export async function GET(request: Request) {
  const text = normalizeHebrewText(new URL(request.url).searchParams.get("text") ?? "").slice(0, 200);
  if (!text) return NextResponse.json({ known: false });
  const index = await importedCatalogRepository.aliasIndex();
  return NextResponse.json({ known: exactAliasMatch(text, index) !== null });
}
