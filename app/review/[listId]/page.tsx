import { notFound } from "next/navigation";
import { productRepository, shoppingListRepository } from "@/src/infrastructure/container";
import { ReviewForm } from "@/src/presentation/components/classification/ReviewForm";
import { he } from "@/src/presentation/i18n/he";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const { listId } = await params;
  const shoppingList = await shoppingListRepository.findById(listId);
  if (!shoppingList) notFound();

  const products = await productRepository.findAllActive();

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-neutral-900">{he.review.title}</h1>
        <p className="text-neutral-600">{he.review.subtitle}</p>
      </header>
      <ReviewForm
        storeId={shoppingList.storeId}
        shoppingListId={shoppingList.id}
        initialItems={shoppingList.items}
        products={products}
      />
    </main>
  );
}
