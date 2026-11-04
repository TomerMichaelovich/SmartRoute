"use client";

import { useState } from "react";
import { findShelfGroup, SHELF_GROUPS } from "@smartroute/core/domain/value-objects/shelf-group";

const BY_DEPARTMENT = (() => {
  const map = new Map<string, Array<(typeof SHELF_GROUPS)[number]>>();
  for (const group of SHELF_GROUPS) map.set(group.department, [...(map.get(group.department) ?? []), group]);
  return [...map.entries()];
})();

/**
 * A <select> of all shelf groups under their departments. With `lazy`, it holds only the
 * current group until it's opened - a page with dozens of product forms would otherwise
 * render the 170 options into each of them.
 */
export function ShelfGroupSelect({
  name,
  defaultValue,
  emptyLabel,
  className,
  lazy = false,
}: {
  name: string;
  defaultValue?: string;
  /** Adds a first, empty option ("all groups"). */
  emptyLabel?: string;
  className?: string;
  lazy?: boolean;
}) {
  const [full, setFull] = useState(!lazy);
  const current = defaultValue ? findShelfGroup(defaultValue) : undefined;
  const expand = () => setFull(true);
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      className={className}
      onFocus={expand}
      onMouseDown={expand}
      onTouchStart={expand}
    >
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {!full && current && <option value={current.id}>{current.name}</option>}
      {full && BY_DEPARTMENT.map(([department, groups]) => (
        <optgroup key={department} label={department}>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
