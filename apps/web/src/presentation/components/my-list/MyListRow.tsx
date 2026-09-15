"use client";

import { useState } from "react";
import Link from "next/link";
import type { ShoppingList } from "@smartroute/core/domain/entities/shopping-list";
import {
  deleteList,
  renameList,
  setActiveList,
} from "@/src/presentation/actions/list-actions";
import { he } from "@smartroute/core/i18n/he";

interface MyListRowProps {
  list: ShoppingList;
  storeName?: string;
}

export function MyListRow({ list, storeName }: MyListRowProps) {
  const [renaming, setRenaming] = useState(false);
  const title = list.name || he.myList.defaultName(storeName) || he.myList.untitled;

  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-neutral-900">{title}</span>
          <span className="text-xs text-neutral-500">
            {storeName ? `${storeName} · ` : ""}
            {he.myList.manage.itemCount(list.items.length)}
          </span>
        </div>
        {list.isActive && (
          <span className="shrink-0 rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-800">
            {he.myList.manage.active}
          </span>
        )}
      </div>

      {renaming ? (
        <form
          action={renameList}
          className="flex gap-2"
          onSubmit={() => setRenaming(false)}
        >
          <input type="hidden" name="listId" value={list.id} />
          <input
            name="name"
            defaultValue={list.name ?? ""}
            placeholder={he.myList.manage.renamePrompt}
            autoFocus
            className="flex-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm focus:border-cyan-500 focus:outline-none"
          />
          <button type="submit" className="text-sm font-medium text-cyan-700">
            {he.myList.editor.save}
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {list.shareCode && (
            <Link href={`/my-list/${list.shareCode}`} className="font-medium text-cyan-700">
              {he.myList.manage.open}
            </Link>
          )}
          {!list.isActive && (
            <form action={setActiveList}>
              <input type="hidden" name="listId" value={list.id} />
              <button type="submit" className="text-neutral-600">
                {he.myList.manage.makeActive}
              </button>
            </form>
          )}
          <button
            type="button"
            onClick={() => setRenaming(true)}
            className="text-neutral-600"
          >
            {he.myList.manage.rename}
          </button>
          <form
            action={deleteList}
            onSubmit={(e) => {
              if (!confirm(he.myList.manage.deleteConfirm)) e.preventDefault();
            }}
          >
            <input type="hidden" name="listId" value={list.id} />
            <button type="submit" className="text-red-600">
              {he.myList.manage.delete}
            </button>
          </form>
        </div>
      )}
    </li>
  );
}
