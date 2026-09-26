import { NextResponse } from "next/server";
import { ANDROID_PACKAGE } from "@/src/presentation/app-links";

/**
 * Android App Links verification: lets the app open navio.co.il links
 * (household invites, shared lists) directly instead of the browser.
 * ANDROID_CERT_SHA256 = comma-separated SHA-256 fingerprints of every key the
 * app is signed with - the EAS build key (`eas credentials -p android`) and,
 * once on Google Play, the Play App Signing key (Play Console -> App integrity).
 */
export function GET() {
  const fingerprints = (process.env.ANDROID_CERT_SHA256 ?? "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  return NextResponse.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: ANDROID_PACKAGE,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]);
}
