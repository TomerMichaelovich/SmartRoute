import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/presentation/auth/dal";

/**
 * Lets the mobile app validate a stored session token on app start (and
 * fetch the current user for the account screen) without a page load.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ user });
}
