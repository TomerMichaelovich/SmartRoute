import type { ReactNode } from "react";

/** The barcode (or the chain's own code) without the "<chainId>:" of internal keys. */
export const codeOf = (itemKey: string | null) => itemKey?.replace(/^.*:/, "") ?? null;

/** The product's edit form on the products page, found by its code and unfolded. */
function productEditHref(product: { id: string; canonicalName: string; sourceItemKey: string | null }): string {
  const code = codeOf(product.sourceItemKey);
  const params = new URLSearchParams({ q: code ?? product.canonicalName, open: product.id });
  if (code) params.set("kind", "imported");
  return `/admin/products?${params}`;
}

/**
 * A product as the map editor's lists show it: its name (opening its edit form in a new
 * tab, the editor kept, for admins who may edit products) with its barcode beside it,
 * and the line of aliases a shopper's list matches it by below.
 */
export function ProductLabel({
  product,
  editable,
  badge,
  aliases,
}: {
  product: { id: string; canonicalName: string; aliases: string[]; sourceItemKey: string | null };
  editable: boolean;
  /** Shown after the barcode, e.g. the product's shelf group. */
  badge?: ReactNode;
  /** The aliases line, when it needs more than the aliases joined. */
  aliases?: ReactNode;
}) {
  return (
    <span className="flex flex-1 flex-col">
      <span className="flex flex-wrap items-baseline gap-x-2">
        {editable ? (
          <a
            href={productEditHref(product)}
            target="_blank"
            rel="noreferrer"
            title="עריכת המוצר (בלשונית חדשה)"
            className="hover:text-cyan-700 hover:underline"
          >
            {product.canonicalName}
          </a>
        ) : (
          product.canonicalName
        )}
        {product.sourceItemKey && (
          <span className="text-xs text-neutral-400" dir="ltr">
            {codeOf(product.sourceItemKey)}
          </span>
        )}
        {badge}
      </span>
      <span className="text-xs text-neutral-500">{aliases ?? (product.aliases.join(" · ") || "אין כינויים")}</span>
    </span>
  );
}
