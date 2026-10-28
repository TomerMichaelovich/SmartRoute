import { notFound } from "next/navigation";
import Link from "next/link";
import { hasSection } from "@smartroute/core/domain/entities/admin-user";
import type { MapNodeType } from "@smartroute/core/domain/entities/map-node";
import { findShelfGroup } from "@smartroute/core/domain/value-objects/shelf-group";
import {
  catalogAdminRepository,
  edgeRepository,
  nodeRepository,
  priceRepository,
  productListingRepository,
  storeRepository,
  walkableMapRepository,
} from "@/src/infrastructure/container";
import {
  addProductToNode,
  createEdge,
  createNode,
  deleteEdge,
  deleteNode,
  deleteStore,
  markProductsNotSold,
  moveProductsToNode,
  placeShelfGroupOnNode,
  removeProductFromNode,
  removeProductsFromNode,
  removeShelfGroupFromNode,
  saveWalkableMap,
  setStorePriceBranch,
  updateNodeLabel,
  updateNodePosition,
  updateStore,
  unmarkProductsNotSold,
  uploadStoreImage,
} from "@/src/presentation/actions/admin-store-actions";
import { setProductsShelfGroup } from "@/src/presentation/actions/admin-product-actions";
import { requireAdminPage } from "@/src/presentation/auth/admin";
import { DeleteStoreButton } from "@/src/presentation/components/admin/DeleteStoreButton";
import { StoreDetailsForm } from "@/src/presentation/components/admin/StoreDetailsForm";
import { StoreLayoutEditor } from "@/src/presentation/components/admin/StoreLayoutEditor";
import { StorePriceBranchForm } from "@/src/presentation/components/admin/StorePriceBranchForm";
import { cityCodeFromName, cityName } from "@/src/infrastructure/prices/settlements";
import { NODE_TYPE_LABELS } from "@/src/presentation/node-type-labels";

const NODE_TYPES: MapNodeType[] = ["entrance", "checkout", "waypoint", "department"];

export default async function AdminStoreDetailPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const principal = await requireAdminPage({ mapStore: storeId });
  // Mapping-only access gets the map and its products, not the store's details or deletion.
  const manages = hasSection(principal, "stores");
  const store = await storeRepository.findById(storeId);
  if (!store) notFound();

  // Imported products (whole price files) are too many to send with the page: the editor
  // gets the hand-made ones, a per-shelf-group summary, and searches on demand.
  const [nodes, edges, products, allListings, storeGroups, hasPriceBranch, excludedProducts, walkableMask, priceBranches, allStores] = await Promise.all([
    nodeRepository.findByStore(storeId),
    edgeRepository.findByStore(storeId),
    catalogAdminRepository.listedHandMadeProducts(storeId),
    productListingRepository.findByStore(storeId),
    catalogAdminRepository.shelfGroupsForStore(storeId),
    catalogAdminRepository.hasPriceBranch(storeId),
    catalogAdminRepository.excludedProducts(storeId),
    walkableMapRepository.findMask(storeId),
    manages ? priceRepository.findLinkableBranches() : [],
    manages ? storeRepository.findAll() : [],
  ]);
  const priceCityNames = new Map<number, string>();
  for (const b of priceBranches) {
    const name = b.cityCode !== null ? cityName(b.cityCode) : null;
    if (name) priceCityNames.set(b.cityCode!, name);
  }
  const nodeLabelById = new Map(nodes.map((n) => [n.id, n.label]));
  // Waypoints are just path geometry - the table only lists the store's departments.
  const departments = nodes
    .filter((n) => n.type === "department")
    .sort((a, b) => a.label.localeCompare(b.label, "he"));
  const productById = new Map(products.map((p) => [p.id, p]));
  const listings = allListings.filter((l) => productById.has(l.productId));
  const shelfGroups = storeGroups
    .flatMap((g) => {
      const group = findShelfGroup(g.groupId);
      return group ? [{ ...g, name: group.name, department: group.department }] : [];
    })
    .sort((a, b) => a.department.localeCompare(b.department, "he") || a.name.localeCompare(b.name, "he"));
  const unplacedGroups = shelfGroups.filter((g) => g.unplaced > 0);
  const placedGroupRows = shelfGroups.flatMap((g) => g.nodes.map((n) => ({ group: g, ...n })));
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
  const boundUploadStoreImage = uploadStoreImage.bind(null, storeId);
  const mapImageUrl = store.mapImageUrl ? `${store.mapImageUrl}?v=${encodeURIComponent(store.updatedAt)}` : "";
  // Blob-hosted images are proxied through our origin so the walkable-area editor can read pixels.
  const mapPixelSourceUrl = store.mapImageUrl.startsWith("https://")
    ? `/admin/stores/${storeId}/map-image?v=${encodeURIComponent(store.updatedAt)}`
    : mapImageUrl;

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
          {manages && <DeleteStoreButton storeName={store.name} deleteStore={deleteStore.bind(null, storeId)} />}
        </div>
      </div>

      {manages && (
        <>
          <StoreDetailsForm store={store} updateStore={boundUpdateStore} />

          <StorePriceBranchForm
            storeId={storeId}
            storeCityCode={cityCodeFromName(store.city)}
            branches={priceBranches}
            storeNameById={new Map(allStores.map((s) => [s.id, s.name]))}
            cityNameByCode={priceCityNames}
            setStorePriceBranch={setStorePriceBranch.bind(null, storeId)}
          />
        </>
      )}

      <StoreLayoutEditor
        storeId={storeId}
        mapWidth={store.mapWidth}
        mapHeight={store.mapHeight}
        mapImageUrl={mapImageUrl}
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        products={products}
        listings={listings}
        shelfGroups={shelfGroups}
        hasPriceBranch={hasPriceBranch}
        canEditProducts={hasSection(principal, "products")}
        createNode={boundCreateNode}
        createEdge={boundCreateEdge}
        deleteNode={deleteNode}
        deleteEdge={deleteEdge}
        updateNodePosition={boundUpdateNodePosition}
        updateNodeLabel={updateNodeLabel}
        addProductToNode={addProductToNode}
        removeProductFromNode={removeProductFromNode}
        placeShelfGroupOnNode={placeShelfGroupOnNode}
        removeShelfGroupFromNode={removeShelfGroupFromNode}
        moveProductsToNode={moveProductsToNode}
        removeProductsFromNode={removeProductsFromNode}
        markProductsNotSold={markProductsNotSold}
        setProductsShelfGroup={setProductsShelfGroup}
        uploadStoreImage={boundUploadStoreImage}
        mapPixelSourceUrl={mapPixelSourceUrl}
        walkableMask={walkableMask}
        saveWalkableMap={saveWalkableMap.bind(null, storeId)}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-neutral-900">
          מלאי הסניף ({storeInventory.length + placedGroupRows.reduce((sum, r) => sum + r.count, 0)})
        </h2>
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
                    {nodeLabelById.get(listing.nodeId) ?? (
                      <span className="font-semibold text-red-600">מחלקה שנמחקה - הסירו ושייכו מחדש</span>
                    )}
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
              {placedGroupRows.map(({ group, nodeId, count }) => (
                <tr key={`${group.groupId}-${nodeId}`} className="border-t border-neutral-100 bg-cyan-50/40">
                  <td className="p-2">
                    קבוצת מדף: <strong>{group.name}</strong> <span className="text-neutral-400">({count} פריטים)</span>
                  </td>
                  <td className="p-2">{group.department}</td>
                  <td className="whitespace-pre-line p-2">
                    {nodeLabelById.get(nodeId) ?? (
                      <span className="font-semibold text-red-600">מחלקה שנמחקה - הסירו ושייכו מחדש</span>
                    )}
                  </td>
                  <td className="p-2">
                    <form action={removeShelfGroupFromNode.bind(null, storeId, nodeId, group.groupId)}>
                      <button type="submit" className="text-red-600 hover:underline">
                        הסר
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {storeInventory.length === 0 && placedGroupRows.length === 0 && (
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

      {hasPriceBranch && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-neutral-900">
            קבוצות מדף שלא שויכו ({unplacedGroups.length} מתוך {shelfGroups.filter((g) => g.carried > 0).length})
          </h2>
          {unplacedGroups.length === 0 ? (
            <p className="text-sm text-neutral-500">כל הפריטים מקובץ המחירים של הסניף שויכו לנקודות.</p>
          ) : (
            <>
              <p className="text-xs text-neutral-500">
                פריטים מקובץ המחירים של הסניף שעוד לא נמצאים באף נקודה. בחרו נקודת מחלקה במפה ושייכו אליה קבוצה.
              </p>
              <div className="flex flex-wrap gap-2">
                {unplacedGroups.map((g) => (
                  <span
                    key={g.groupId}
                    className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700"
                  >
                    {g.name} <span className="text-neutral-400">{g.unplaced}/{g.carried}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {excludedProducts.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-neutral-900">לא נמכרים בסניף ({excludedProducts.length})</h2>
          <p className="text-xs text-neutral-500">
            פריטים מקובץ המחירים שסומנו כלא נמצאים על המדף. הם לא נספרים כממתינים לשיוך ולא נכנסים בשיוך קבוצה.
            ביטול הסימון מחזיר אותם לממתינים; שיוך ידני לנקודה מבטל אותו לבד.
          </p>
          <ul className="flex flex-col divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
            {excludedProducts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                <span>
                  {p.canonicalName}
                  {p.shelfGroup && (
                    <span className="ms-2 text-xs text-neutral-400">{findShelfGroup(p.shelfGroup)?.name}</span>
                  )}
                </span>
                <form action={unmarkProductsNotSold.bind(null, storeId, [p.id])}>
                  <button type="submit" className="text-xs text-cyan-700 hover:underline">
                    בטל סימון
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-neutral-900">מחלקות ({departments.length})</h2>
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="p-2 text-start">מחלקה</th>
                <th className="p-2 text-start">אזור</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {departments.map((node) => (
                <tr key={node.id} className="border-t border-neutral-100">
                  <td className="whitespace-pre-line p-2">{node.label}</td>
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
    </div>
  );
}
