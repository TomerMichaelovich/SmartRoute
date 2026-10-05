import { Icon } from "./icons";

// Illustration of the in-store route screen: a simplified store floor plan,
// the walked part of the route solid, and the next segment dashed (the app
// reveals the route one segment at a time).

const SHELVES = [
  { x: 24, y: 62, w: 40, h: 160 },
  { x: 96, y: 62, w: 30, h: 160 },
  { x: 156, y: 62, w: 40, h: 160 },
];

interface Stop {
  x: number;
  y: number;
  emoji: string;
  state: "done" | "next" | "later";
}

const STOPS: Stop[] = [
  { x: 212, y: 150, emoji: "🥕", state: "done" },
  { x: 141, y: 110, emoji: "🥖", state: "done" },
  { x: 80, y: 170, emoji: "🥛", state: "next" },
  { x: 80, y: 74, emoji: "🥩", state: "later" },
  { x: 180, y: 250, emoji: "🍿", state: "later" },
];

const ITEMS = [
  { name: "חלב 3%", done: true },
  { name: "גבינה לבנה", done: false },
  { name: "יוגורט", done: false },
];

export function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[280px] sm:w-[300px]">
      <div className="absolute -inset-10 -z-10 rounded-full bg-brand/25 blur-3xl" aria-hidden />

      <div className="rounded-[2.6rem] border-[10px] border-navy-950 bg-navy-950 shadow-2xl shadow-black/40">
        <div className="overflow-hidden rounded-[2rem] bg-white">
          <div className="flex items-center justify-between px-5 pt-3 text-[10px] font-semibold text-navy-900">
            <span>9:41</span>
            <span className="h-4 w-16 rounded-full bg-navy-950" aria-hidden />
            <span>5G</span>
          </div>

          <div className="px-4 pb-2 pt-3">
            <p className="text-[11px] font-medium text-neutral-500">המסלול שלכם</p>
            <div className="flex items-baseline justify-between">
              <p className="text-base font-bold text-navy-900">תחנה 3 מתוך 5</p>
              <p className="text-[11px] text-brand-dark">2 תחנות הושלמו</p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full w-2/5 rounded-full bg-gradient-to-l from-brand to-navy-700" />
            </div>
          </div>

          <svg viewBox="0 0 240 300" className="block w-full bg-slate-50" role="img" aria-label="מפת סניף עם מסלול קנייה">
            <rect x="8" y="16" width="224" height="278" rx="10" fill="#fff" stroke="#e2e8f0" strokeWidth="2" />
            {SHELVES.map((s) => (
              <rect key={s.x} x={s.x} y={s.y} width={s.w} height={s.h} rx="5" fill="#e8eef6" />
            ))}
            <rect x="20" y="266" width="40" height="18" rx="4" fill="#dbe4f0" />
            <text x="40" y="278" textAnchor="middle" fontSize="8" fill="#64748b">קופות</text>
            <text x="212" y="292" textAnchor="middle" fontSize="8" fill="#64748b">כניסה</text>

            {/* walked */}
            <path
              d="M212 282 V40 H141 V110"
              fill="none"
              stroke="#0b2f6b"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* next segment */}
            <path
              d="M141 110 V250 H80 V170"
              fill="none"
              stroke="#18b4c6"
              strokeWidth="5"
              strokeDasharray="2 9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {STOPS.map((stop) => (
              <g key={stop.emoji} opacity={stop.state === "later" ? 0.4 : 1}>
                {stop.state === "next" && (
                  <circle cx={stop.x} cy={stop.y} r="18" fill="#18b4c6" opacity="0.25">
                    <animate attributeName="r" values="14;22;14" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                )}
                <rect
                  x={stop.x - 12}
                  y={stop.y - 12}
                  width="24"
                  height="24"
                  rx="6"
                  fill="#fff"
                  stroke={stop.state === "next" ? "#18b4c6" : "#0b2f6b"}
                  strokeWidth="2"
                />
                <text x={stop.x} y={stop.y + 4.5} textAnchor="middle" fontSize="13">
                  {stop.emoji}
                </text>
                {stop.state === "done" && (
                  <g>
                    <circle cx={stop.x + 11} cy={stop.y - 11} r="6" fill="#0b2f6b" />
                    <path
                      d={`M${stop.x + 8.5} ${stop.y - 11} l1.8 1.8 3.2-3.4`}
                      fill="none"
                      stroke="#fff"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                )}
              </g>
            ))}
          </svg>

          <div className="space-y-2 px-4 pb-5 pt-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-navy-900">הבאה בתור: מוצרי חלב</p>
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand-dark">3 פריטים</span>
            </div>
            <ul className="space-y-1.5">
              {ITEMS.map((item) => (
                <li key={item.name} className="flex items-center gap-2 text-xs">
                  <span
                    className={`flex size-4 items-center justify-center rounded ${
                      item.done ? "bg-navy-800 text-white" : "border border-neutral-300"
                    }`}
                  >
                    {item.done && <Icon name="check" className="size-3" />}
                  </span>
                  <span className={item.done ? "text-neutral-400 line-through" : "text-neutral-700"}>{item.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="absolute -start-40 top-[38%] hidden w-44 rounded-2xl bg-white p-3 shadow-xl shadow-navy-950/20 sm:block">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
            <Icon name="tag" className="size-4" />
          </span>
          <div>
            <p className="text-[11px] font-bold text-navy-900">מבצע בדרך</p>
            <p className="text-[10px] text-neutral-500">במחלקת החלב</p>
          </div>
        </div>
        <div className="mt-2 rounded-lg bg-navy-900 py-1 text-center text-[11px] font-semibold text-white">לקחתי</div>
      </div>

      <div className="absolute -end-32 bottom-36 hidden items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-xl shadow-navy-950/20 sm:flex">
        <span className="flex size-8 items-center justify-center rounded-full bg-brand/15 text-brand-dark">
          <Icon name="users" className="size-4" />
        </span>
        <div>
          <p className="text-[11px] font-bold text-navy-900">דנה הוסיפה פריט</p>
          <p className="text-[10px] text-neutral-500">יוגורט · עכשיו</p>
        </div>
      </div>
    </div>
  );
}
