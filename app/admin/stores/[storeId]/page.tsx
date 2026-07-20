import { notFound } from "next/navigation";
import Link from "next/link";
import type { MapNodeType } from "@/src/domain/entities/map-node";
import { edgeRepository, nodeRepository, storeRepository } from "@/src/infrastructure/container";
import {
  createEdge,
  createNode,
  deleteEdge,
  deleteNode,
  updateStore,
} from "@/src/presentation/actions/admin-store-actions";

const NODE_TYPES: MapNodeType[] = [
  "entrance",
  "checkout",
  "aisle",
  "department",
  "intersection",
  "waypoint",
  "product_point",
];

export default async function AdminStoreDetailPage({
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
  const nodeLabelById = new Map(nodes.map((n) => [n.id, n.label]));
  const boundUpdateStore = updateStore.bind(null, storeId);
  const boundCreateNode = createNode.bind(null, storeId);
  const boundCreateEdge = createEdge.bind(null, storeId);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">{store.name}</h1>
        <Link
          href={`/admin/stores/${storeId}/preview`}
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          תצוגה מקדימה של מסלול ←
        </Link>
      </div>

      <form
        action={boundUpdateStore}
        className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4"
      >
        <h2 className="font-semibold text-neutral-900">פרטי הסניף</h2>
        <input
          name="name"
          defaultValue={store.name}
          className="rounded-lg border border-neutral-300 p-2"
        />
        <input
          name="address"
          defaultValue={store.address}
          className="rounded-lg border border-neutral-300 p-2"
        />
        <input
          name="city"
          defaultValue={store.city}
          className="rounded-lg border border-neutral-300 p-2"
        />
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" name="isActive" defaultChecked={store.isActive} />
          סניף פעיל
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" name="promotionsEnabled" defaultChecked={store.promotionsEnabled} />
          הצגת מבצעים במסלול
        </label>
        <button
          type="submit"
          className="self-start rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white"
        >
          שמור
        </button>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-neutral-900">צמתים ({nodes.length})</h2>
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
                  <td className="p-2">{node.label}</td>
                  <td className="p-2">{node.type}</td>
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
            placeholder="תווית"
            required
            className="rounded-lg border border-neutral-300 p-2"
          />
          <select name="type" className="rounded-lg border border-neutral-300 p-2">
            {NODE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
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
            className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white"
          >
            הוסף צומת
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-neutral-900">קשתות ({edges.length})</h2>
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="p-2 text-start">מ-</th>
                <th className="p-2 text-start">אל</th>
                <th className="p-2 text-start">מרחק (מ&apos;)</th>
                <th className="p-2 text-start">דו-כיווני</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {edges.map((edge) => (
                <tr key={edge.id} className="border-t border-neutral-100">
                  <td className="p-2">{nodeLabelById.get(edge.fromNodeId) ?? edge.fromNodeId}</td>
                  <td className="p-2">{nodeLabelById.get(edge.toNodeId) ?? edge.toNodeId}</td>
                  <td className="p-2">{edge.distanceMeters}</td>
                  <td className="p-2">{edge.bidirectional ? "כן" : "לא"}</td>
                  <td className="p-2">
                    <form action={deleteEdge.bind(null, storeId, edge.id)}>
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
          action={boundCreateEdge}
          className="grid grid-cols-2 gap-2 rounded-xl border border-neutral-200 bg-white p-4 sm:grid-cols-5"
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
          <input
            name="distanceMeters"
            type="number"
            step="0.1"
            min="0"
            placeholder="מרחק (מ')"
            required
            className="rounded-lg border border-neutral-300 p-2"
          />
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" name="bidirectional" defaultChecked /> דו-כיווני
          </label>
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white"
          >
            הוסף קשת
          </button>
        </form>
      </section>
    </div>
  );
}
