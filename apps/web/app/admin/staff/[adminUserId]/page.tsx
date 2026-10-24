import Link from "next/link";
import { notFound } from "next/navigation";
import { adminUserRepository, storeRepository } from "@/src/infrastructure/container";
import {
  deleteAdminUser,
  resetAdminUserPassword,
  updateAdminUser,
} from "@/src/presentation/actions/admin-staff-actions";
import { requireAdminPage } from "@/src/presentation/auth/admin";
import { AdminPermissionFields } from "@/src/presentation/components/admin/AdminPermissionFields";
import { DeleteAdminUserButton } from "@/src/presentation/components/admin/DeleteAdminUserButton";
import { ResetAdminPasswordButton } from "@/src/presentation/components/admin/ResetAdminPasswordButton";
import { formatDateTime } from "@/src/presentation/components/admin/user-display";

export default async function AdminStaffUserPage({ params }: { params: Promise<{ adminUserId: string }> }) {
  const principal = await requireAdminPage("staff");
  const { adminUserId } = await params;
  const [user, stores] = await Promise.all([adminUserRepository.findById(adminUserId), storeRepository.findAll()]);
  if (!user) notFound();
  const self = principal.kind === "user" && principal.id === user.id;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/staff" className="text-xs text-cyan-700 hover:underline">
        ← משתמשי ניהול
      </Link>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">{user.displayName}</h1>
          <div className="font-mono text-xs text-neutral-500" dir="ltr">
            {user.username}
          </div>
          <div className="mt-1 text-xs text-neutral-400">
            נוצר {formatDateTime(user.createdAt)}
            {user.lastLoginAt ? ` · כניסה אחרונה ${formatDateTime(user.lastLoginAt)}` : " · עוד לא נכנס"}
          </div>
        </div>
        {!self && (
          <DeleteAdminUserButton displayName={user.displayName} deleteAdminUser={deleteAdminUser.bind(null, user.id)} />
        )}
      </div>

      {/* key: after saving, the checkboxes re-render with what was stored. */}
      <form
        key={JSON.stringify([user.permissions, user.isActive, user.displayName])}
        action={updateAdminUser.bind(null, user.id)}
        className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4"
      >
        <h2 className="text-base font-semibold text-neutral-900">פרטים והרשאות</h2>
        <input name="displayName" defaultValue={user.displayName} className="rounded-lg border border-neutral-300 p-2" />
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" name="isActive" defaultChecked={user.isActive} disabled={self} />
          משתמש פעיל (משתמש מושבת לא יכול להיכנס)
        </label>
        <AdminPermissionFields
          stores={stores.map((s) => ({ id: s.id, name: s.name, address: s.address }))}
          defaultValue={user.permissions}
        />
        {self && <p className="text-xs text-neutral-500">זה המשתמש שלך: אי אפשר להשבית אותו או להסיר ממנו את ניהול המשתמשים.</p>}
        <button type="submit" className="self-start rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white">
          שמור
        </button>
      </form>

      <ResetAdminPasswordButton resetPassword={resetAdminUserPassword.bind(null, user.id)} />
    </div>
  );
}
