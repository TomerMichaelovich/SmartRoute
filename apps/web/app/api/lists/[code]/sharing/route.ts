import { NextResponse } from "next/server";
import { listParticipants, requireListRole } from "@/src/presentation/lib/list-sharing";

/** The list's sharing panel: who takes part - owner first, then members, then pending join requests. */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const auth = await requireListRole(code, "member");
  if (auth instanceof NextResponse) return auth;

  const members = await listParticipants(auth.list, auth.kind === "owner" ? auth.user : null);
  return NextResponse.json({ role: auth.kind, listName: auth.list.name, members });
}
