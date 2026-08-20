export type ButtonVariant = "primary" | "secondary" | "ghost";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-cyan-600 text-white active:bg-cyan-700 disabled:bg-neutral-300",
  secondary:
    "bg-white text-cyan-700 border border-cyan-600 active:bg-cyan-50 disabled:border-neutral-300 disabled:text-neutral-400",
  ghost: "bg-transparent text-neutral-700 active:bg-neutral-100 disabled:text-neutral-300",
};

const BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold transition-colors disabled:cursor-not-allowed";

export function buttonClassName(
  variant: ButtonVariant = "primary",
  fullWidth = false,
  extra = "",
): string {
  return [BASE_CLASSES, VARIANT_CLASSES[variant], fullWidth ? "w-full" : "", extra]
    .filter(Boolean)
    .join(" ");
}
