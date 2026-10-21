import { NextResponse } from "next/server";
import { priceRepository } from "@/src/infrastructure/container";
import { cityName } from "@/src/infrastructure/prices/settlements";

/** Cities with price data — the app's city picker when location is unavailable. */
export async function GET() {
  const cities = (await priceRepository.findPriceCities()).map((c) => ({
    code: c.cityCode,
    name: cityName(c.cityCode),
    branchCount: c.branchCount,
  }));
  return NextResponse.json({ cities });
}
