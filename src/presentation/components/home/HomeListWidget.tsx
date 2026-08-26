"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { normalizeShareCode } from "@/src/application/shopping-list/generate-share-code";
import type { ShoppingList } from "@/src/domain/entities/shopping-list";
import type { Store } from "@/src/domain/entities/store";
import { Button } from "@/src/presentation/components/ui/Button";
import { he } from "@/src/presentation/i18n/he";
import { clearMyListCode, getMyListCode } from "@/src/presentation/lib/my-list-storage";

export function HomeListWidget() {
  const router = useRouter();
  const [myList, setMyList] = useState<{ list: ShoppingList; store: Store | null } | null>(null);
  const [checked, setChecked] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [codeInput, setCodeInput] = useState("");

  useEffect(() => {
    async function loadMyList() {
      const code = getMyListCode();
      if (code) {
        try {
          const res = await fetch(`/api/lists/${code}`);
          if (res.ok) {
            const data: { list: ShoppingList; store: Store | null } = await res.json();
            setMyList(data);
          } else {
            clearMyListCode();
          }
        } catch {
          // Best-effort - the widget just won't show if this fails.
        }
      }
      setChecked(true);
    }
    loadMyList();
  }, []);

  function handleOpenByCode() {
    const normalized = normalizeShareCode(codeInput);
    if (!normalized) return;
    router.push(`/my-list/${normalized}`);
  }

  // Avoid a layout flash while the localStorage/fetch check is in flight.
  if (!checked) return null;

  if (myList) {
    return (
      <Link
        href={`/my-list/${myList.list.shareCode}`}
        className="flex w-full max-w-xs flex-col gap-1 rounded-2xl bg-white p-4 text-right shadow-sm"
      >
        <span className="text-sm font-medium text-cyan-700">{he.myList.widgetTitle}</span>
        {myList.store && <span className="text-neutral-900">{myList.store.name}</span>}
        <span className="text-sm text-neutral-500">
          {he.myList.itemCount(myList.list.items.length)}
        </span>
      </Link>
    );
  }

  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-2">
      {!showCodeInput ? (
        <button
          type="button"
          onClick={() => setShowCodeInput(true)}
          className="text-sm text-neutral-500 underline"
        >
          {he.myList.haveCode}
        </button>
      ) : (
        <div className="flex w-full gap-2">
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder={he.myList.codePlaceholder}
            dir="ltr"
            className="flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-center text-sm focus:border-cyan-500 focus:outline-none"
          />
          <Button onClick={handleOpenByCode} disabled={!codeInput.trim()}>
            {he.myList.openByCode}
          </Button>
        </div>
      )}
    </div>
  );
}
