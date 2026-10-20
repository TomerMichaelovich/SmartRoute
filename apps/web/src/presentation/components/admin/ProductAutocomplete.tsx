"use client";

import { useId, useMemo, useRef, useState, useTransition } from "react";
import { normalizeHebrewText } from "@smartroute/core/application/classification/normalize-hebrew-text";
import type { Product } from "@smartroute/core/domain/entities/product";

const MAX_RESULTS = 8;

interface ProductAutocompleteProps {
  /** Products that may be added (not yet listed anywhere in this store). */
  products: Product[];
  onAdd: (productId: string) => Promise<void>;
}

/**
 * Type-to-find product picker for a department's "add product" row: matches the typed text
 * against each product's name and aliases (Hebrew-normalized, so ה-prefixes, final letters and
 * spacing don't matter), names that start with it first. Enter or a click adds the product at
 * once and clears the field for the next one; arrows move through the suggestions.
 */
export function ProductAutocomplete({ products, onAdd }: ProductAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const results = useMemo(() => {
    const normalized = normalizeHebrewText(query);
    if (!normalized) return [];
    const ranked: Array<{ product: Product; rank: number }> = [];
    for (const product of products) {
      let rank = Infinity;
      for (const alias of product.normalizedAliases) {
        if (alias.startsWith(normalized)) rank = Math.min(rank, 0);
        else if (alias.split(" ").some((word) => word.startsWith(normalized))) rank = Math.min(rank, 1);
        else if (alias.includes(normalized)) rank = Math.min(rank, 2);
      }
      if (rank !== Infinity) ranked.push({ product, rank });
    }
    return ranked
      .sort((a, b) => a.rank - b.rank || a.product.canonicalName.localeCompare(b.product.canonicalName, "he"))
      .slice(0, MAX_RESULTS)
      .map((r) => r.product);
  }, [query, products]);

  function add(product: Product) {
    setQuery("");
    setOpen(false);
    setHighlighted(0);
    startTransition(async () => {
      await onAdd(product.id);
      inputRef.current?.focus();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlighted((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const product = results[highlighted];
      if (product) add(product);
    } else if (e.key === "Escape") {
      // Keep Escape here - the editor's own Escape handler would clear the selection.
      e.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlighted(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Delayed so a click on a suggestion lands before the list closes.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        // Not disabled while adding: the field keeps focus, ready for the next product.
        placeholder={isPending ? "מוסיף..." : "הקלידו שם מוצר להוספה..."}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listboxId}
        aria-autocomplete="list"
        className="w-full rounded-lg border border-neutral-300 p-1.5 text-sm"
      />
      {open && query.trim() !== "" && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg"
        >
          {results.length === 0 ? (
            <li className="p-2 text-sm text-neutral-400">לא נמצא מוצר מתאים</li>
          ) : (
            results.map((product, i) => (
              <li
                key={product.id}
                role="option"
                aria-selected={i === highlighted}
                // mousedown, not click: fires before the input's blur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(product);
                }}
                onMouseEnter={() => setHighlighted(i)}
                className={`flex cursor-pointer items-center justify-between gap-2 px-2 py-1.5 text-sm ${
                  i === highlighted ? "bg-cyan-50 text-cyan-900" : "text-neutral-800"
                }`}
              >
                <span>{product.canonicalName}</span>
                <span className="text-xs text-neutral-400">{product.department}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
