import Link from "next/link";
import type { AdminPermissions } from "@smartroute/core/domain/entities/admin-user";
import { adminUserRepository, storeRepository } from "@/src/infrastructure/container";
import { createAdminUser } from "@/src/presentation/actions/admin-staff-actions";
import { ADMIN_SECTION_LABELS } from "@/src/presentation/admin-section-labels";
import { requireAdminPage } from "@/src/presentation/auth/admin";
import { NewAdminUserForm } from "@/src/presentation/components/admin/NewAdminUserForm";
import { formatDateTime } from "@/src/presentation/components/admin/user-display";

function summarize(permissions: AdminPermissions, storeNameById: Map<string, string>): string {
  const parts = permissions.sections.map((s) => ADMIN_SECTION_LABELS[s].replace(/ \(.*\)$/, ""));
  const mapped = permissions.storeIds.map((id) => storeNameById.get(id)).filter(Boolean);
  if (mapped.length > 0) parts.push(`מיפוי: ${mapped.join(", ")}`);
  return parts.join(" · ") || "ללא הרשאות";
}

export default async function AdminStaffPage() {
  await requireAdminPage("staff");
  const [users, stores] = await Promise.all([adminUserRepository.findAll(), storeRepository.findAll()]);
  const storeNameById = new Map(stores.map((s) => [s.id, s.name]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">משתמשי ניהול</h1>
        <p className="mt-1 text-xs text-neutral-500">
          מי יכול להיכנס לפאנל הניהול ולאילו חלקים. כניסת הבעלים (סיסמת המערכת) תמיד עם גישה מלאה.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {users.length === 0 && <p className="text-neutral-500">אין עדיין משתמשי ניהול.</p>}
        {users.map((user) => (
          <Link
            key={user.id}
            href={`/admin/staff/${user.id}`}
            className="flex flex-col gap-1 rounded-xl border border-neutral-200 bg-white p-4 hover:border-cyan-400"
          >
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-neutral-900">{user.displayName}</span>
              <span className="font-mono text-xs text-neutral-500" dir="ltr">
                {user.username}
              </span>
              {!user.isActive && <span className="text-xs text-red-500">(מושבת)</span>}
            </div>
            <div className="text-xs text-neutral-600">{summarize(user.permissions, storeNameById)}</div>
            <div className="text-xs text-neutral-400">
              {user.lastLoginAt ? `כניסה אחרונה: ${formatDateTime(user.lastLoginAt)}` : "עוד לא נכנס"}
            </div>
          </Link>
        ))}
      </div>

      <NewAdminUserForm
        stores={stores.map((s) => ({ id: s.id, name: s.name, address: s.address }))}
        createAdminUser={createAdminUser}
      />
    </div>
  );
}
