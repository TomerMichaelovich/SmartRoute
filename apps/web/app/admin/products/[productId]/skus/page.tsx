import Link from "next/link";
import { notFound } from "next/navigation";
import { priceRepository, productRepository } from "@/src/infrastructure/container";
import type { RetailItemSearchResult, SkuLinkView } from "@/src/infrastructure/repositories/interfaces/price-repository";
import { addSkuLink, setSkuLinkRejected, setSkuLinkTypical } from "@/src/presentation/actions/admin-sku-link-actions";
import { requireAdminPage } from "@/src/presentation/auth/admin";

const shekels = (agorot: number) => `₪${(agorot / 100).toFixed(2)}`;

function priceRange(link: Pick<SkuLinkView, "minPriceAgorot" | "maxPriceAgorot">): string {
  if (link.minPriceAgorot === null || link.maxPriceAgorot === null) return "—";
  return link.minPriceAgorot === link.maxPriceAgorot
    ? shekels(link.minPriceAgorot)
    : `${shekels(link.minPriceAgorot)}–${shekels(link.maxPriceAgorot)}`;
}

function LinkRow({ productId, link }: { productId: string; link: SkuLinkView }) {
  return (
    <tr className="border-t border-neutral-100 align-top">
      <td className="p-2">
        <div className="font-medium text-neutral-900">{link.name}</div>
        <div className="text-xs text-neutral-500">
          {link.variantLabel ?? ""}
          {link.manufacturer ? ` · ${link.manufacturer}` : ""}
        </div>
        <div className="mt-1 flex gap-1 text-[11px]">
          {link.isTypical && <span className="rounded-full bg-cyan-50 px-2 text-cyan-700">טיפוסי</span>}
          {link.source === "manual" && <span className="rounded-full bg-amber-50 px-2 text-amber-700">ידני</span>}
        </div>
      </td>
      <td className="whitespace-nowrap p-2 text-neutral-600">{priceRange(link)}</td>
      <td className="p-2 text-center text-neutral-600">{link.branchCount}</td>
      <td className="p-2">
        <div className="flex flex-col gap-1">
          {link.isRejected ? (
            <form action={setSkuLinkRejected.bind(null, productId, link.itemKey, false)}>
              <button type="submit" className="text-xs text-cyan-700 hover:underline">
                שייך
              </button>
            </form>
          ) : (
            <>
              <form action={setSkuLinkTypical.bind(null, productId, link.itemKey, !link.isTypical)}>
                <button type="submit" className="text-xs text-cyan-700 hover:underline">
                  {link.isTypical ? "בטל טיפוסי" : "סמן טיפוסי"}
                </button>
              </form>
              <form action={setSkuLinkRejected.bind(null, productId, link.itemKey, true)}>
                <button type="submit" className="text-xs text-red-600 hover:underline">
                  לא שייך
                </button>
              </form>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function LinksTable({ productId, links }: { productId: string; links: SkuLinkView[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-neutral-500">
        <tr>
          <th className="p-2 text-start font-medium">מוצר ברשתות</th>
          <th className="p-2 text-start font-medium">מחיר</th>
          <th className="p-2 font-medium">סניפים</th>
          <th className="p-2" />
        </tr>
      </thead>
      <tbody>
        {links.map((link) => (
          <LinkRow key={link.itemKey} productId={productId} link={link} />
        ))}
      </tbody>
    </table>
  );
}

const SEARCH_LIMIT = 30;

/** Find any chain's product by name words or barcode, and link it by hand. */
function AddLinkSection({ productId, query, results, linked }: {
  productId: string;
  query: string;
  results: RetailItemSearchResult[];
  linked: Map<string, SkuLinkView>;
}) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-2">
      <h2 className="p-2 text-sm font-semibold text-neutral-900">הוספת מוצר מהרשתות</h2>
      <form method="get" className="flex gap-2 p-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="שם מוצר או ברקוד, למשל: טחינה רמי לוי"
          className="flex-1 rounded-lg border border-neutral-300 p-2 text-sm"
        />
        <button type="submit" className="rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-700">
          חיפוש
        </button>
      </form>
      {query && results.length === 0 && <p className="p-2 text-xs text-neutral-500">לא נמצאו מוצרים.</p>}
      {results.length > 0 && (
        <table className="w-full text-sm">
          <tbody>
            {results.map((r) => {
              const link = linked.get(r.itemKey);
              return (
                <tr key={r.itemKey} className="border-t border-neutral-100 align-top">
                  <td className="p-2">
                    <div className="font-medium text-neutral-900">{r.name}</div>
                    <div className="text-xs text-neutral-500">
                      {r.itemKey}
                      {r.manufacturer ? ` · ${r.manufacturer}` : ""}
                    </div>
                  </td>
                  <td className="whitespace-nowrap p-2 text-neutral-600">{priceRange(r)}</td>
                  <td className="p-2 text-center text-neutral-600">{r.branchCount}</td>
                  <td className="p-2">
                    {link && !link.isRejected ? (
                      <span className="text-xs text-neutral-500">משויך</span>
                    ) : (
                      <form action={addSkuLink.bind(null, productId, r.itemKey)}>
                        <button type="submit" className="text-xs text-cyan-700 hover:underline">
                          שייך
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {results.length === SEARCH_LIMIT && (
        <p className="p-2 text-xs text-neutral-500">מוצגות {SEARCH_LIMIT} התוצאות הנפוצות ביותר – חדדו את החיפוש.</p>
      )}
    </section>
  );
}

export default async function ProductSkusPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdminPage("products");
  const { productId } = await params;
  const query = ((await searchParams).q ?? "").trim();
  const product = await productRepository.findById(productId);
  if (!product) notFound();
  const [links, results] = await Promise.all([
    priceRepository.findSkuLinks(productId),
    query ? priceRepository.searchRetailItems(query, SEARCH_LIMIT) : Promise.resolve([]),
  ]);
  const matched = links.filter((l) => !l.isRejected);
  const rejected = links.filter((l) => l.isRejected);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/products" className="text-xs text-cyan-700 hover:underline">
        ← מוצרים
      </Link>
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">{product.canonicalName} · מוצרים ברשתות</h1>
        <p className="mt-1 text-xs text-neutral-500">
          המוצרים הספציפיים מקובצי המחירים של הרשתות שהלקוח יראה כשיכתוב &quot;{product.canonicalName}&quot;. מוצר
          &quot;טיפוסי&quot; משמש לחישוב &quot;לא משנה לי – הכי זול&quot;. הקישור נבנה אוטומטית כל לילה; החלטה
          שלכם כאן לא תידרס.
        </p>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-2">
        <h2 className="p-2 text-sm font-semibold text-neutral-900">משויכים ({matched.length})</h2>
        {matched.length ? (
          <LinksTable productId={productId} links={matched} />
        ) : (
          <p className="p-2 text-xs text-neutral-500">אין מוצרים משויכים עדיין.</p>
        )}
      </section>

      <AddLinkSection productId={productId} query={query} results={results} linked={new Map(links.map((l) => [l.itemKey, l]))} />

      {rejected.length > 0 && (
        <details className="rounded-xl border border-neutral-200 bg-white p-2">
          <summary className="cursor-pointer p-2 text-sm font-semibold text-neutral-900">
            נפסלו ({rejected.length})
          </summary>
          <LinksTable productId={productId} links={rejected} />
        </details>
      )}
    </div>
  );
}
