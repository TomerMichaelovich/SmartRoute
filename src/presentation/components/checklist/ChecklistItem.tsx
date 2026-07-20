interface ChecklistItemProps {
  id: string;
  displayName: string;
  checked: boolean;
  onToggle: (id: string) => void;
}

export function ChecklistItem({ id, displayName, checked, onToggle }: ChecklistItemProps) {
  return (
    <label className="flex items-center gap-3 py-2" onClick={(e) => e.stopPropagation()}>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(id)}
        className="h-5 w-5 shrink-0 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
      />
      <span
        className={`text-base ${checked ? "text-neutral-400 line-through" : "text-neutral-900"}`}
      >
        {displayName}
      </span>
    </label>
  );
}
