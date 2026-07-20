import type { ReactNode } from "react";

export function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm">
      <span className="text-2xl font-bold text-emerald-700">{value}</span>
      <span className="text-sm text-neutral-500">{label}</span>
    </div>
  );
}
