import { NextResponse } from "next/server";
import { shoppingListRepository, storeRepository } from "@/src/infrastructure/container";
import { getCurrentUser } from "@/src/presentation/auth/dal";

/**
 * REST counterpart of the home page's inline `findActiveByOwner` lookup
 * (app/page.tsx) - a Server Component can call the repository directly, but
 * the mobile app's HomeListWidget can only reach it over HTTP.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const list = await shoppingListRepository.findActiveByOwner(user.id);
  if (!list) {
    return NextResponse.json({ list: null, store: null });
  }
  const store = await storeRepository.findById(list.storeId);
  return NextResponse.json({ list, store });
}
