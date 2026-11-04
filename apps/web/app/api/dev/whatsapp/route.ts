import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import {
  householdRepository,
  shoppingListRepository,
  storeRepository,
  userRepository,
  whatsappRepository,
} from "@/src/infrastructure/container";
import { createShoppingList } from "@/src/presentation/lib/create-list";
import { ensureSharingGroup } from "@/src/presentation/lib/list-sharing";
import {
  SIMULATED_PHONE_PREFIX,
  clearSimulatedMessages,
  isSimulatorEnabled,
  readSimulatedMessages,
} from "@/src/infrastructure/whatsapp/simulator";
import { handleIncomingMessage } from "@/src/presentation/lib/whatsapp-bot";

/**
 * Backend of the local WhatsApp simulator (/dev/whatsapp). Dev only - 404 in
 * production. Simulated numbers start with 999; the bot's replies to them are
 * caught in memory (see simulator.ts) and read back with GET ?since=<seq>.
 */
function disabled() {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

export async function GET(request: Request) {
  if (!isSimulatorEnabled()) return disabled();
  const since = Number(new URL(request.url).searchParams.get("since") ?? 0) || 0;
  return NextResponse.json({ messages: readSimulatedMessages(since) });
}

const phone = z.string().regex(new RegExp(`^${SIMULATED_PHONE_PREFIX}\\d{4,12}$`));
const shareCode = z.string().min(1);

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("message"),
    from: phone,
    text: z.string().nullable(),
    buttonId: z.string().nullable().optional(),
  }),
  z.object({ action: z.literal("list"), shareCode }),
  z.object({ action: z.literal("myLists"), email: z.string().min(3) }),
  z.object({ action: z.literal("createTestList") }),
  z.object({ action: z.literal("link"), from: phone, shareCode, userId: z.string().min(1) }),
  z.object({ action: z.literal("check"), shareCode, itemId: z.string(), checked: z.boolean() }),
  z.object({ action: z.literal("finishTrip"), shareCode }),
  z.object({ action: z.literal("clear") }),
]);

export async function POST(request: Request) {
  if (!isSimulatorEnabled()) return disabled();
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const body = parsed.data;

  try {
    switch (body.action) {
      case "message":
        await simulateIncoming(body.from, body.text, body.buttonId ?? null);
        return NextResponse.json({ ok: true });

      case "clear":
        clearSimulatedMessages();
        return NextResponse.json({ ok: true });

      case "list": {
        const list = await findList(body.shareCode);
        if (!list) return NextResponse.json({ error: "הרשימה לא נמצאה" }, { status: 404 });
        return NextResponse.json({ list, participants: await participants(list) });
      }

      case "myLists": {
        // The lists on this user's home screen in the app (their own + shared with them).
        const user = await userRepository.findByEmail(body.email.trim().toLowerCase());
        if (!user) return NextResponse.json({ error: "לא נמצא משתמש עם המייל הזה" }, { status: 404 });
        const [own, shared] = await Promise.all([
          shoppingListRepository.findAllActiveByOwner(user.id),
          shoppingListRepository.findSharedWithUser(user.id),
        ]);
        const seen = new Set<string>();
        const lists = [...own, ...shared]
          .filter((l) => l.shareCode && !l.deletedAt && !seen.has(l.id) && seen.add(l.id))
          .map((l) => ({
            shareCode: l.shareCode,
            name: l.name ?? "רשימת קניות",
            itemCount: l.items.length,
            shared: Boolean(l.householdId),
          }));
        return NextResponse.json({ lists });
      }

      case "createTestList":
        return NextResponse.json(await createTestList());

      case "link": {
        const list = await findList(body.shareCode);
        if (!list) return NextResponse.json({ error: "הרשימה לא נמצאה" }, { status: 404 });
        // Same path as the app's button: mint a one-time code, then "send" it from the number.
        const code = await whatsappRepository.createLinkCode(body.userId, list.id, 30);
        await simulateIncoming(body.from, `חיבור ${code}`, null);
        return NextResponse.json({ ok: true });
      }

      case "check": {
        const list = await findList(body.shareCode);
        if (!list) return NextResponse.json({ error: "הרשימה לא נמצאה" }, { status: 404 });
        await shoppingListRepository.setItemChecked(
          list.id,
          body.itemId,
          body.checked,
          body.checked ? { userId: "simulator", name: "סימולטור" } : null,
        );
        return NextResponse.json({ ok: true });
      }

      case "finishTrip": {
        // What finishing a trip in the app records for the bot: ticked items were bought.
        const list = await findList(body.shareCode);
        if (!list) return NextResponse.json({ error: "הרשימה לא נמצאה" }, { status: 404 });
        await whatsappRepository.recordFinishedTrip(
          list.id,
          list.items.map((item) => item.id),
          list.items.filter((item) => !item.checked).map((item) => item.id),
        );
        return NextResponse.json({ ok: true });
      }
    }
  } catch (error) {
    console.error("[whatsapp-simulator]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

const TEST_USERS = [
  { email: "whatsapp-test-1@navio.local", displayName: "אני (ניסיון)" },
  { email: "whatsapp-test-2@navio.local", displayName: "בן/בת זוג (ניסיון)" },
];
const TEST_LIST_NAME = "רשימת ניסיון - וואטסאפ";

/**
 * Two test accounts sharing one list, so the bot can be tried with no app account
 * in this database. Reuses them on later clicks instead of piling up copies.
 */
async function createTestList() {
  const [me, partner] = await Promise.all(
    TEST_USERS.map(
      async (u) =>
        (await userRepository.findByEmail(u.email)) ??
        userRepository.create({ id: crypto.randomUUID(), email: u.email, displayName: u.displayName }),
    ),
  );

  const existing = (await shoppingListRepository.findAllActiveByOwner(me.id)).find(
    (l) => l.name === TEST_LIST_NAME && !l.deletedAt,
  );
  let list = existing ?? null;
  if (!list) {
    const [store] = await storeRepository.findAll();
    if (!store) throw new Error("אין חנויות במסד הנתונים - צריך לפחות חנות אחת כדי ליצור רשימה");
    list = await createShoppingList({ storeId: store.id, rawItems: [], ownerUserId: me.id, name: TEST_LIST_NAME });
  }

  const householdId = await ensureSharingGroup(list, me);
  if (!(await householdRepository.getMembership(householdId, partner.id))) {
    await householdRepository.addPendingMember(householdId, partner.id);
  }
  await householdRepository.approveMember(householdId, partner.id);

  return { shareCode: list.shareCode, email: me.email };
}

/** Runs the bot synchronously (the real webhook does it in after()) so errors show up here. */
function simulateIncoming(from: string, text: string | null, buttonId: string | null): Promise<void> {
  return handleIncomingMessage({ id: `sim-${crypto.randomUUID()}`, from, text, buttonId });
}

async function findList(code: string) {
  const list = await shoppingListRepository.findByShareCode(normalizeShareCode(code));
  return list && !list.deletedAt ? list : null;
}

/** Who can be "the person on this phone": the owner plus active members. */
async function participants(list: NonNullable<Awaited<ReturnType<typeof findList>>>) {
  const people = new Map<string, { userId: string; displayName: string }>();
  if (list.ownerUserId) {
    const owner = await userRepository.findById(list.ownerUserId);
    if (owner) people.set(owner.id, { userId: owner.id, displayName: owner.displayName });
  }
  if (list.householdId) {
    for (const member of await householdRepository.listMembers(list.householdId)) {
      if (member.status === "active") people.set(member.userId, { userId: member.userId, displayName: member.displayName });
    }
  }
  return [...people.values()];
}
