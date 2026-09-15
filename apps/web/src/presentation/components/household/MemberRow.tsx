"use client";

import type { HouseholdMemberView } from "@smartroute/core/domain/entities/household";
import { approveMember, removeMember } from "@/src/presentation/actions/household-actions";
import { he } from "@smartroute/core/i18n/he";

interface MemberRowProps {
  member: HouseholdMemberView;
  isSelf: boolean;
  viewerIsOwner: boolean;
}

export function MemberRow({ member, isSelf, viewerIsOwner }: MemberRowProps) {
  const canManage = viewerIsOwner && !isSelf;

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-neutral-900">
          {member.displayName}
          {isSelf ? ` (${he.household.members.you})` : ""}
        </span>
        <span className="text-xs text-neutral-500">
          {member.role === "owner" ? he.household.members.owner : member.email}
          {member.status === "pending" ? ` · ${he.household.members.pendingBadge}` : ""}
        </span>
      </div>

      {canManage && (
        <div className="flex shrink-0 gap-3 text-sm">
          {member.status === "pending" && (
            <form action={approveMember}>
              <input type="hidden" name="userId" value={member.userId} />
              <button type="submit" className="font-medium text-cyan-700">
                {he.household.members.approve}
              </button>
            </form>
          )}
          <form
            action={removeMember}
            onSubmit={(e) => {
              if (!confirm(he.household.members.removeConfirm)) e.preventDefault();
            }}
          >
            <input type="hidden" name="userId" value={member.userId} />
            <button type="submit" className="text-red-600">
              {he.household.members.remove}
            </button>
          </form>
        </div>
      )}
    </li>
  );
}
