"use client";

import { useEffect, useState, useTransition } from "react";
import { RetailImage } from "./RetailImage";

const SEARCH_DELAY_MS = 250;

interface AliasProduct {
  id: string;
  canonicalName: string;
  aliases: string[];
  sourceItemKey: string | null;
  nodeId: string | null;
}

interface AliasResult {
  products: AliasProduct[];
  /** With where the store's products answering to each suggested alias already stand. */
  suggestions: Array<{ alias: string; products: number; placedAt: Array<{ nodeId: string; count: number }> }>;
}

interface AliasPlacePanelProps {
  storeId: string;
  nodeId: string;
  /** The store's department nodes, to say where products already stand. */
  departmentNodes: Array<{ id: string; label: string }>;
  placeAliasOnNode: (
    storeId: string,
    nodeId: string,
    alias: string,
    moveOthers: boolean,
  ) => Promise<{ placed: number; moved: number }>;
}

const singleLine = (label: string) => label.replace(/\s*\n\s*/g, " ");

/**
 * Places at a department node every product of the branch file a shopper finds by one
 * alias ("ג'ין"), whatever shelf group each got - the products already placed at other
 * nodes only when asked to move them too. Typing shows the products answering to exactly
 * that alias (with their aliases, to catch a wrong one) and other aliases containing it.
 * An alias already placed at another node is called out (and its chip colored), so one
 * kind of product doesn't end up split between two places by mistake.
 */
export function AliasPlacePanel({ storeId, nodeId, departmentNodes, placeAliasOnNode }: AliasPlacePanelProps) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<AliasResult | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [moveOthers, setMoveOthers] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const text = query.trim();
    if (!text) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/admin/stores/${storeId}/catalog?alias=${encodeURIComponent(text)}`, {
          signal: controller.signal,
        });
        if (response.ok) setResult((await response.json()) as AliasResult);
      } catch {
        // Aborted by the next keystroke, or offline: keep the last result.
      }
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, storeId, refresh]);

  // An emptied field shows nothing, without waiting for (or clearing) the last result.
  const shown = query.trim() ? result : null;
  const labelOf = new Map(departmentNodes.map((n) => [n.id, singleLine(n.label)]));
  const products = shown?.products ?? [];
  const unplaced = products.filter((p) => p.nodeId === null);
  const here = products.filter((p) => p.nodeId === nodeId);
  const elsewhere = products.filter((p) => p.nodeId !== null && p.nodeId !== nodeId);
  const toPlace = unplaced.length + (moveOthers ? elsewhere.length : 0);
  const elsewhereByNode = new Map<string, number>();
  for (const p of elsewhere) elsewhereByNode.set(p.nodeId!, (elsewhereByNode.get(p.nodeId!) ?? 0) + 1);
  const placedElsewhere = (placedAt: Array<{ nodeId: string; count: number }>) =>
    placedAt.filter((p) => p.nodeId !== nodeId);
  const describePlaces = (places: Array<{ nodeId: string; count: number }>) =>
    places.map((p) => `${labelOf.get(p.nodeId) ?? "נקודה אחרת"} (${p.count})`).join(" · ");
  const otherAliases = (shown?.suggestions ?? []).filter((s) => s.alias.trim() !== query.trim()).slice(0, 6);

  function place() {
    const alias = query.trim();
    startTransition(async () => {
      const { placed, moved } = await placeAliasOnNode(storeId, nodeId, alias, moveOthers);
      setMessage(moved > 0 ? `שויכו ${placed} פריטים, הועברו לכאן ${moved}` : `שויכו ${placed} פריטים`);
      setMoveOthers(false);
      setRefresh((n) => n + 1);
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-neutral-100 pt-3">
      <h3 className="text-sm font-semibold text-neutral-700">שיוך לפי כינוי</h3>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setMessage(null);
        }}
        placeholder="כינוי, למשל ג'ין"
        className="rounded-lg border border-neutral-300 p-1.5 text-sm"
      />

      {shown && products.length === 0 && (
        <p className="text-xs text-neutral-400">
          {otherAliases.length > 0 ? "אין פריטים עם הכינוי הזה בדיוק. אולי:" : "אין בסניף פריטים עם כינוי כזה"}
        </p>
      )}
      {elsewhereByNode.size > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          <p className="font-semibold">⚠ הכינוי &quot;{query.trim()}&quot; כבר מוקם בנקודה אחרת</p>
          <p className="mt-0.5">
            {describePlaces([...elsewhereByNode].map(([id, count]) => ({ nodeId: id, count })))}
          </p>
        </div>
      )}
      {otherAliases.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {otherAliases.map((s) => {
            const places = placedElsewhere(s.placedAt);
            return (
              <button
                key={s.alias}
                type="button"
                onClick={() => setQuery(s.alias)}
                title={places.length > 0 ? `כבר מוקם ב: ${describePlaces(places)}` : undefined}
                className={`rounded-full border px-2 py-0.5 text-xs hover:border-cyan-600 hover:text-cyan-700 ${
                  places.length > 0 ? "border-amber-400 bg-amber-50 text-amber-800" : "border-neutral-300 text-neutral-600"
                }`}
              >
                {places.length > 0 && "📍 "}
                {s.alias} ({s.products})
              </button>
            );
          })}
        </div>
      )}
      {otherAliases.some((s) => placedElsewhere(s.placedAt).length > 0) && (
        <p className="text-xs text-amber-700">📍 כינוי שכבר מוקם בנקודה אחרת (העבירו את העכבר לראות איפה)</p>
      )}

      {products.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-neutral-50 p-2">
          <p className="text-xs text-neutral-600">
            {products.length} פריטים עונים לכינוי: {unplaced.length} לא משויכים · {here.length} כבר כאן ·{" "}
            {elsewhere.length} בנקודות אחרות
          </p>
          <ul className="flex max-h-64 flex-col overflow-y-auto">
            {products.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-2 py-1 text-sm">
                <RetailImage itemKey={p.sourceItemKey} className="h-10 w-10" />
                <span className="flex flex-1 flex-col">
                  {p.canonicalName}
                  <span className="text-xs text-neutral-500">{p.aliases.join(" · ")}</span>
                </span>
                <span
                  className={`shrink-0 text-xs ${
                    p.nodeId === null ? "text-emerald-700" : p.nodeId === nodeId ? "text-neutral-400" : "text-amber-700"
                  }`}
                >
                  {p.nodeId === null ? "לא משויך" : p.nodeId === nodeId ? "כבר כאן" : (labelOf.get(p.nodeId) ?? "נקודה אחרת")}
                </span>
              </li>
            ))}
          </ul>
          {elsewhere.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-neutral-600">
              <input type="checkbox" checked={moveOthers} onChange={(e) => setMoveOthers(e.target.checked)} />
              להעביר לכאן גם {elsewhere.length} שמשויכים לנקודות אחרות
            </label>
          )}
          <button
            type="button"
            onClick={place}
            disabled={toPlace === 0 || isPending}
            className="self-start rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {isPending ? "משייך..." : toPlace > 0 ? `שייך ${toPlace} פריטים לכאן` : "אין פריטים לשייך"}
          </button>
        </div>
      )}
      {message && <p className="text-xs text-emerald-700">{message}</p>}
    </div>
  );
}
