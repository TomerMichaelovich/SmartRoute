import { after, NextResponse } from "next/server";
import { isWhatsAppConfigured, verifySignature } from "@/src/infrastructure/whatsapp/client";
import { handleIncomingMessage, type IncomingWhatsAppMessage } from "@/src/presentation/lib/whatsapp-bot";

/**
 * WhatsApp Cloud API webhook (configured in the Meta app dashboard).
 * GET: Meta's one-time subscription check. POST: incoming messages - answered
 * with 200 right away (Meta retries slow webhooks), handled after the response.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (
    verifyToken &&
    params.get("hub.mode") === "subscribe" &&
    params.get("hub.verify_token") === verifyToken
  ) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

interface WebhookMessage {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  interactive?: { button_reply?: { id?: string; title?: string }; list_reply?: { title?: string } };
  button?: { text?: string };
}

interface WebhookBody {
  entry?: Array<{ changes?: Array<{ value?: { messages?: WebhookMessage[] } }> }>;
}

function toIncoming(message: WebhookMessage): IncomingWhatsAppMessage | null {
  if (!message.id || !message.from) return null;
  const text =
    message.text?.body ??
    message.interactive?.button_reply?.title ??
    message.interactive?.list_reply?.title ??
    message.button?.text ??
    null;
  return { id: message.id, from: message.from, text, buttonId: message.interactive?.button_reply?.id ?? null };
}

export async function POST(request: Request) {
  if (!isWhatsAppConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 404 });

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifySignature(rawBody, signature, process.env.WHATSAPP_APP_SECRET!)) {
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  // Status updates (sent/delivered/read) arrive here too; only messages matter.
  const messages = (body.entry ?? [])
    .flatMap((entry) => entry.changes ?? [])
    .flatMap((change) => change.value?.messages ?? [])
    .map(toIncoming)
    .filter((m): m is IncomingWhatsAppMessage => m !== null);

  if (messages.length > 0) {
    after(async () => {
      for (const message of messages) {
        try {
          await handleIncomingMessage(message);
        } catch (error) {
          console.error("[whatsapp] failed to handle message", message.id, error);
        }
      }
    });
  }

  return NextResponse.json({ ok: true });
}
