"use client";

import { useState, useTransition } from "react";
import { SHELF_GROUPS } from "@smartroute/core/domain/value-objects/shelf-group";

export interface NodeShelfGroup {
  groupId: string;
  name: string;
  /** The group's products placed at this node. */
  count: number;
}

export interface ShelfGroupOption {
  groupId: string;
  name: string;
  department: string;
  /** Products of the group in the store's branch file not placed anywhere in the store. */
  unplaced: number;
}

interface ShelfGroupPanelProps {
  storeId: string;
  nodeId: string;
  /** The store's department nodes, for moving products elsewhere. */
  departmentNodes: Array<{ id: string; label: string }>;
  groupsHere: NodeShelfGroup[];
  groupOptions: ShelfGroupOption[];
  hasPriceBranch: boolean;
  /** May change products' shelf group (the "products" admin section). */
  canEditProducts: boolean;
  placeShelfGroupOnNode: (storeId: string, nodeId: string, groupId: string) => Promise<number>;
  removeShelfGroupFromNode: (storeId: string, nodeId: string, groupId: string) => Promise<void>;
  moveProductsToNode: (storeId: string, productIds: string[], nodeId: string) => Promise<void>;
  removeProductsFromNode: (storeId: string, nodeId: string, productIds: string[]) => Promise<void>;
  markProductsNotSold: (storeId: string, productIds: string[]) => Promise<void>;
  setProductsShelfGroup: (productIds: string[], groupId: string) => Promise<void>;
}

const singleLine = (label: string) => label.replace(/\s*\n\s*/g, " ");

/**
 * The shelf-group half of a department node's panel: place a whole group of imported
 * products here at once, see which groups stand here, and open a group to handle its
 * exceptions item by item - move some to another node, take them off, mark them as not
 * sold at this store, or fix their group.
 */
export function ShelfGroupPanel(props: ShelfGroupPanelProps) {
  const { storeId, nodeId, groupsHere, groupOptions, hasPriceBranch } = props;
  const [groupToPlace, setGroupToPlace] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const optionsByDepartment = new Map<string, ShelfGroupOption[]>();
  for (const option of groupOptions) {
    optionsByDepartment.set(option.department, [...(optionsByDepartment.get(option.department) ?? []), option]);
  }

  function place() {
    if (!groupToPlace) return;
    startTransition(async () => {
      const placed = await props.placeShelfGroupOnNode(storeId, nodeId, groupToPlace);
      setMessage(`שויכו ${placed} פריטים`);
      setGroupToPlace("");
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-neutral-100 pt-3">
      <h3 className="text-sm font-semibold text-neutral-700">קבוצות מדף בנקודה זו ({groupsHere.length})</h3>
      {groupsHere.length === 0 ? (
        <p className="text-xs text-neutral-400">אין עדיין קבוצות מדף בנקודה</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-100">
          {groupsHere.map((group) => (
            <GroupRow key={group.groupId} group={group} {...props} />
          ))}
        </ul>
      )}

      {hasPriceBranch ? (
        <div className="flex flex-col gap-1">
          <div className="flex gap-2">
            <select
              value={groupToPlace}
              onChange={(e) => setGroupToPlace(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-neutral-300 p-1.5 text-sm"
            >
              <option value="">בחרו קבוצת מדף לשיוך...</option>
              {[...optionsByDepartment.entries()].map(([department, options]) => (
                <optgroup key={department} label={department}>
                  {options.map((option) => (
                    <option key={option.groupId} value={option.groupId}>
                      {option.name} ({option.unplaced} לא משויכים)
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              type="button"
              onClick={place}
              disabled={!groupToPlace || isPending}
              className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {isPending ? "משייך..." : "שייך"}
            </button>
          </div>
          {message && <p className="text-xs text-emerald-700">{message}</p>}
          {groupOptions.length === 0 && <p className="text-xs text-neutral-400">כל קבוצות המדף של הסניף כבר שויכו</p>}
        </div>
      ) : (
        <p className="text-xs text-neutral-400">
          שיוך לפי קבוצות מדף זמין לסניף שמקושר לקובץ מחירים (בפרטי הסניף).
        </p>
      )}
    </div>
  );
}

function GroupRow({ group, ...props }: ShelfGroupPanelProps & { group: NodeShelfGroup }) {
  const { storeId, nodeId } = props;
  const [items, setItems] = useState<Array<{ id: string; canonicalName: string }> | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveTo, setMoveTo] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [isPending, startTransition] = useTransition();

  async function load() {
    const response = await fetch(
      `/admin/stores/${storeId}/catalog?node=${encodeURIComponent(nodeId)}&group=${encodeURIComponent(group.groupId)}`,
    );
    if (response.ok) setItems(await response.json());
    setSelected(new Set());
  }

  function toggleOpen() {
    if (!open && items === null) void load();
    setOpen(!open);
  }

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      await load();
    });
  }

  const selectedIds = [...selected];
  const otherNodes = props.departmentNodes.filter((n) => n.id !== nodeId);

  return (
    <li className="flex flex-col gap-1 py-1.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={toggleOpen} className="flex items-center gap-1 text-start hover:text-cyan-700">
          <span className="text-xs text-neutral-400">{open ? "▾" : "▸"}</span>
          {group.name}
          <span className="text-xs text-neutral-400">({group.count})</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`להסיר את כל ${group.count} הפריטים של "${group.name}" מהנקודה?`)) {
              startTransition(() => props.removeShelfGroupFromNode(storeId, nodeId, group.groupId));
            }
          }}
          className="text-xs text-red-600 hover:underline"
        >
          הסר קבוצה
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-2 rounded-lg bg-neutral-50 p-2">
          {items === null ? (
            <p className="text-xs text-neutral-400">טוען...</p>
          ) : items.length === 0 ? (
            <p className="text-xs text-neutral-400">אין פריטים</p>
          ) : (
            <>
              <label className="flex items-center gap-2 text-xs text-neutral-500">
                <input
                  type="checkbox"
                  checked={selected.size === items.length}
                  onChange={(e) => setSelected(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())}
                />
                סמן הכל
              </label>
              <ul className="flex max-h-64 flex-col overflow-y-auto">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 py-0.5">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(item.id);
                          else next.delete(item.id);
                          setSelected(next);
                        }}
                      />
                      {item.canonicalName}
                    </label>
                    {props.canEditProducts && (
                      <a
                        href={`/admin/products?kind=imported&q=${encodeURIComponent(item.canonicalName)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-xs text-cyan-700 hover:underline"
                      >
                        ערוך
                      </a>
                    )}
                  </li>
                ))}
              </ul>

              {selected.size > 0 && (
                <div className="flex flex-col gap-1.5 border-t border-neutral-200 pt-2">
                  <span className="text-xs font-semibold text-neutral-600">{selected.size} נבחרו</span>
                  <div className="flex gap-2">
                    <select
                      value={moveTo}
                      onChange={(e) => setMoveTo(e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-neutral-300 p-1 text-xs"
                    >
                      <option value="">העבר לנקודה...</option>
                      {otherNodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {singleLine(n.label)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!moveTo || isPending}
                      onClick={() => run(() => props.moveProductsToNode(storeId, selectedIds, moveTo))}
                      className="rounded-lg border border-cyan-600 px-2 py-1 text-xs font-semibold text-cyan-700 disabled:opacity-40"
                    >
                      העבר
                    </button>
                  </div>
                  {props.canEditProducts && (
                    <div className="flex gap-2">
                      <select
                        value={newGroup}
                        onChange={(e) => setNewGroup(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-neutral-300 p-1 text-xs"
                      >
                        <option value="">שנה קבוצת מדף ל...</option>
                        {SHELF_GROUPS.filter((g) => g.id !== group.groupId).map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.department} · {g.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!newGroup || isPending}
                        onClick={() => run(() => props.setProductsShelfGroup(selectedIds, newGroup))}
                        className="rounded-lg border border-cyan-600 px-2 py-1 text-xs font-semibold text-cyan-700 disabled:opacity-40"
                      >
                        שנה
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => run(() => props.removeProductsFromNode(storeId, nodeId, selectedIds))}
                      className="text-xs text-red-600 hover:underline disabled:opacity-40"
                      title="הפריט נמכר בסניף אבל לא כאן - נשאר ממתין לשיוך לנקודה אחרת"
                    >
                      הסר מהנקודה
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        if (confirm(`לסמן ${selectedIds.length} פריטים כלא נמכרים בסניף הזה? הם יוסרו מהמפה ולא יחזרו בשיוך קבוצה.`)) {
                          run(() => props.markProductsNotSold(storeId, selectedIds));
                        }
                      }}
                      className="text-xs text-red-600 hover:underline disabled:opacity-40"
                      title="אין את הפריט על המדף בסניף - לא ייספר כממתין לשיוך"
                    >
                      לא נמכר בסניף
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}
