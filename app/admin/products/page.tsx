import type { ProductCategory } from "@/src/domain/entities/product";
import { productRepository } from "@/src/infrastructure/container";
import { createProduct, updateProduct } from "@/src/presentation/actions/admin-product-actions";
import { PRODUCT_CATEGORY_LABELS } from "@/src/presentation/product-category-labels";

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
  const allProducts = await productRepository.findAll();
  const products = department ? allProducts.filter((p) => p.department === department) : allProducts;
  const departments = Array.from(new Set(allProducts.map((p) => p.department))).sort();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-neutral-900">
        מוצרים ({products.length}
        {products.length !== allProducts.length ? ` מתוך ${allProducts.length}` : ""})
      </h1>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-neutral-500">מחלקה:</span>
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

      <form
        action={createProduct}
        className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4"
      >
        <h2 className="text-base font-semibold text-neutral-900">מוצר חדש</h2>
        <p className="text-xs text-neutral-500">
          יוצר רק את הגדרת המוצר במאגר הראשי. כדי לשייך אותו לסניף ולמיקום ספציפי, עברו לעורך
          הפריסה של הסניף ובחרו/הוסיפו אותו מתוך הצומת הרצוי.
        </p>
        <input
          name="canonicalName"
          placeholder="שם המוצר"
          required
          className="rounded-lg border border-neutral-300 p-2"
        />
        <select
          name="department"
          required
          defaultValue=""
          className="rounded-lg border border-neutral-300 p-2"
        >
          <option value="" disabled>
            בחרו מחלקה
          </option>
          {!departments.includes("כללי") && <option value="כללי">כללי</option>}
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select name="category" defaultValue="other" className="rounded-lg border border-neutral-300 p-2">
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {PRODUCT_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <input
          name="aliases"
          placeholder="כינויים, מופרדים בפסיק"
          className="rounded-lg border border-neutral-300 p-2"
        />
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          תמונת מוצר (אופציונלי)
          <input
            type="file"
            name="image"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="text-xs text-neutral-600 file:me-2 file:rounded-full file:border-0 file:bg-neutral-100 file:px-2 file:py-1 file:text-xs"
          />
        </label>
        <button
          type="submit"
          className="self-start rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white"
        >
          צור מוצר
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {products.map((product) => (
          <details key={product.id} className="rounded-xl border border-neutral-200 bg-white p-4">
            <summary className="flex cursor-pointer items-center justify-between font-medium text-neutral-900">
              <span className="flex items-center gap-2">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Blob-hosted upload of unknown/variable size, not worth next/image's optimization setup
                  <img
                    src={product.imageUrl}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-lg border border-neutral-200 object-cover"
                  />
                ) : (
                  <span className="h-8 w-8 shrink-0 rounded-lg border border-dashed border-neutral-200" />
                )}
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
                    {PRODUCT_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              <input
                name="aliases"
                defaultValue={product.aliases.join(", ")}
                placeholder="כינויים, מופרדים בפסיק"
                className="rounded-lg border border-neutral-300 p-2"
              />
              <label className="flex flex-col gap-1 text-sm text-neutral-700">
                תמונת מוצר{product.imageUrl ? " (החלפה)" : " (אופציונלי)"}
                <input
                  type="file"
                  name="image"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="text-xs text-neutral-600 file:me-2 file:rounded-full file:border-0 file:bg-neutral-100 file:px-2 file:py-1 file:text-xs"
                />
              </label>
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
    </div>
  );
}
