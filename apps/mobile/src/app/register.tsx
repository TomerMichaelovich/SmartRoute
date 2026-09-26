import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { he } from "@smartroute/core/i18n/he";
import { AuthField } from "@/components/AuthField";
import { Button } from "@/components/Button";
import { GoogleButton } from "@/components/GoogleButton";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";
import { useAuth, type AuthFieldErrors } from "@/lib/auth-context";

export default function RegisterScreen() {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { register, loginWithGoogle, googleAvailable } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});

  function goNext() {
    router.replace((next as string) ?? "/");
  }

  async function handleSubmit() {
    setPending(true);
    setError(undefined);
    setFieldErrors({});
    const result = await register(email, password, displayName);
    setPending(false);
    if (result.ok) {
      goNext();
      return;
    }
    setError(result.error);
    setFieldErrors(result.fieldErrors ?? {});
  }

  async function handleGoogle() {
    setPending(true);
    setError(undefined);
    const result = await loginWithGoogle();
    setPending(false);
    if (result.ok) goNext();
    else if (result.error) setError(result.error);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Link href="/" style={styles.appName}>
            {he.common.appName}
          </Link>
          <Text style={styles.title}>{he.auth.register.title}</Text>
          <Text style={styles.subtitle}>{he.auth.register.subtitle}</Text>
        </View>

        {googleAvailable && (
          <>
            <GoogleButton onPress={handleGoogle} disabled={pending} />
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{he.auth.google.or}</Text>
              <View style={styles.dividerLine} />
            </View>
          </>
        )}

        <View style={styles.form}>
          <AuthField
            label={he.auth.register.nameLabel}
            placeholder={he.auth.register.namePlaceholder}
            value={displayName}
            onChangeText={setDisplayName}
            textContentType="name"
            error={fieldErrors.displayName}
          />
          <AuthField
            label={he.auth.register.emailLabel}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            error={fieldErrors.email}
          />
          <AuthField
            label={he.auth.register.passwordLabel}
            hint={he.auth.register.passwordHint}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
            error={fieldErrors.password}
          />
          {error && <Text style={styles.errorText}>{error}</Text>}
          <Button onPress={handleSubmit} disabled={pending} fullWidth>
            {pending ? he.common.loading : he.auth.register.submit}
          </Button>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{he.auth.register.haveAccount}</Text>
          <Link href={next ? { pathname: "/login", params: { next } } : "/login"} style={styles.footerLink}>
            {he.auth.register.goToLogin}
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.neutral50,
  },
  page: {
    width: "100%",
    maxWidth: 448,
    alignSelf: "center",
    gap: 20,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    alignItems: "center",
    gap: 4,
  },
  appName: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral300,
  },
  title: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: COLORS.neutral900,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral600,
    textAlign: "center",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.neutral200,
  },
  dividerText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  form: {
    gap: 16,
  },
  errorText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "#dc2626",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  footerText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral600,
  },
  footerLink: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.cyan700,
  },
});
