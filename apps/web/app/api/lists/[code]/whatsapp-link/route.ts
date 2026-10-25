import { NextResponse } from "next/server";
import { normalizeShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import { shoppingListRepository, whatsappRepository } from "@/src/infrastructure/container";
import { chatLink, isWhatsAppConfigured } from "@/src/infrastructure/whatsapp/client";
import { resolveListAccess } from "@/src/presentation/auth/list-access";

const LINK_CODE_TTL_MINUTES = 30;

/**
 * Whether the "add items from WhatsApp" button should show (the bot is configured
 * on this server), and whether the caller is already linked to this list - then
 * the app just opens the chat; linking is once per person, it stays until "נתק".
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  if (!isWhatsAppConfigured()) return NextResponse.json({ enabled: false, linked: false });

  const { code } = await params;
  const list = await shoppingListRepository.findByShareCode(normalizeShareCode(code));
  const access = list && !list.deletedAt ? await resolveListAccess(list) : null;
  const linked = Boolean(
    list && access?.user && (await whatsappRepository.findLinkByUserAndList(access.user.id, list.id)),
  );
  return NextResponse.json({ enabled: true, linked, chatUrl: linked ? chatLink("") : null });
}

/**
 * Mints a one-time code linking the caller's WhatsApp number to this list and
 * returns a wa.me link with "חיבור <code>" pre-typed - sending it links the number.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  if (!isWhatsAppConfigured()) return NextResponse.json({ error: "disabled" }, { status: 404 });

  const { code } = await params;
  const list = await shoppingListRepository.findByShareCode(normalizeShareCode(code));
  if (!list || list.deletedAt) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const access = await resolveListAccess(list);
  // Linking needs an account: the bot acts as that user.
  if (!access?.user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const linkCode = await whatsappRepository.createLinkCode(access.user.id, list.id, LINK_CODE_TTL_MINUTES);
  return NextResponse.json({ url: chatLink(`חיבור ${linkCode}`), code: linkCode });
}
