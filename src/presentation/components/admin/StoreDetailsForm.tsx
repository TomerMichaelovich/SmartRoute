"use client";

import { useEffect, useState } from "react";
import type { Store } from "@/src/domain/entities/store";

interface StoreDetailsFormProps {
  store: Store;
  updateStore: (formData: FormData) => Promise<void>;
}

const TOAST_DURATION_MS = 2500;

export function StoreDetailsForm({ store, updateStore }: StoreDetailsFormProps) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  async function handleSubmit(formData: FormData) {
    await updateStore(formData);
    setSaved(true);
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-base font-semibold text-neutral-900">פרטי הסניף</h2>
      <input name="name" defaultValue={store.name} className="rounded-lg border border-neutral-300 p-2" />
      <input name="address" defaultValue={store.address} className="rounded-lg border border-neutral-300 p-2" />
      <input name="city" defaultValue={store.city} className="rounded-lg border border-neutral-300 p-2" />
      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="checkbox" name="isActive" defaultChecked={store.isActive} />
        סניף פעיל
      </label>
      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="checkbox" name="promotionsEnabled" defaultChecked={store.promotionsEnabled} />
        הצגת מבצעים במסלול
      </label>
      <button type="submit" className="self-start rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white">
        שמור
      </button>

      {saved && (
        <div
          role="status"
          className="fixed bottom-6 start-1/2 z-50 -translate-x-1/2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-lg"
        >
          ✓ הכל נשמר
        </div>
      )}
    </form>
  );
}
