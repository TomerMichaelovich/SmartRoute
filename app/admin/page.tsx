import Link from "next/link";
import {
  edgeRepository,
  nodeRepository,
  productRepository,
  promotionRepository,
  storeRepository,
} from "@/src/infrastructure/container";
import { StatTile } from "@/src/presentation/components/summary/StatTile";

export default async function AdminDashboardPage() {
  const [stores, products, promotions] = await Promise.all([
    storeRepository.findAll(),
    productRepository.findAll(),
    promotionRepository.findAll(),
  ]);

  let nodeCount = 0;
  let edgeCount = 0;
  for (const store of stores) {
    nodeCount += (await nodeRepository.findByStore(store.id)).length;
    edgeCount += (await edgeRepository.findByStore(store.id)).length;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-neutral-900">לוח בקרה</h1>

      <div className="flex flex-wrap gap-3">
        <div className="w-32">
          <StatTile label="סניפים" value={stores.length} />
        </div>
        <div className="w-32">
          <StatTile label="צמתים" value={nodeCount} />
        </div>
        <div className="w-32">
          <StatTile label="קשתות" value={edgeCount} />
        </div>
        <div className="w-32">
          <StatTile label="מוצרים" value={products.length} />
        </div>
        <div className="w-32">
          <StatTile label="מבצעים" value={promotions.length} />
        </div>
      </div>

      <nav className="flex flex-col gap-2">
        <Link
          href="/admin/stores"
          className="rounded-xl border border-neutral-200 bg-white p-4 font-medium text-neutral-900 hover:border-emerald-400"
        >
          ניהול סניפים, צמתים וקשתות
        </Link>
        <Link
          href="/admin/products"
          className="rounded-xl border border-neutral-200 bg-white p-4 font-medium text-neutral-900 hover:border-emerald-400"
        >
          ניהול מוצרים וכינויים
        </Link>
        <Link
          href="/admin/promotions"
          className="rounded-xl border border-neutral-200 bg-white p-4 font-medium text-neutral-900 hover:border-emerald-400"
        >
          ניהול מבצעים
        </Link>
        <Link
          href="/admin/analytics"
          className="rounded-xl border border-neutral-200 bg-white p-4 font-medium text-neutral-900 hover:border-emerald-400"
        >
          אנליטיקס
        </Link>
      </nav>
    </div>
  );
}
