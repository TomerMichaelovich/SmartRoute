"use client";

import { Fragment, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { ShoppingList } from "@smartroute/core/domain/entities/shopping-list";

const API = "/api/dev/whatsapp";
const POLL_MS = 1500;

interface Phone {
  number: string;
  label: string;
}

const PHONES: Phone[] = [
  { number: "999000000001", label: "טלפון 1" },
  { number: "999000000002", label: "טלפון 2" },
];

interface MyList {
  shareCode: string;
  name: string;
  itemCount: number;
  shared: boolean;
}

interface Participant {
  userId: string;
  displayName: string;
}

interface OutgoingPayload {
  type?: string;
  text?: { body?: string };
  interactive?: {
    type?: string;
    body?: { text?: string };
    action?: {
      parameters?: { display_text?: string; url?: string };
      buttons?: Array<{ reply: { id: string; title: string } }>;
    };
  };
}

type ChatEntry =
  | { key: string; phone: string; from: "user"; text: string }
  | { key: string; phone: string; from: "bot"; payload: OutgoingPayload };

async function post(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : `HTTP ${res.status}`);
  return data;
}

/** WhatsApp's *bold*, _italic_ and ~strikethrough~ marks. */
function formatWhatsApp(text: string): ReactNode {
  return text.split("\n").map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {formatLine(line)}
    </Fragment>
  ));
}

function formatLine(line: string): ReactNode[] {
  return line.split(/(\*[^*]+\*|_[^_]+_|~[^~]+~)/g).map((part, i) => {
    const inner = part.slice(1, -1);
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) return <strong key={i}>{formatLine(inner)}</strong>;
    if (part.length > 2 && part.startsWith("_") && part.endsWith("_")) return <em key={i}>{formatLine(inner)}</em>;
    if (part.length > 2 && part.startsWith("~") && part.endsWith("~")) return <s key={i}>{formatLine(inner)}</s>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function WhatsAppSimulator() {
  const [email, setEmail] = useState("");
  const [myLists, setMyLists] = useState<MyList[] | null>(null);
  const [list, setList] = useState<ShoppingList | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);

  const loadList = useCallback(async (code: string) => {
    if (!code.trim()) return;
    try {
      const data = await post({ action: "list", shareCode: code });
      setList(data.list as ShoppingList);
      setParticipants(data.participants as Participant[]);
      setError(null);
    } catch (e) {
      setList(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  async function findMyLists() {
    try {
      const data = await post({ action: "myLists", email });
      setMyLists(data.lists as MyList[]);
      setError(null);
    } catch (e) {
      setMyLists(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const poll = useCallback(async () => {
    const res = await fetch(`${API}?since=${seqRef.current}`).catch(() => null);
    if (!res?.ok) return;
    const { messages } = (await res.json()) as {
      messages: Array<{ seq: number; to: string; payload: OutgoingPayload }>;
    };
    if (messages.length === 0) return;
    seqRef.current = messages[messages.length - 1].seq;
    setEntries((prev) => [
      ...prev,
      ...messages.map((m): ChatEntry => ({ key: `bot-${m.seq}`, phone: m.to, from: "bot", payload: m.payload })),
    ]);
  }, []);

  // Start from "now": skip whatever an earlier session left in the outbox.
  useEffect(() => {
    void poll().then(() => setEntries([]));
    const id = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  async function run(action: () => Promise<unknown>) {
    try {
      setError(null);
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    await poll();
    if (list?.shareCode) await loadList(list.shareCode);
  }

  function send(phone: string, text: string, buttonId: string | null = null) {
    setEntries((prev) => [...prev, { key: `user-${Date.now()}-${Math.random()}`, phone, from: "user", text }]);
    return run(() => post({ action: "message", from: phone, text, buttonId }));
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">סימולטור הבוט בוואטסאפ</h1>
        <p className="text-sm text-neutral-600">
          רץ רק במחשב שלך. הבוט עונה כאן בדיוק כמו בוואטסאפ, מול הרשימות האמיתיות במסד הנתונים.
        </p>
      </header>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
        <p className="text-sm text-neutral-600">
          בוואטסאפ האמיתי כל אחד מתחבר פעם אחת מהאפליקציה. כאן בוחרים לאיזו רשימה לחבר את הטלפונים המדומים:
        </p>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void findMyLists();
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            המייל שלך באפליקציה
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-64 rounded-lg border border-neutral-300 px-3 py-2"
              placeholder="name@gmail.com"
              dir="ltr"
              type="email"
            />
          </label>
          <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white">הצג את הרשימות שלי</button>
          <button
            type="button"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm"
            onClick={() => void run(() => post({ action: "clear" })).then(() => setEntries([]))}
          >
            נקה שיחות
          </button>
        </form>

        {myLists && (
          <div className="flex flex-wrap gap-2">
            {myLists.length === 0 && (
              <p className="text-sm text-neutral-500">אין לך רשימות פעילות. צור רשימה באפליקציה ונסה שוב.</p>
            )}
            {myLists.map((l) => (
              <button
                key={l.shareCode}
                onClick={() => void loadList(l.shareCode)}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  list?.shareCode === l.shareCode ? "border-emerald-600 bg-emerald-50" : "border-neutral-300"
                }`}
              >
                {l.name} · {l.itemCount} מוצרים{l.shared ? " · משותפת" : ""}
              </button>
            ))}
          </div>
        )}

        {list && (
          <div className="flex flex-wrap gap-4">
            {PHONES.map((phone) => (
              <div key={phone.number} className="flex items-end gap-2">
                <label className="flex flex-col gap-1 text-sm">
                  מי מחזיק את {phone.label}?
                  <select
                    className="rounded-lg border border-neutral-300 px-3 py-2"
                    value={owners[phone.number] ?? ""}
                    onChange={(e) => setOwners((prev) => ({ ...prev, [phone.number]: e.target.value }))}
                  >
                    <option value="">בחרו משתתף</option>
                    {participants.map((p) => (
                      <option key={p.userId} value={p.userId}>
                        {p.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-40"
                  disabled={!owners[phone.number]}
                  onClick={() => {
                    setEntries((prev) => [
                      ...prev,
                      { key: `user-link-${Date.now()}`, phone: phone.number, from: "user", text: "(לחיצה על \"הוסף מוצרים מוואטסאפ\")" },
                    ]);
                    void run(() =>
                      post({ action: "link", from: phone.number, shareCode: list.shareCode, userId: owners[phone.number] }),
                    );
                  }}
                >
                  חבר לרשימה
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_320px]">
        {PHONES.map((phone) => (
          <Chat
            key={phone.number}
            phone={phone}
            entries={entries.filter((e) => e.phone === phone.number)}
            onSend={(text, buttonId) => void send(phone.number, text, buttonId)}
          />
        ))}
        <ListPanel
          list={list}
          onToggle={(itemId, checked) =>
            void run(() => post({ action: "check", shareCode: list?.shareCode, itemId, checked }))
          }
          onFinishTrip={() => void run(() => post({ action: "finishTrip", shareCode: list?.shareCode }))}
          onRefresh={() => list?.shareCode && void loadList(list.shareCode)}
        />
      </div>
    </main>
  );
}

function Chat({
  phone,
  entries,
  onSend,
}: {
  phone: Phone;
  entries: ChatEntry[];
  onSend: (text: string, buttonId: string | null) => void;
}) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Block body: newer browsers return a Promise from scrollIntoView, which an effect must not return.
    void bottomRef.current?.scrollIntoView({ block: "end" });
  }, [entries.length]);

  return (
    <section className="flex h-[600px] flex-col overflow-hidden rounded-xl shadow-sm">
      <div className="bg-emerald-800 px-4 py-3 text-white">
        <div className="font-semibold">רשימת קניות - NAVIO</div>
        <div className="text-xs opacity-80">
          {phone.label} · <span dir="ltr">+{phone.number}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto bg-[#efe7dd] p-3">
        {entries.length === 0 && (
          <p className="m-auto text-center text-sm text-neutral-500">בחרו רשימה, בחרו מי מחזיק את הטלפון ולחצו &quot;חבר לרשימה&quot;</p>
        )}
        {entries.map((entry) =>
          entry.from === "user" ? (
            <div key={entry.key} className="max-w-[80%] self-start whitespace-pre-wrap rounded-lg bg-[#d9fdd3] px-3 py-2 text-sm">
              {entry.text}
            </div>
          ) : (
            <BotMessage key={entry.key} payload={entry.payload} onTap={onSend} />
          ),
        )}
        <div ref={bottomRef} />
      </div>
      <form
        className="flex gap-2 bg-neutral-100 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          onSend(draft, null);
          setDraft("");
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={1}
          placeholder="הקלידו הודעה (Shift+Enter לשורה חדשה)"
          className="flex-1 resize-none rounded-full border border-neutral-300 px-4 py-2 text-sm"
        />
        <button className="rounded-full bg-emerald-600 px-4 text-sm text-white">שלח</button>
      </form>
    </section>
  );
}

function BotMessage({
  payload,
  onTap,
}: {
  payload: OutgoingPayload;
  onTap: (text: string, buttonId: string | null) => void;
}) {
  const interactive = payload.interactive;
  const body = payload.text?.body ?? interactive?.body?.text ?? "";
  const cta = interactive?.type === "cta_url" ? interactive.action?.parameters : undefined;
  const buttons = interactive?.type === "button" ? (interactive.action?.buttons ?? []) : [];

  return (
    <div className="max-w-[80%] self-end overflow-hidden rounded-lg bg-white text-sm shadow-sm">
      <div className="px-3 py-2">{formatWhatsApp(body)}</div>
      {cta?.url && (
        <a
          href={cta.url}
          target="_blank"
          rel="noreferrer"
          className="block border-t border-neutral-200 py-2 text-center font-medium text-sky-600"
        >
          ↗ {cta.display_text}
        </a>
      )}
      {buttons.map((b) => (
        <button
          key={b.reply.id}
          onClick={() => onTap(b.reply.title, b.reply.id)}
          className="block w-full border-t border-neutral-200 py-2 text-center font-medium text-sky-600 hover:bg-sky-50"
        >
          {b.reply.title}
        </button>
      ))}
    </div>
  );
}

function ListPanel({
  list,
  onToggle,
  onFinishTrip,
  onRefresh,
}: {
  list: ShoppingList | null;
  onToggle: (itemId: string, checked: boolean) => void;
  onFinishTrip: () => void;
  onRefresh: () => void;
}) {
  if (!list) {
    return (
      <aside className="rounded-xl bg-white p-4 text-sm text-neutral-500 shadow-sm">
        הרשימה תופיע כאן אחרי שתבחרו אותה.
      </aside>
    );
  }
  return (
    <aside className="flex h-[600px] flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{list.name ?? "רשימת הקניות"}</h2>
        <button onClick={onRefresh} className="text-xs text-sky-600">
          רענון
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        כמו באפליקציה: סמנו מה &quot;נקנה&quot;, ואז &quot;סיום קנייה&quot;. ההודעה הבאה לבוט תתחיל רשימה חדשה.
      </p>
      <ul className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {list.items.length === 0 && <li className="text-sm text-neutral-500">הרשימה ריקה</li>}
        {list.items.map((item) => (
          <li key={item.id}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(item.checked)}
                onChange={(e) => onToggle(item.id, e.target.checked)}
              />
              <span className={item.checked ? "text-neutral-400 line-through" : ""}>
                {item.rawText}
                {item.quantity && item.quantity > 1 ? ` ×${item.quantity}` : ""}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <button onClick={onFinishTrip} className="rounded-lg bg-neutral-900 py-2 text-sm text-white">
        סיום קנייה 🛒
      </button>
    </aside>
  );
}
