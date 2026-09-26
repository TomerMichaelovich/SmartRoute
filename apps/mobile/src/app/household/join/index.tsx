import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { Household } from "@smartroute/core/domain/entities/household";
import { he } from "@smartroute/core/i18n/he";
import { apiFetch } from "@/lib/api";
import { AuthField } from "@/components/AuthField";
import { Button } from "@/components/Button";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";
import { useAuth } from "@/lib/auth-context";
import { clearPendingInvite } from "@/lib/pending-invite";

type PreviewState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "invalid" }
  | { status: "already_member" }
  | { status: "already_in_other"; household: Household | null }
  | { status: "joinable"; household: Household | null };

/**
 * Join-a-household screen. Reached either manually ("have an invite code?")
 * or from an invite link via household/join/[code].tsx / PendingInviteResume,
 * which pass the code as `?code=` so it's checked straight away.
 */
export default function HouseholdJoinScreen() {
  const router = useRouter();
  const { status: authStatus } = useAuth();
  const { code: linkCode } = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(linkCode ?? "");
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
  const [busy, setBusy] = useState(false);

  // An invite from a link is handled once it's shown here - clear it so
  // PendingInviteResume doesn't keep bringing the user back.
  useEffect(() => {
    if (authStatus !== "authenticated" || !linkCode) return;
    void clearPendingInvite();
    setCode(linkCode);
    void handleCheck(linkCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, linkCode]);

  if (authStatus === "guest") return <Redirect href="/login" />;

  async function handleCheck(value: string = code) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setPreview({ status: "checking" });
    const res = await apiFetch(`/api/household/invite/${trimmed}`);
    if (!res.ok) {
      setPreview({ status: "invalid" });
      return;
    }
    const data: { status: string; household: Household | null } = await res.json();
    setPreview(data as PreviewState);
  }

  async function handleConfirm() {
    setBusy(true);
    const res = await apiFetch("/api/household/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });
    setBusy(false);
    if (res.ok) {
      router.replace("/household");
    } else {
      setPreview({ status: "invalid" });
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>{he.household.join.title}</Text>

      <AuthField
        label={he.myList.codePlaceholder}
        value={code}
        onChangeText={(text) => {
          setCode(text);
          setPreview({ status: "idle" });
        }}
        autoCapitalize="none"
      />
      <Button onPress={() => handleCheck()} disabled={!code.trim() || preview.status === "checking"}>
        {he.common.continue}
      </Button>

      {preview.status === "invalid" && <Text style={styles.errorText}>{he.household.join.invalid}</Text>}

      {(preview.status === "joinable" || preview.status === "already_in_other") && (
        <View style={styles.previewBlock}>
          <Text style={styles.previewText}>{he.household.join.prompt(preview.household?.name ?? "")}</Text>
          {preview.status === "already_in_other" ? (
            <Text style={styles.warningText}>{he.household.join.alreadyInOther}</Text>
          ) : (
            <Button onPress={handleConfirm} disabled={busy} fullWidth>
              {he.household.join.confirm}
            </Button>
          )}
        </View>
      )}

      {preview.status === "already_member" && (
        <Text style={styles.warningText}>{he.household.join.alreadyMember}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    width: "100%",
    maxWidth: 448,
    alignSelf: "center",
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  title: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: COLORS.neutral900,
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "#dc2626",
    textAlign: "center",
  },
  warningText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "#92400e",
    textAlign: "center",
  },
  previewBlock: {
    gap: 12,
    alignItems: "center",
  },
  previewText: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.neutral700,
    textAlign: "center",
  },
});
