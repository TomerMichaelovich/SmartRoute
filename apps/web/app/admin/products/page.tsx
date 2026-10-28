import Link from "next/link";
import { normalizeHebrewText } from "@smartroute/core/application/classification/normalize-hebrew-text";
import type { ProductCategory } from "@smartroute/core/domain/entities/product";
import { findShelfGroup } from "@smartroute/core/domain/value-objects/shelf-group";
import { catalogAdminRepository, storeRepository } from "@/src/infrastructure/container";
import { createProduct, updateProduct } from "@/src/presentation/actions/admin-product-actions";
import { PRODUCT_CATEGORY_LABELS } from "@/src/presentation/product-category-labels";
import { requireAdminPage } from "@/src/presentation/auth/admin";
import { ShelfGroupSelect } from "@/src/presentation/components/admin/ShelfGroupSelect";

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

const PAGE_SIZE = 50;

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
  searchParams: Promise<{ department?: string; q?: string; kind?: string; group?: string; page?: string }>;
}) {
  await requireAdminPage("products");
  const params = await searchParams;
  // Hand-made products (the generic catalog) and products imported from price files are
  // listed apart: the imported ones run to thousands, so both are searched and paged here.
  const imported = params.kind === "imported";
  const department = params.department || undefined;
  const group = imported ? params.group || undefined : undefined;
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, Number(params.page) || 1);
  const [{ products, total }, departments, stores] = await Promise.all([
    catalogAdminRepository.searchProducts({
      imported,
      text: normalizeHebrewText(q) || undefined,
      department,
      shelfGroup: group,
      offset: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    }),
    catalogAdminRepository.departments(imported),
    storeRepository.findAll(),
  ]);
  const chains = Array.from(new Set(stores.map((s) => s.chainId))).sort();
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { kind: imported ? "imported" : undefined, q: q || undefined, department, group, ...changes };
    for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value);
    return `/admin/products${next.size ? `?${next}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-neutral-900">מוצרים ({total})</h1>

      <div className="flex gap-2">
        <a
          href="/admin/products"
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${!imported ? "bg-cyan-600 text-white" : "bg-white text-neutral-600"}`}
        >
          מוצרים כלליים
        </a>
        <a
          href="/admin/products?kind=imported"
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${imported ? "bg-cyan-600 text-white" : "bg-white text-neutral-600"}`}
        >
          מיובאים מקבצי מחירים
        </a>
      </div>

      <form action="/admin/products" className="flex flex-wrap items-end gap-2 rounded-xl border border-neutral-200 bg-white p-3">
        {imported && <input type="hidden" name="kind" value="imported" />}
        <input
          name="q"
          defaultValue={q}
          placeholder="חיפוש לפי שם או כינוי"
          className="min-w-48 flex-1 rounded-lg border border-neutral-300 p-2 text-sm"
        />
        <select name="department" defaultValue={department ?? ""} className="rounded-lg border border-neutral-300 p-2 text-sm">
          <option value="">כל המחלקות</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        {imported && (
          <ShelfGroupSelect
            name="group"
            defaultValue={group}
            emptyLabel="כל קבוצות המדף"
            className="rounded-lg border border-neutral-300 p-2 text-sm"
          />
        )}
        <button type="submit" className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white">
          חפש
        </button>
      </form>

      {!imported && (
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
      )}

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
                {product.manuallyEdited && (
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">נערך ידנית</span>
                )}
              </span>
              <span className="text-sm text-neutral-400">
                {(product.shelfGroup && findShelfGroup(product.shelfGroup)?.name) || product.department}
              </span>
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
              {product.sourceItemKey ? (
                <>
                  <span className="text-xs text-neutral-500" dir="ltr">
                    {product.sourceItemKey}
                  </span>
                  <label className="flex flex-col gap-1 text-sm text-neutral-700">
                    קבוצת מדף
                    <ShelfGroupSelect
                      lazy
                      name="shelfGroup"
                      defaultValue={product.shelfGroup ?? undefined}
                      className="rounded-lg border border-neutral-300 p-2"
                    />
                    <span className="text-xs text-neutral-500">
                      איפה הפריט עומד בחנות; המחלקה נקבעת לפי הקבוצה. עריכה כאן נשמרת גם בייבוא הבא.
                    </span>
                  </label>
                </>
              ) : (
                <label className="flex flex-col gap-1 text-sm text-neutral-700">
                  מחלקה
                  <input
                    name="department"
                    defaultValue={product.department}
                    className="rounded-lg border border-neutral-300 p-2"
                  />
                  <span className="text-xs text-neutral-500">{DEPARTMENT_HINT}</span>
                </label>
              )}
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
        {products.length === 0 && <p className="text-sm text-neutral-400">לא נמצאו מוצרים</p>}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <a href={link({ page: String(page - 1) })} className="text-cyan-700 hover:underline">
              → הקודם
            </a>
          )}
          <span className="text-neutral-500">
            עמוד {page} מתוך {pages}
          </span>
          {page < pages && (
            <a href={link({ page: String(page + 1) })} className="text-cyan-700 hover:underline">
              הבא ←
            </a>
          )}
        </div>
      )}
    </div>
  );
}
