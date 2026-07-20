import type { ProductCategory } from "@/src/domain/entities/product";
import {
  nodeRepository,
  productRepository,
  storeRepository,
} from "@/src/infrastructure/container";
import { createProduct, updateProduct } from "@/src/presentation/actions/admin-product-actions";

const CATEGORIES: ProductCategory[] = [
  "produce",
  "bakery",
  "dairy",
  "meat_fish",
  "frozen",
  "pantry",
  "beverages",
  "snacks",
  "household",
  "personal_care",
  "other",
];

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string }>;
}) {
  const { department } = await searchParams;
  const [allProducts, stores] = await Promise.all([
    productRepository.findAll(),
    storeRepository.findAll(),
  ]);
  const products = department ? allProducts.filter((p) => p.department === department) : allProducts;
  const departments = Array.from(new Set(allProducts.map((p) => p.department))).sort();

  const nodesByStore = await Promise.all(stores.map((s) => nodeRepository.findByStore(s.id)));
  const locationOptions = stores.flatMap((store, i) =>
    nodesByStore[i]
      .filter((n) => n.type === "department" || n.type === "aisle" || n.type === "product_point")
      .map((n) => ({ value: `${store.id}::${n.id}`, label: `${store.name} — ${n.label}` })),
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-neutral-900">מוצרים ({allProducts.length})</h1>

      <div className="flex flex-wrap gap-2">
        <a
          href="/admin/products"
          className={`rounded-full px-3 py-1 text-sm ${
            !department ? "bg-emerald-600 text-white" : "bg-white text-neutral-600"
          }`}
        >
          הכל
        </a>
        {departments.map((d) => (
          <a
            key={d}
            href={`/admin/products?department=${encodeURIComponent(d)}`}
            className={`rounded-full px-3 py-1 text-sm ${
              department === d ? "bg-emerald-600 text-white" : "bg-white text-neutral-600"
            }`}
          >
            {d}
          </a>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {products.map((product) => (
          <details key={product.id} className="rounded-xl border border-neutral-200 bg-white p-4">
            <summary className="flex cursor-pointer items-center justify-between font-medium text-neutral-900">
              <span>
                {product.canonicalName}
                {!product.isActive && <span className="ms-2 text-xs text-red-500">(לא פעיל)</span>}
              </span>
              <span className="text-sm text-neutral-400">{product.department}</span>
            </summary>
            <form
              action={updateProduct.bind(null, product.id)}
              className="mt-3 flex flex-col gap-2"
            >
              <input
                name="canonicalName"
                defaultValue={product.canonicalName}
                className="rounded-lg border border-neutral-300 p-2"
              />
              <input
                name="department"
                defaultValue={product.department}
                className="rounded-lg border border-neutral-300 p-2"
              />
              <select
                name="category"
                defaultValue={product.category}
                className="rounded-lg border border-neutral-300 p-2"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                name="aliases"
                defaultValue={product.aliases.join(", ")}
                placeholder="כינויים, מופרדים בפסיק"
                className="rounded-lg border border-neutral-300 p-2"
              />
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" name="isActive" defaultChecked={product.isActive} /> פעיל
              </label>
              <button
                type="submit"
                className="self-start rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
              >
                שמור
              </button>
            </form>
          </details>
        ))}
      </div>

      <form
        action={createProduct}
        className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4"
      >
        <h2 className="font-semibold text-neutral-900">מוצר חדש</h2>
        <input
          name="chainId"
          placeholder="מזהה רשת (chainId)"
          required
          className="rounded-lg border border-neutral-300 p-2"
        />
        <input
          name="canonicalName"
          placeholder="שם המוצר"
          required
          className="rounded-lg border border-neutral-300 p-2"
        />
        <input
          name="department"
          placeholder="מחלקה"
          required
          className="rounded-lg border border-neutral-300 p-2"
        />
        <select name="category" defaultValue="other" className="rounded-lg border border-neutral-300 p-2">
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select name="location" required className="rounded-lg border border-neutral-300 p-2">
          <option value="">מיקום בחנות...</option>
          {locationOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <input
          name="aliases"
          placeholder="כינויים, מופרדים בפסיק"
          className="rounded-lg border border-neutral-300 p-2"
        />
        <button
          type="submit"
          className="self-start rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white"
        >
          צור מוצר
        </button>
      </form>
    </div>
  );
}
