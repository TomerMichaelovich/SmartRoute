import { notFound } from "next/navigation";
import {
  productListingRepository,
  productRepository,
  shoppingListRepository,
} from "@/src/infrastructure/container";
import { ReviewForm } from "@/src/presentation/components/classification/ReviewForm";
import { ShareListButton } from "@/src/presentation/components/my-list/ShareListButton";
import { he } from "@/src/presentation/i18n/he";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const { listId } = await params;
  const shoppingList = await shoppingListRepository.findById(listId);
  if (!shoppingList) notFound();

  const [allProducts, listings] = await Promise.all([
    productRepository.findAllActive(),
    productListingRepository.findByStore(shoppingList.storeId),
  ]);
  // Only offer products this store actually carries in the manual-pick dropdown -
  // matches what classify()/buildRoute() would actually be able to route to.
  const carriedProductIds = new Set(listings.map((l) => l.productId));
  const products = allProducts.filter((p) => carriedProductIds.has(p.id));

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-neutral-900">{he.review.title}</h1>
        <p className="text-neutral-600">{he.review.subtitle}</p>
      </header>
      {shoppingList.shareCode && <ShareListButton shareCode={shoppingList.shareCode} />}
      <ReviewForm
        storeId={shoppingList.storeId}
        shoppingListId={shoppingList.id}
        initialItems={shoppingList.items}
        products={products}
      />
    </main>
  );
}
