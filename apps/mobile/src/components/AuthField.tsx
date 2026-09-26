import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";

interface AuthFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
}

// RN port of the web's AuthField.tsx.
export function AuthField({ label, error, hint, style, ...rest }: AuthFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={COLORS.neutral500}
        {...rest}
      />
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 4,
  },
  label: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.neutral700,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral300,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.neutral900,
  },
  inputError: {
    borderColor: "#dc2626",
  },
  hint: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  error: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: "#dc2626",
  },
});
