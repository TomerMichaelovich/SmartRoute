import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import type { ShoppingListItemVariant } from "@smartroute/core/domain/entities/shopping-list";
import { priceRepository, shoppingListRepository } from "@/src/infrastructure/container";
import { cityCodeFromName, cityName } from "@/src/infrastructure/prices/settlements";
import { shoppingListItemVariantSchema } from "@/src/infrastructure/repositories/schemas";
import { resolveListAccess } from "@/src/presentation/auth/list-access";
import { quoteBasket } from "@/src/presentation/lib/basket";

const requestSchema = z
  .object({
    // The shopper's city: a CBS code (from a city picker) or a name (reverse-geocoded on the device).
    cityCode: z.number().int().positive().optional(),
    cityName: z.string().min(1).max(80).optional(),
    // Optional, only to show each branch's distance. Never stored or logged.
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    limit: z.number().int().min(1).max(5).default(3),
    // Choices made in the popup that may not have been saved yet (offline / failed PATCH).
    variants: z.record(z.string(), shoppingListItemVariantSchema).optional(),
  })
  .refine((b) => b.cityCode !== undefined || b.cityName !== undefined, { message: "cityCode or cityName is required" });

/**
 * The cheapest branches for the list, compared only within the shopper's city.
 * Responds 200 with status "city_unknown" / "city_not_covered" (plus the cities
 * that do have prices) when there's nothing to compare, so the app can show why.
 */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const list = await shoppingListRepository.findByShareCode(normalizeShareCode(code));
  if (!list) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!(await resolveListAccess(list))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { cityCode: requestedCode, cityName: requestedName, lat, lng, limit, variants } = parsed.data;
  const cityCode = requestedCode ?? cityCodeFromName(requestedName);
  const coveredCities = (await priceRepository.findPriceCities()).map((c) => ({
    code: c.cityCode,
    name: cityName(c.cityCode),
    branchCount: c.branchCount,
  }));
  if (cityCode === null || cityCode === undefined) {
    return NextResponse.json({ status: "city_unknown", cityName: requestedName ?? null, coveredCities });
  }
  if (!coveredCities.some((c) => c.code === cityCode)) {
    return NextResponse.json({ status: "city_not_covered", city: { code: cityCode, name: cityName(cityCode) }, coveredCities });
  }

  // Rounded to ~100m: enough for a distance, no more precise than needed.
  const location =
    lat !== undefined && lng !== undefined ? { lat: Math.round(lat * 1000) / 1000, lng: Math.round(lng * 1000) / 1000 } : null;
  const overrides = new Map<string, ShoppingListItemVariant>(Object.entries(variants ?? {}));
  const result = await quoteBasket(list, { cityCode, location, limit, overrides });
  return NextResponse.json({ status: "ok", ...result });
}
