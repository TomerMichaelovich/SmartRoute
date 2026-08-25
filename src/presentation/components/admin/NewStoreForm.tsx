"use client";

import { useState } from "react";

const NEW_CHAIN_VALUE = "__new__";

interface NewStoreFormProps {
  existingChainIds: string[];
  createStore: (formData: FormData) => Promise<void>;
}

export function NewStoreForm({ existingChainIds, createStore }: NewStoreFormProps) {
  const [chainSelectValue, setChainSelectValue] = useState(
    existingChainIds.length > 0 ? existingChainIds[0] : NEW_CHAIN_VALUE,
  );
  const [newChainId, setNewChainId] = useState("");
  const isNewChain = chainSelectValue === NEW_CHAIN_VALUE;

  return (
    <form
      action={createStore}
      className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4"
    >
      <h2 className="text-base font-semibold text-neutral-900">סניף חדש</h2>
      <input
        name="name"
        placeholder="שם הסניף"
        required
        className="rounded-lg border border-neutral-300 p-2"
      />

      <label className="flex flex-col gap-1 text-sm text-neutral-600">
        רשת
        <select
          value={chainSelectValue}
          onChange={(e) => setChainSelectValue(e.target.value)}
          className="rounded-lg border border-neutral-300 p-2"
        >
          {existingChainIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
          <option value={NEW_CHAIN_VALUE}>+ רשת חדשה</option>
        </select>
      </label>

      {isNewChain ? (
        <input
          name="chainId"
          value={newChainId}
          onChange={(e) => setNewChainId(e.target.value)}
          placeholder="מזהה רשת חדש (chainId)"
          required
          className="rounded-lg border border-neutral-300 p-2"
        />
      ) : (
        <input type="hidden" name="chainId" value={chainSelectValue} />
      )}

      <input
        name="address"
        placeholder="כתובת"
        className="rounded-lg border border-neutral-300 p-2"
      />
      <input name="city" placeholder="עיר" className="rounded-lg border border-neutral-300 p-2" />
      <div className="flex gap-2">
        <input
          name="mapWidth"
          type="number"
          defaultValue={1000}
          className="w-1/2 rounded-lg border border-neutral-300 p-2"
        />
        <input
          name="mapHeight"
          type="number"
          defaultValue={1000}
          className="w-1/2 rounded-lg border border-neutral-300 p-2"
        />
      </div>
      <button
        type="submit"
        className="self-start rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white"
      >
        צור סניף
      </button>
    </form>
  );
}
