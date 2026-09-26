import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { setPendingInvite } from "@/lib/pending-invite";

/**
 * Entry point for an invite link (https://navio.co.il/household/join/<code>,
 * opened via App Links or the install referrer). Remembers the code so the
 * join resumes even if the user wanders off mid-login, then hands over to the
 * join screen - after login first, for a guest.
 */
export default function HouseholdInviteLinkScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { status } = useAuth();

  useEffect(() => {
    void setPendingInvite(code);
  }, [code]);

  if (status === "loading") return null;

  const joinHref = `/household/join?code=${encodeURIComponent(code)}`;
  if (status === "guest") {
    return <Redirect href={{ pathname: "/login", params: { next: joinHref } }} />;
  }
  return <Redirect href={{ pathname: "/household/join", params: { code } }} />;
}
