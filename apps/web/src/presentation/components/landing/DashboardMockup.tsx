// Illustration of the retailer analytics dashboard. The tiles mirror the real
// admin KPIs; the numbers are placeholders and the card says so.

const TILES = [
  { label: "מסלולים שהושלמו", value: "87%" },
  { label: "משך קנייה ממוצע", value: "14 דק׳" },
  { label: "פריטים שלא נמצאו", value: "2.4%" },
  { label: "שביעות רצון", value: "4.6/5" },
];

const BARS = [38, 52, 45, 61, 58, 72, 66, 80, 74, 88, 82, 94];

export function DashboardMockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-brand/20 blur-3xl" aria-hidden />
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl shadow-black/40">
        <div className="flex items-center gap-1.5 border-b border-neutral-100 bg-neutral-50 px-4 py-2.5" dir="ltr">
          <span className="size-2.5 rounded-full bg-red-300" />
          <span className="size-2.5 rounded-full bg-amber-300" />
          <span className="size-2.5 rounded-full bg-emerald-300" />
          <span className="ms-3 rounded-md bg-white px-3 py-0.5 text-[10px] text-neutral-400">navio.co.il/admin</span>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-500">לוח בקרה</p>
              <p className="font-bold text-navy-900">סניף לדוגמה · 30 ימים אחרונים</p>
            </div>
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-medium text-neutral-500">נתוני המחשה</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {TILES.map((tile) => (
              <div key={tile.label} className="rounded-xl border border-neutral-100 bg-slate-50 p-3">
                <p className="text-[11px] text-neutral-500">{tile.label}</p>
                <p className="mt-1 text-xl font-extrabold text-navy-900">{tile.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-neutral-100 p-3">
            <p className="mb-3 text-[11px] font-medium text-neutral-500">מסלולים יומיים</p>
            <div className="flex h-24 items-end gap-1.5" dir="ltr">
              {BARS.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-gradient-to-t from-navy-700 to-brand"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
