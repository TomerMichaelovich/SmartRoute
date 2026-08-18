import { he } from "@/src/presentation/i18n/he";

interface ChecklistItemProps {
  id: string;
  displayName: string;
  imageUrl?: string;
  checked: boolean;
  notFound: boolean;
  onToggle: (id: string) => void;
  onNotFound: (id: string) => void;
}

export function ChecklistItem({
  id,
  displayName,
  imageUrl,
  checked,
  notFound,
  onToggle,
  onNotFound,
}: ChecklistItemProps) {
  return (
    <div className="flex items-center gap-3 py-2" onClick={(e) => e.stopPropagation()}>
      <label className="flex flex-1 items-center gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(id)}
          className="h-5 w-5 shrink-0 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
        />
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- Blob-hosted upload of unknown/variable size, not worth next/image's optimization setup
          <img
            src={imageUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-lg border border-neutral-200 object-cover"
          />
        )}
        <span
          className={`text-base ${checked ? "text-neutral-400 line-through" : "text-neutral-900"}`}
        >
          {displayName}
        </span>
      </label>
      <button
        type="button"
        onClick={() => onNotFound(id)}
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
          notFound ? "bg-amber-100 text-amber-800" : "text-neutral-400"
        }`}
      >
        {notFound ? he.route.notFoundMarked : he.route.notFoundButton}
      </button>
    </div>
  );
}
