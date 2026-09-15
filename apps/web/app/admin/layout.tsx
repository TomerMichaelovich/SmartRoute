import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/src/presentation/actions/admin-auth-actions";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-neutral-100 text-sm">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-3">
          <Link href="/admin" className="font-bold text-neutral-900">
            NAVIO · ניהול
          </Link>
          <nav className="flex items-center gap-4 text-xs font-medium text-neutral-600">
            <Link href="/admin/stores" className="hover:text-cyan-700">
              סניפים
            </Link>
            <Link href="/admin/products" className="hover:text-cyan-700">
              מוצרים
            </Link>
            <Link href="/admin/promotions" className="hover:text-cyan-700">
              מבצעים
            </Link>
            <Link href="/admin/analytics" className="hover:text-cyan-700">
              אנליטיקס
            </Link>
            <form action={logout}>
              <button type="submit" className="hover:text-red-600">
                יציאה
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-6">
        {children}
      </main>
    </div>
  );
}
