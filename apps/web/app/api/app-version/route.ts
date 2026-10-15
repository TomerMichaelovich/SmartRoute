import { NextResponse } from "next/server";
import { playStoreUrl } from "@/src/presentation/app-links";

/**
 * Oldest mobile app version (app.json's "version") still allowed to run. Every installed
 * version talks to this same API, and the Play Store doesn't force updates - so when an API
 * change breaks older builds, bump this and those builds show a blocking "please update"
 * screen on launch (apps/mobile/src/components/UpdateRequiredGate.tsx). JS-only fixes ship
 * through EAS Update instead and never need this.
 */
const MINIMUM_APP_VERSION = "0.1.0";

export async function GET() {
  return NextResponse.json({ minimumVersion: MINIMUM_APP_VERSION, updateUrl: playStoreUrl() });
}
