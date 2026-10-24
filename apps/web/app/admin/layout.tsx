import Link from "next/link";
import type { ReactNode } from "react";
import { hasSection, type AdminPrincipal, type AdminSection } from "@smartroute/core/domain/entities/admin-user";
import { logout } from "@/src/presentation/actions/admin-auth-actions";
import { getAdminPrincipal } from "@/src/presentation/auth/admin";

const NAV: { href: string; label: string; section: AdminSection }[] = [
  { href: "/admin/products", label: "מוצרים", section: "products" },
  { href: "/admin/promotions", label: "מבצעים", section: "promotions" },
  { href: "/admin/users", label: "משתמשים", section: "customers" },
  { href: "/admin/analytics", label: "אנליטיקס", section: "analytics" },
  { href: "/admin/staff", label: "משתמשי ניהול", section: "staff" },
];

const showsStores = (p: AdminPrincipal) => hasSection(p, "stores") || (p.kind === "user" && p.permissions.storeIds.length > 0);

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Null on the login page: nothing to navigate to yet.
  const principal = await getAdminPrincipal();

  return (
    <div className="flex flex-1 flex-col bg-neutral-100 text-sm">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-2 px-5 py-3">
          <Link href="/admin" className="font-bold text-neutral-900">
            NAVIO · ניהול
          </Link>
          {principal && (
            <nav className="flex flex-wrap items-center gap-4 text-xs font-medium text-neutral-600">
              {showsStores(principal) && (
                <Link href="/admin/stores" className="hover:text-cyan-700">
                  סניפים
                </Link>
              )}
              {NAV.filter((item) => hasSection(principal, item.section)).map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-cyan-700">
                  {item.label}
                </Link>
              ))}
              {principal.kind === "user" && <span className="text-neutral-400">{principal.displayName}</span>}
              <form action={logout}>
                <button type="submit" className="hover:text-red-600">
                  יציאה
                </button>
              </form>
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-6">
        {children}
      </main>
    </div>
  );
}
