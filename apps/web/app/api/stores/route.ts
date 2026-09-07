import { NextResponse } from "next/server";
import { storeRepository } from "@/src/infrastructure/container";

// Web app's /branches page fetches active stores via a Server Component calling the
// repository directly - no HTTP surface for that read existed before this. Needed so
// the mobile app (no Server Components) can render its own branches screen over REST.
export async function GET() {
  const stores = await storeRepository.findActive();
  return NextResponse.json(stores);
}
