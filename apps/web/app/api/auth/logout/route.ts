import { NextResponse } from "next/server";
import { destroySession } from "@/src/infrastructure/auth/session";

/** REST counterpart of the `logout` Server Action, for the mobile app (bearer token, no redirect). */
export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
