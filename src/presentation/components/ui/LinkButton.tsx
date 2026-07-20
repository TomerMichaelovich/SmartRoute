import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonClassName, type ButtonVariant } from "./button-styles";

interface LinkButtonProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export function LinkButton({
  variant = "primary",
  fullWidth = false,
  className = "",
  ...rest
}: LinkButtonProps) {
  return <Link className={buttonClassName(variant, fullWidth, className)} {...rest} />;
}
