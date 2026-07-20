import { notFound } from "next/navigation";
import { selectRoutePromotions } from "@/src/application/promotions/promotion-service";
import {
  edgeRepository,
  nodeRepository,
  productRepository,
  promotionRepository,
  routeRepository,
  shoppingListRepository,
  storeRepository,
} from "@/src/infrastructure/container";
import type { ChecklistStopView } from "@/src/presentation/components/checklist/Checklist";
import { RouteView } from "@/src/presentation/components/route/RouteView";

export default async function RoutePage({
  params,
}: {
  params: Promise<{ routeId: string }>;
}) {
  const { routeId } = await params;
  const route = await routeRepository.findById(routeId);
  if (!route) notFound();

  const [store, nodes, edges, shoppingList, products, promotions] = await Promise.all([
    storeRepository.findById(route.storeId),
    nodeRepository.findByStore(route.storeId),
    edgeRepository.findByStore(route.storeId),
    shoppingListRepository.findById(route.shoppingListId),
    productRepository.findAllActive(),
    promotionRepository.findAll(),
  ]);

  if (!store || !shoppingList) notFound();

  const productById = new Map(products.map((p) => [p.id, p]));
  const itemById = new Map(shoppingList.items.map((i) => [i.id, i]));
  const promotionByNodeId = new Map(
    selectRoutePromotions(route, promotions, store.promotionsEnabled).map((p) => [
      p.attachedNodeId,
      p,
    ]),
  );

  const stopViews: ChecklistStopView[] = route.stops.map((stop) => ({
    stop,
    items: stop.itemIds.map((itemId) => {
      const item = itemById.get(itemId);
      const product = item?.classification?.matchedProductId
        ? productById.get(item.classification.matchedProductId)
        : undefined;
      return {
        id: itemId,
        displayName: product?.canonicalName ?? item?.rawText ?? itemId,
      };
    }),
    promotion: promotionByNodeId.get(stop.nodeId),
  }));

  return <RouteView route={route} store={store} nodes={nodes} edges={edges} stopViews={stopViews} />;
}
