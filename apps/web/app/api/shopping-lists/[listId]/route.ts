import { NextResponse } from "next/server";
import { productListingRepository, productRepository, shoppingListRepository } from "@/src/infrastructure/container";

// Backs the mobile app's Classification Review screen the same data the web app's
// /review/[listId] page (a Server Component) fetches directly via repositories: the
// shopping list plus only the products this store actually carries (matches what
// classify()/buildRoute() can route to - offering the rest in the manual-pick list
// would let a shopper "fix" an item to something the store doesn't even stock).
export async function GET(_request: Request, { params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const shoppingList = await shoppingListRepository.findById(listId);
  if (!shoppingList) {
    return NextResponse.json({ error: `Shopping list not found: ${listId}` }, { status: 404 });
  }

  const [allProducts, listings] = await Promise.all([
    productRepository.findAllActive(),
    productListingRepository.findByStore(shoppingList.storeId),
  ]);
  const carriedProductIds = new Set(listings.map((l) => l.productId));
  const products = allProducts.filter((p) => carriedProductIds.has(p.id));

  return NextResponse.json({ shoppingList, products });
}
