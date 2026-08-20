import { notFound } from "next/navigation";
import Link from "next/link";
import type { MapNodeType } from "@/src/domain/entities/map-node";
import { distanceBetweenNodes } from "@/src/domain/value-objects/geo-point";
import {
  edgeRepository,
  nodeRepository,
  productListingRepository,
  productRepository,
  storeRepository,
} from "@/src/infrastructure/container";
import {
  addProductToNode,
  createEdge,
  createNode,
  deleteEdge,
  deleteNode,
  deleteStore,
  removeProductFromNode,
  updateNodeIcon,
  updateNodeLabel,
  updateNodePosition,
  updateStore,
  uploadStoreImage,
} from "@/src/presentation/actions/admin-store-actions";
import { DeleteStoreButton } from "@/src/presentation/components/admin/DeleteStoreButton";
import { StoreDetailsForm } from "@/src/presentation/components/admin/StoreDetailsForm";
import { StoreLayoutEditor } from "@/src/presentation/components/admin/StoreLayoutEditor";
import { NODE_TYPE_LABELS } from "@/src/presentation/node-type-labels";
import { PRODUCT_ICONS } from "@/src/presentation/product-icons";

const NODE_TYPES: MapNodeType[] = ["entrance", "checkout", "waypoint", "department"];

export default async function AdminStoreDetailPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const store = await storeRepository.findById(storeId);
  if (!store) notFound();

  const [nodes, edges, products, listings] = await Promise.all([
    nodeRepository.findByStore(storeId),
    edgeRepository.findByStore(storeId),
    productRepository.findAllActive(),
    productListingRepository.findByStore(storeId),
  ]);
  const nodeLabelById = new Map(nodes.map((n) => [n.id, n.label]));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const productById = new Map(products.map((p) => [p.id, p]));
  const storeInventory = listings
    .map((listing) => ({ listing, product: productById.get(listing.productId) }))
    .filter((item) => item.product !== undefined)
    .sort(
      (a, b) =>
        a.product!.department.localeCompare(b.product!.department, "he") ||
        a.product!.canonicalName.localeCompare(b.product!.canonicalName, "he"),
    );
  const boundUpdateStore = updateStore.bind(null, storeId);
  const boundCreateNode = createNode.bind(null, storeId);
  const boundCreateEdge = createEdge.bind(null, storeId);
  const boundUpdateNodePosition = updateNodePosition.bind(null, storeId);
  const boundUpdateNodeIcon = updateNodeIcon.bind(null, storeId);
  const boundUploadStoreImage = uploadStoreImage.bind(null, storeId);
  const mapImageUrl = store.mapImageUrl ? `${store.mapImageUrl}?v=${encodeURIComponent(store.updatedAt)}` : "";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">{store.name}</h1>
        <div className="flex items-center gap-4">
          <Link
            href={`/admin/stores/${storeId}/preview`}
            className="text-sm font-medium text-cyan-700 hover:underline"
          >
            תצוגה מקדימה של מסלול ←
          </Link>
          <DeleteStoreButton storeName={store.name} deleteStore={deleteStore.bind(null, storeId)} />
        </div>
      </div>

      <StoreDetailsForm store={store} updateStore={boundUpdateStore} />

      <StoreLayoutEditor
        storeId={storeId}
        mapWidth={store.mapWidth}
        mapHeight={store.mapHeight}
        mapImageUrl={mapImageUrl}
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        productIcons={PRODUCT_ICONS}
        products={products}
        listings={listings}
        createNode={boundCreateNode}
        createEdge={boundCreateEdge}
        deleteNode={deleteNode}
        deleteEdge={deleteEdge}
        updateNodePosition={boundUpdateNodePosition}
        updateNodeIcon={boundUpdateNodeIcon}
        updateNodeLabel={updateNodeLabel}
        addProductToNode={addProductToNode}
        removeProductFromNode={removeProductFromNode}
        uploadStoreImage={boundUploadStoreImage}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-neutral-900">מלאי הסניף ({storeInventory.length})</h2>
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="p-2 text-start">מוצר</th>
                <th className="p-2 text-start">מחלקה</th>
                <th className="p-2 text-start">צומת</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {storeInventory.map(({ listing, product }) => (
                <tr key={listing.id} className="border-t border-neutral-100">
                  <td className="p-2">{product!.canonicalName}</td>
                  <td className="p-2">{product!.department}</td>
                  <td className="whitespace-pre-line p-2">
                    {nodeLabelById.get(listing.nodeId) ?? listing.nodeId}
                  </td>
                  <td className="p-2">
                    <form
                      action={removeProductFromNode.bind(null, storeId, listing.nodeId, listing.productId)}
                    >
                      <button type="submit" className="text-red-600 hover:underline">
                        הסר
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {storeInventory.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-neutral-400">
                    אין עדיין מוצרים משויכים לסניף זה
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-neutral-900">צמתים ({nodes.length})</h2>
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="p-2 text-start">תווית</th>
                <th className="p-2 text-start">סוג</th>
                <th className="p-2 text-start">X</th>
                <th className="p-2 text-start">Y</th>
                <th className="p-2 text-start">אזור</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => (
                <tr key={node.id} className="border-t border-neutral-100">
                  <td className="whitespace-pre-line p-2">{node.label}</td>
                  <td className="p-2">{NODE_TYPE_LABELS[node.type]}</td>
                  <td className="p-2">{node.position.x}</td>
                  <td className="p-2">{node.position.y}</td>
                  <td className="p-2">{node.zone ?? "—"}</td>
                  <td className="p-2">
                    <form action={deleteNode.bind(null, storeId, node.id)}>
                      <button type="submit" className="text-red-600 hover:underline">
                        מחק
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form
          action={boundCreateNode}
          className="grid grid-cols-2 gap-2 rounded-xl border border-neutral-200 bg-white p-4 sm:grid-cols-6"
        >
          <input
            name="label"
            placeholder="תווית (חובה למחלקה בלבד)"
            className="rounded-lg border border-neutral-300 p-2"
          />
          <select name="type" className="rounded-lg border border-neutral-300 p-2">
            {NODE_TYPES.map((t) => (
              <option key={t} value={t}>
                {NODE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <input
            name="x"
            type="number"
            step="0.01"
            min="0"
            max="1"
            placeholder="X (0-1)"
            required
            className="rounded-lg border border-neutral-300 p-2"
          />
          <input
            name="y"
            type="number"
            step="0.01"
            min="0"
            max="1"
            placeholder="Y (0-1)"
            required
            className="rounded-lg border border-neutral-300 p-2"
          />
          <input
            name="zone"
            placeholder="אזור (אופציונלי)"
            className="rounded-lg border border-neutral-300 p-2"
          />
          <button
            type="submit"
            className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white"
          >
            הוסף צומת
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-neutral-900">קשתות ({edges.length})</h2>
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="p-2 text-start">מ-</th>
                <th className="p-2 text-start">אל</th>
                <th className="p-2 text-start">מרחק</th>
                <th className="p-2 text-start">דו-כיווני</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {edges.map((edge) => {
                const fromNode = nodeById.get(edge.fromNodeId);
                const toNode = nodeById.get(edge.toNodeId);
                const distance =
                  fromNode && toNode
                    ? Math.round(
                        distanceBetweenNodes(fromNode.position, toNode.position, store.mapWidth, store.mapHeight),
                      )
                    : "—";
                return (
                <tr key={edge.id} className="border-t border-neutral-100">
                  <td className="p-2">{nodeLabelById.get(edge.fromNodeId) ?? edge.fromNodeId}</td>
                  <td className="p-2">{nodeLabelById.get(edge.toNodeId) ?? edge.toNodeId}</td>
                  <td className="p-2">{distance}</td>
                  <td className="p-2">{edge.bidirectional ? "כן" : "לא"}</td>
                  <td className="p-2">
                    <form action={deleteEdge.bind(null, storeId, edge.id)}>
                      <button type="submit" className="text-red-600 hover:underline">
                        מחק
                      </button>
                    </form>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <form
          action={boundCreateEdge}
          className="grid grid-cols-2 gap-2 rounded-xl border border-neutral-200 bg-white p-4 sm:grid-cols-4"
        >
          <select name="fromNodeId" required className="rounded-lg border border-neutral-300 p-2">
            <option value="">מ-...</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
          <select name="toNodeId" required className="rounded-lg border border-neutral-300 p-2">
            <option value="">אל...</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" name="bidirectional" defaultChecked /> דו-כיווני
          </label>
          <button
            type="submit"
            className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white"
          >
            הוסף קשת
          </button>
        </form>
      </section>
    </div>
  );
}
