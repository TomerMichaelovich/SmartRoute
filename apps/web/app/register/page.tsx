import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/presentation/auth/dal";
import { RegisterForm } from "@/src/presentation/components/auth/RegisterForm";
import { he } from "@smartroute/core/i18n/he";

function safeNext(raw: string | undefined): string | undefined {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : undefined;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(safeNext(next) ?? "/");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-10">
      <header className="flex flex-col gap-1 text-center">
        <Link href="/" className="text-sm text-neutral-400">
          {he.common.appName}
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900">{he.auth.register.title}</h1>
        <p className="text-sm text-neutral-600">{he.auth.register.subtitle}</p>
      </header>
      <RegisterForm next={safeNext(next)} />
    </main>
  );
}
