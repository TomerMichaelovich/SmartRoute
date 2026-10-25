import Link from "next/link";
import type { ProductCategory } from "@smartroute/core/domain/entities/product";
import { productRepository, storeRepository } from "@/src/infrastructure/container";
import { createProduct, updateProduct } from "@/src/presentation/actions/admin-product-actions";
import { PRODUCT_CATEGORY_LABELS } from "@/src/presentation/product-category-labels";
import { requireAdminPage } from "@/src/presentation/auth/admin";

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

const DEPARTMENT_HINT = "לקיבוץ וסינון המוצרים כאן ובמסכי הבחירה. המיקום בחנות נקבע בעורך הפריסה של הסניף.";

/** Only drives the item's icon in the app (home list, widget, "did you mean"). */
function CategorySelect({ defaultValue }: { defaultValue: ProductCategory }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-neutral-700">
      אייקון באפליקציה
      <select name="category" defaultValue={defaultValue} className="rounded-lg border border-neutral-300 p-2">
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {PRODUCT_CATEGORY_LABELS[c]}
          </option>
        ))}
      </select>
      <span className="text-xs text-neutral-500">הסמל שמופיע ליד הפריט ברשימה, בווידג׳ט ובחלון ״התכוונת ל...?״.</span>
    </label>
  );
}

function ChainSelect({ chains, defaultValue }: { chains: string[]; defaultValue: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-neutral-700">
      רשת
      <select name="chainId" defaultValue={defaultValue} className="rounded-lg border border-neutral-300 p-2">
        <option value="">כללי - נמכר בכל הרשתות</option>
        {chains.map((c) => (
          <option key={c} value={c}>
            בלעדי לרשת {c}
          </option>
        ))}
      </select>
      <span className="text-xs text-neutral-500">
        מוצר בלעדי לרשת (למשל מותג פרטי) לא יוצע ללקוח לפני שבחר סניף של אותה רשת.
      </span>
    </label>
  );
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string }>;
}) {
  await requireAdminPage("products");
  const { department } = await searchParams;
  const [allProducts, stores] = await Promise.all([productRepository.findAll(), storeRepository.findAll()]);
  const chains = Array.from(new Set(stores.map((s) => s.chainId))).sort();
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
            !department ? "bg-cyan-600 text-white" : "bg-white text-neutral-600"
          }`}
        >
          הכל
        </a>
        {departments.map((d) => (
          <a
            key={d}
            href={`/admin/products?department=${encodeURIComponent(d)}`}
            className={`rounded-full px-3 py-1 text-sm ${
              department === d ? "bg-cyan-600 text-white" : "bg-white text-neutral-600"
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
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          מחלקה
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
          <span className="text-xs text-neutral-500">{DEPARTMENT_HINT}</span>
        </label>
        <CategorySelect defaultValue="other" />
        <input
          name="aliases"
          placeholder="כינויים, מופרדים בפסיק"
          className="rounded-lg border border-neutral-300 p-2"
        />
        <ChainSelect chains={chains} defaultValue="" />
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          תמונת מוצר (אופציונלי)
          <input
            type="file"
            name="image"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="text-xs text-neutral-600 file:me-2 file:rounded-full file:border-0 file:bg-neutral-100 file:px-2 file:py-1 file:text-xs"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white"
          >
            צור מוצר
          </button>
          <button
            type="submit"
            name="then"
            value="skus"
            className="rounded-lg border border-cyan-600 px-4 py-2 font-semibold text-cyan-700"
          >
            צור ועבור למוצרים ברשתות ←
          </button>
        </div>
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
                {product.chainId && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">{product.chainId}</span>
                )}
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
              <label className="flex flex-col gap-1 text-sm text-neutral-700">
                מחלקה
                <input
                  name="department"
                  defaultValue={product.department}
                  className="rounded-lg border border-neutral-300 p-2"
                />
                <span className="text-xs text-neutral-500">{DEPARTMENT_HINT}</span>
              </label>
              <CategorySelect defaultValue={product.category} />
              <input
                name="aliases"
                defaultValue={product.aliases.join(", ")}
                placeholder="כינויים, מופרדים בפסיק"
                className="rounded-lg border border-neutral-300 p-2"
              />
              <ChainSelect chains={chains} defaultValue={product.chainId ?? ""} />
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
                className="self-start rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white"
              >
                שמור
              </button>
            </form>
            {/* Chain products too: linking their own barcode lets a pick in the
                cheapest-basket popup decide which shelf the route goes to. */}
            <Link
              href={`/admin/products/${product.id}/skus`}
              className="mt-3 inline-block text-xs font-medium text-cyan-700 hover:underline"
            >
              מוצרים ברשתות ומחירים ←
            </Link>
          </details>
        ))}
      </div>
    </div>
  );
}
