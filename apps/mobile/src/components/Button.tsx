import { forwardRef } from "react";
import { Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type View, type ViewStyle } from "react-native";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";

export type ButtonVariant = "primary" | "secondary";

interface ButtonProps extends Omit<PressableProps, "style"> {
  children: string;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

// RN analog of the web's button-styles.ts (bg-cyan-600 primary / white+border secondary,
// rounded-xl, px-5 py-3, text-base font-semibold, disabled:bg-neutral-300) - use directly
// as a <Link href={...} asChild><Button>...</Button></Link> child for navigation. Must
// forward its ref - expo-router's Link asChild attaches one to its child, and a plain
// (non-forwardRef) function component can't receive it.
export const Button = forwardRef<View, ButtonProps>(function Button(
  { children, variant = "primary", fullWidth = false, disabled, style, ...rest },
  ref,
) {
  return (
    <Pressable
      ref={ref}
      disabled={disabled}
      style={[
        styles.base,
        variant === "secondary" && styles.secondary,
        fullWidth && styles.fullWidth,
        disabled && (variant === "secondary" ? styles.secondaryDisabled : styles.disabled),
        style,
      ]}
      {...rest}
    >
      <Text style={[styles.text, variant === "secondary" && styles.secondaryText]}>{children}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    backgroundColor: COLORS.cyan600,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.cyan600,
  },
  fullWidth: {
    width: "100%",
  },
  disabled: {
    backgroundColor: COLORS.neutral300,
  },
  secondaryDisabled: {
    borderColor: COLORS.neutral300,
  },
  text: {
    color: COLORS.white,
    fontFamily: FONTS.semiBold,
    fontSize: 16,
  },
  secondaryText: {
    color: COLORS.cyan700,
  },
});
