"use client";

interface DeleteStoreButtonProps {
  storeName: string;
  deleteStore: () => Promise<void>;
  className?: string;
}

export function DeleteStoreButton({ storeName, deleteStore, className = "" }: DeleteStoreButtonProps) {
  return (
    <form
      action={deleteStore}
      onSubmit={(e) => {
        if (!confirm(`למחוק לצמיתות את הסניף "${storeName}"? כל הצמתים, הקשתות והמבצעים שלו יימחקו גם הם.`)) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className={`text-red-600 hover:underline ${className}`}>
        מחק סניף
      </button>
    </form>
  );
}
