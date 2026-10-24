import Link from "next/link";
import { hasSection, type AdminSection } from "@smartroute/core/domain/entities/admin-user";
import { productRepository, promotionRepository, storeRepository } from "@/src/infrastructure/container";
import { requireAdminPage } from "@/src/presentation/auth/admin";
import { StatTile } from "@/src/presentation/components/summary/StatTile";

const LINKS: { href: string; label: string; section: AdminSection }[] = [
  { href: "/admin/stores", label: "ניהול סניפים", section: "stores" },
  { href: "/admin/products", label: "ניהול מוצרים וכינויים", section: "products" },
  { href: "/admin/promotions", label: "ניהול מבצעים", section: "promotions" },
  { href: "/admin/users", label: "משתמשים והיסטוריית קנייה", section: "customers" },
  { href: "/admin/analytics", label: "אנליטיקס", section: "analytics" },
  { href: "/admin/staff", label: "משתמשי ניהול והרשאות", section: "staff" },
];

const linkClass =
  "rounded-xl border border-neutral-200 bg-white p-4 font-medium text-neutral-900 hover:border-cyan-400";

export default async function AdminDashboardPage() {
  const principal = await requireAdminPage();
  const [stores, products, promotions] = await Promise.all([
    storeRepository.findAll(),
    productRepository.findAll(),
    promotionRepository.findAll(),
  ]);
  const links = LINKS.filter((l) => hasSection(principal, l.section));
  // Mapping-only access: the stores given to this login, straight to their map.
  const mappedStores =
    principal.kind === "user" && !hasSection(principal, "stores")
      ? stores.filter((s) => principal.permissions.storeIds.includes(s.id))
      : [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-neutral-900">
        {principal.kind === "user" ? `שלום ${principal.displayName}` : "לוח בקרה"}
      </h1>

      {hasSection(principal, "stores") && (
        <div className="flex flex-wrap gap-3">
          <div className="w-32">
            <StatTile label="סניפים" value={stores.length} />
          </div>
          <div className="w-32">
            <StatTile label="מוצרים" value={products.length} />
          </div>
          <div className="w-32">
            <StatTile label="מבצעים" value={promotions.length} />
          </div>
        </div>
      )}

      {mappedStores.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-neutral-900">הסניפים שלך למיפוי</h2>
          {mappedStores.map((store) => (
            <Link key={store.id} href={`/admin/stores/${store.id}`} className={linkClass}>
              {store.name}
              <div className="text-sm font-normal text-neutral-500">{store.address}</div>
            </Link>
          ))}
        </section>
      )}

      {links.length > 0 && (
        <nav className="flex flex-col gap-2">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass}>
              {l.label}
            </Link>
          ))}
        </nav>
      )}

      {links.length === 0 && mappedStores.length === 0 && (
        <p className="text-neutral-500">עדיין לא הוגדרו לך הרשאות. פנו למנהל המערכת.</p>
      )}
    </div>
  );
}
