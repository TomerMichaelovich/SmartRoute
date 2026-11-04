import Link from "next/link";
import { branchLocationRepository } from "@/src/infrastructure/container";
import { cityName } from "@/src/infrastructure/prices/settlements";
import type { BranchLocationView } from "@/src/infrastructure/repositories/interfaces/branch-location-repository";
import { resetBranchLocation, setBranchLocation } from "@/src/presentation/actions/admin-branch-location-actions";
import { requireAdminPage } from "@/src/presentation/auth/admin";

const STATUS: Record<string, { label: string; className: string }> = {
  ok: { label: "אותר אוטומטית", className: "bg-cyan-50 text-cyan-700" },
  manual: { label: "הוזן ידנית", className: "bg-amber-50 text-amber-700" },
  not_found: { label: "לא נמצא", className: "bg-red-50 text-red-700" },
  pending: { label: "ממתין לאיתור", className: "bg-neutral-100 text-neutral-600" },
};

function BranchRow({ branch, invalid }: { branch: BranchLocationView; invalid: boolean }) {
  const city = branch.cityCode === null ? "" : (cityName(branch.cityCode) ?? "");
  const status = STATUS[branch.geocodeStatus] ?? STATUS.pending;
  const search = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${branch.chainName} ${branch.address ?? branch.name} ${city}`,
  )}`;
  const placed = branch.lat !== null && branch.lng !== null;
  return (
    <div id={`branch-${branch.id}`} className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-neutral-900">
            {branch.chainName} · {branch.name}
          </div>
          <div className="text-xs text-neutral-500">
            {branch.address ?? "אין כתובת בקובץ הרשת"}
            {city ? ` · ${city}` : ""}
          </div>
        </div>
        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${status.className}`}>{status.label}</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {placed ? (
          <a
            href={`https://www.google.com/maps?q=${branch.lat},${branch.lng}`}
            target="_blank"
            rel="noreferrer"
            className="text-cyan-700 hover:underline"
          >
            {branch.lat!.toFixed(5)}, {branch.lng!.toFixed(5)} – בדיקה במפה ↗
          </a>
        ) : (
          <span className="text-neutral-500">אין מיקום – המרחק לא יוצג ללקוח</span>
        )}
        <a href={search} target="_blank" rel="noreferrer" className="text-cyan-700 hover:underline">
          חיפוש ב-Google Maps ↗
        </a>
      </div>
      <form action={setBranchLocation.bind(null, branch.id)} className="flex gap-2">
        <input
          name="coordinates"
          placeholder="הדביקו קואורדינטות, למשל 31.2341, 34.7996"
          dir="ltr"
          className="flex-1 rounded-lg border border-neutral-300 p-2 text-sm"
        />
        <button type="submit" className="rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-700">
          שמור
        </button>
      </form>
      {invalid && <p className="text-xs text-red-600">לא הצלחנו לקרוא את הקואורדינטות – הדביקו בפורמט 31.2341, 34.7996.</p>}
      {branch.geocodeStatus === "manual" && (
        <form action={resetBranchLocation.bind(null, branch.id)}>
          <button type="submit" className="text-xs text-neutral-600 hover:underline">
            החזר לאיתור אוטומטי
          </button>
        </form>
      )}
    </div>
  );
}

export default async function PriceBranchesPage({ searchParams }: { searchParams: Promise<{ invalid?: string }> }) {
  await requireAdminPage("stores");
  const invalidId = Number((await searchParams).invalid);
  const branches = await branchLocationRepository.findQuotedBranches();
  const unplaced = branches.filter((b) => b.lat === null || b.lng === null).length;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/stores" className="text-xs text-cyan-700 hover:underline">
        ← סניפים
      </Link>
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">מיקום סניפי מחירים</h1>
        <p className="mt-1 text-xs text-neutral-500">
          הסניפים שמשתתפים ב&quot;הסל הזול ביותר&quot;. המיקום משמש להצגת המרחק מהלקוח. סניפים מאותרים אוטומטית כל
          לילה לפי הכתובת; לסניף שלא נמצא או שמיקומו שגוי – מצאו אותו ב-Google Maps, לחצו עליו במפה, העתיקו את
          הקואורדינטות והדביקו כאן. מיקום שהוזן ידנית לא יידרס.
        </p>
        {unplaced > 0 && <p className="mt-2 text-xs font-medium text-red-700">{unplaced} סניפים בלי מיקום.</p>}
      </div>
      {branches.map((branch) => (
        <BranchRow key={branch.id} branch={branch} invalid={branch.id === invalidId} />
      ))}
    </div>
  );
}
