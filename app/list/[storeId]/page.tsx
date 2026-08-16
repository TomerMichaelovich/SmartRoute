import Link from "next/link";
import { notFound } from "next/navigation";
import { storeRepository } from "@/src/infrastructure/container";
import { he } from "@/src/presentation/i18n/he";

function ManualIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-9 w-9">
      <path d="M8 6h11M8 12h11M8 18h11" strokeLinecap="round" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" strokeLinecap="round" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-9 w-9">
      <path
        d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h7l1 1.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export default async function ChooseListMethodPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const store = await storeRepository.findById(storeId);
  if (!store) notFound();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-neutral-900">{he.list.chooseMethod.title}</h1>
        <p className="text-neutral-600">{he.list.chooseMethod.subtitle}</p>
        <p className="text-sm font-medium text-emerald-700">{store.name}</p>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <Link
          href={`/list/${storeId}/manual`}
          className="flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-center shadow-sm transition-colors active:bg-emerald-50"
        >
          <span className="text-emerald-600">
            <ManualIcon />
          </span>
          <span className="text-base font-semibold text-neutral-900">
            {he.list.chooseMethod.manualTitle}
          </span>
          <span className="text-xs text-neutral-500">{he.list.chooseMethod.manualDescription}</span>
        </Link>

        <Link
          href={`/list/${storeId}/photo`}
          className="flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-center shadow-sm transition-colors active:bg-emerald-50"
        >
          <span className="text-emerald-600">
            <PhotoIcon />
          </span>
          <span className="text-base font-semibold text-neutral-900">
            {he.list.chooseMethod.photoTitle}
          </span>
          <span className="text-xs text-neutral-500">{he.list.chooseMethod.photoDescription}</span>
        </Link>
      </div>
    </main>
  );
}
