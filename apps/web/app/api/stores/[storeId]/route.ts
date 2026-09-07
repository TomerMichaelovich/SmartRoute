import { NextResponse } from "next/server";
import { storeRepository } from "@/src/infrastructure/container";

// GET-by-id counterpart to GET /api/stores (route.ts, one level up), which lists active
// stores. Needed so the mobile app's list/[storeId] screens (no Server Components) can
// show the store's name the same way the web pages do via a direct repository call.
export async function GET(_request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const store = await storeRepository.findById(storeId);
  if (!store) {
    return NextResponse.json({ error: `Store not found: ${storeId}` }, { status: 404 });
  }
  return NextResponse.json(store);
}
