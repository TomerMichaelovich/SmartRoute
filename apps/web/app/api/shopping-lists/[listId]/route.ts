import { NextResponse } from "next/server";
import { productListingRepository, productRepository, shoppingListRepository } from "@/src/infrastructure/container";
import { resolveListAccess } from "@/src/presentation/auth/list-access";

// Backs the mobile app's Classification Review screen the same data the web app's
// /review/[listId] page (a Server Component) fetches directly via repositories: the
// shopping list plus only the products this store actually carries (matches what
// classify()/buildRoute() can route to - offering the rest in the manual-pick list
// would let a shopper "fix" an item to something the store doesn't even stock).
//
// ?scope=catalog returns the whole active catalog instead: the app's list screen
// edits a list before any branch is picked, while the list is only filed under a
// placeholder store - limiting it to that store would hide products that other
// branches carry (and that classification already matched against). The app
// itself keeps chain-exclusive products (chainId) out of picks and suggestions
// until a branch is chosen - see resolveBeforeBranch.
//
// ?storeId=X returns what branch X carries instead of the list's own store - the route
// screen, which is shopping at a branch the list isn't filed under.
export async function GET(request: Request, { params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const searchParams = new URL(request.url).searchParams;
  const wholeCatalog = searchParams.get("scope") === "catalog";
  const shoppingList = await shoppingListRepository.findById(listId);
  if (!shoppingList) {
    return NextResponse.json({ error: `Shopping list not found: ${listId}` }, { status: 404 });
  }
  if (!(await resolveListAccess(shoppingList))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (wholeCatalog) {
    return NextResponse.json({ shoppingList, products: await productRepository.findAllActive() });
  }

  const [allProducts, listings] = await Promise.all([
    productRepository.findAllActive(),
    productListingRepository.findByStore(searchParams.get("storeId") || shoppingList.storeId),
  ]);
  const carriedProductIds = new Set(listings.map((l) => l.productId));
  const products = allProducts.filter((p) => carriedProductIds.has(p.id));

  return NextResponse.json({ shoppingList, products });
}
