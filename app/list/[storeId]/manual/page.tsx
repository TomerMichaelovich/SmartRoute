import { notFound } from "next/navigation";
import { storeRepository } from "@/src/infrastructure/container";
import { ShoppingListInput } from "@/src/presentation/components/shopping-list/ShoppingListInput";
import { he } from "@/src/presentation/i18n/he";

export default async function ManualShoppingListPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const store = await storeRepository.findById(storeId);
  if (!store) notFound();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-neutral-900">{he.list.title}</h1>
        <p className="text-neutral-600">{he.list.subtitle}</p>
        <p className="text-sm font-medium text-cyan-700">{store.name}</p>
      </header>
      <ShoppingListInput storeId={store.id} />
    </main>
  );
}
