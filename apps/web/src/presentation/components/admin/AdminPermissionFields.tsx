import { ADMIN_SECTIONS, type AdminPermissions } from "@smartroute/core/domain/entities/admin-user";
import { ADMIN_SECTION_LABELS } from "@/src/presentation/admin-section-labels";

interface AdminPermissionFieldsProps {
  stores: { id: string; name: string; address: string }[];
  defaultValue?: AdminPermissions;
}

/** The permission checkboxes, shared by the create and edit forms (fields: sections, storeIds). */
export function AdminPermissionFields({ stores, defaultValue }: AdminPermissionFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-neutral-900">גישה לאזורים בפאנל</legend>
        {ADMIN_SECTIONS.map((section) => (
          <label key={section} className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              name="sections"
              value={section}
              defaultChecked={defaultValue?.sections.includes(section)}
            />
            {ADMIN_SECTION_LABELS[section]}
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-neutral-900">מיפוי סניפים מסוימים בלבד</legend>
        <p className="text-xs text-neutral-500">
          גישה למפה של הסניף בלבד: תמונה, צמתים, שבילים, שטח הליכה ושיוך מוצרים. בלי פרטי הסניף ובלי מחיקה.
        </p>
        {stores.length === 0 && <p className="text-xs text-neutral-400">אין סניפים עדיין.</p>}
        {stores.map((store) => (
          <label key={store.id} className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              name="storeIds"
              value={store.id}
              defaultChecked={defaultValue?.storeIds.includes(store.id)}
            />
            {store.name}
            {store.address && <span className="text-xs text-neutral-400">{store.address}</span>}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
