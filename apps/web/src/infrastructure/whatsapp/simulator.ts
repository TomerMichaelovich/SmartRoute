/**
 * Local WhatsApp simulator (dev only - /dev/whatsapp). Messages the bot sends to
 * a simulated number (999...) land in this in-memory outbox instead of going to
 * Meta, so the whole bot can be tried without a WhatsApp number or Meta account.
 */

/** Simulated numbers start with this - nothing real does. */
export const SIMULATED_PHONE_PREFIX = "999";

export interface SimulatedMessage {
  seq: number;
  to: string;
  at: string;
  /** The Cloud API payload the bot would have sent (text / interactive). */
  payload: Record<string, unknown>;
}

export function isSimulatorEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function isSimulatedPhone(phone: string): boolean {
  return isSimulatorEnabled() && phone.startsWith(SIMULATED_PHONE_PREFIX);
}

// On globalThis so dev hot-reloads don't wipe the conversation.
const store = globalThis as typeof globalThis & {
  __navioWhatsAppOutbox?: { seq: number; messages: SimulatedMessage[] };
};
function outbox() {
  store.__navioWhatsAppOutbox ??= { seq: 0, messages: [] };
  return store.__navioWhatsAppOutbox;
}

export function recordSimulatedMessage(to: string, payload: Record<string, unknown>): void {
  const box = outbox();
  box.seq += 1;
  box.messages.push({ seq: box.seq, to, at: new Date().toISOString(), payload });
  if (box.messages.length > 500) box.messages.splice(0, box.messages.length - 500);
}

export function readSimulatedMessages(sinceSeq: number): SimulatedMessage[] {
  return outbox().messages.filter((m) => m.seq > sinceSeq);
}

export function clearSimulatedMessages(): void {
  outbox().messages = [];
}
