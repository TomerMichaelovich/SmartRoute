import { notFound, redirect } from "next/navigation";
import { normalizeShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import {
  productListingRepository,
  productRepository,
  shoppingListRepository,
} from "@/src/infrastructure/container";
import { MyListEditor } from "@/src/presentation/components/my-list/MyListEditor";
import { resolveListAccess } from "@/src/presentation/auth/list-access";
import { he } from "@smartroute/core/i18n/he";

export default async function MyListPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const shoppingList = await shoppingListRepository.findByShareCode(normalizeShareCode(code));
  if (!shoppingList) notFound();

  // Household lists have their own collaborative editor.
  if (shoppingList.householdId) redirect("/household/list");

  // A personal list is private to its owner; guest lists stay open by code.
  if (!(await resolveListAccess(shoppingList))) notFound();

  const [allProducts, listings] = await Promise.all([
    productRepository.findAllActive(),
    productListingRepository.findByStore(shoppingList.storeId),
  ]);
  // Only offer products this store actually carries - matches what classify()/buildRoute()
  // would actually be able to route to (same filtering as the /review page).
  const carriedProductIds = new Set(listings.map((l) => l.productId));
  const products = allProducts.filter((p) => carriedProductIds.has(p.id));

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-neutral-900">{he.myList.editor.title}</h1>
        <p className="text-neutral-600">{he.myList.editor.subtitle}</p>
      </header>
      <MyListEditor initialList={shoppingList} products={products} />
    </main>
  );
}
