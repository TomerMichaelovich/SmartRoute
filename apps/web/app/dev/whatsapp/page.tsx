import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isSimulatorEnabled } from "@/src/infrastructure/whatsapp/simulator";
import { WhatsAppSimulator } from "./whatsapp-simulator";

export const metadata: Metadata = { title: "סימולטור וואטסאפ - NAVIO" };

/** Local-only playground for the WhatsApp bot - no Meta account or phone number needed. */
export default function WhatsAppSimulatorPage() {
  if (!isSimulatorEnabled()) notFound();
  return <WhatsAppSimulator />;
}
