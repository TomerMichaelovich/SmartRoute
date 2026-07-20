import { notFound } from "next/navigation";
import { edgeRepository, nodeRepository, storeRepository } from "@/src/infrastructure/container";
import { AdminRoutePreview } from "@/src/presentation/components/admin/AdminRoutePreview";

export default async function AdminStorePreviewPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const store = await storeRepository.findById(storeId);
  if (!store) notFound();

  const [nodes, edges] = await Promise.all([
    nodeRepository.findByStore(storeId),
    edgeRepository.findByStore(storeId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-neutral-900">תצוגה מקדימה — {store.name}</h1>
      <AdminRoutePreview
        storeId={storeId}
        mapWidth={store.mapWidth}
        mapHeight={store.mapHeight}
        nodes={nodes}
        edges={edges}
      />
    </div>
  );
}
