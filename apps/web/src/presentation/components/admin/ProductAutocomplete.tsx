"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

const SEARCH_DELAY_MS = 200;

interface SearchResult {
  id: string;
  canonicalName: string;
  /** Shelf group of an imported product, department of a hand-made one. */
  hint: string;
  /** Imported from another branch's price file - this store's branch doesn't list it. */
  notCarried: boolean;
  /** Marked as not sold at this store; adding it clears the mark. */
  excluded: boolean;
  /** Where products sharing one of its aliases already stand in the store. */
  placedAliases: Array<{ alias: string; nodeId: string; count: number }>;
}

interface ProductAutocompleteProps {
  storeId: string;
  /** The node products are added to - an alias already placed here is no news. */
  nodeId: string;
  /** The store's department nodes, to say where an alias already stands. */
  departmentNodes: Array<{ id: string; label: string }>;
  onAdd: (productId: string) => Promise<void>;
}

const singleLine = (label: string) => label.replace(/\s*\n\s*/g, " ");

/**
 * Type-to-find product picker for a department's "add product" row. The catalog holds
 * whole price files, so the search runs on the server (see catalog/route.ts): name and
 * aliases, Hebrew-normalized, products not yet placed in this store, best matches first.
 * Enter or a click adds the product at once and clears the field for the next one;
 * arrows move through the suggestions. A product whose alias is already placed at another
 * node says where, so one kind of product doesn't end up split between two places.
 */
export function ProductAutocomplete({ storeId, nodeId, departmentNodes, onAdd }: ProductAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  useEffect(() => {
    const text = query.trim();
    if (!text) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/admin/stores/${storeId}/catalog?q=${encodeURIComponent(text)}`, {
          signal: controller.signal,
        });
        if (response.ok) setResults((await response.json()) as SearchResult[]);
      } catch {
        // Aborted by the next keystroke, or offline: keep the last results.
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, storeId]);

  // An emptied field shows nothing, without waiting for (or clearing) the last results.
  const shown = query.trim() ? results : [];
  const labelOf = new Map(departmentNodes.map((n) => [n.id, singleLine(n.label)]));
  const placedElsewhere = (product: SearchResult) => {
    const byAlias = new Map<string, string[]>();
    for (const p of product.placedAliases) {
      if (p.nodeId === nodeId) continue;
      const places = byAlias.get(p.alias) ?? [];
      places.push(`${labelOf.get(p.nodeId) ?? "נקודה אחרת"} (${p.count})`);
      byAlias.set(p.alias, places);
    }
    return [...byAlias].map(([alias, places]) => `${alias}: ${places.join(", ")}`);
  };

  function add(product: SearchResult) {
    setQuery("");
    setResults([]);
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
      setHighlighted((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const product = shown[highlighted];
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
        aria-expanded={open && shown.length > 0}
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
          {shown.length === 0 ? (
            <li className="p-2 text-sm text-neutral-400">{searching ? "מחפש..." : "לא נמצא מוצר מתאים"}</li>
          ) : (
            shown.map((product, i) => {
              const elsewhere = placedElsewhere(product);
              return (
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
                  className={`flex cursor-pointer flex-col gap-0.5 px-2 py-1.5 text-sm ${
                    i === highlighted ? "bg-cyan-50 text-cyan-900" : "text-neutral-800"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span>{product.canonicalName}</span>
                    <span className="shrink-0 text-xs text-neutral-400">
                      {product.hint}
                      {product.notCarried && " · לא בקובץ הסניף"}
                      {product.excluded && " · סומן כלא נמכר בסניף"}
                    </span>
                  </span>
                  {elsewhere.length > 0 && (
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">
                      📍 כינוי שכבר מוקם: {elsewhere.join(" · ")}
                    </span>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
