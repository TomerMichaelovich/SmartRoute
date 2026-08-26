import { LinkButton } from "@/src/presentation/components/ui/LinkButton";
import { he } from "@/src/presentation/i18n/he";

export default function MyListNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <h1 className="text-2xl font-bold text-neutral-900">{he.myList.notFound.title}</h1>
      <p className="text-neutral-600">{he.myList.notFound.subtitle}</p>
      <LinkButton href="/" className="max-w-xs">
        {he.myList.notFound.backHome}
      </LinkButton>
    </main>
  );
}
