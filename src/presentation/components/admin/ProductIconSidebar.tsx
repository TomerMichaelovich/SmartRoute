"use client";

import type { ProductIcon } from "@/src/presentation/product-icons";
import { IconPalette } from "./IconPalette";

interface ProductIconSidebarProps {
  icons: ProductIcon[];
  onIconDropped: (icon: ProductIcon, clientX: number, clientY: number) => void;
}

export function ProductIconSidebar({ icons, onIconDropped }: ProductIconSidebarProps) {
  return (
    <IconPalette
      title="גררו לצומת"
      icons={icons}
      onIconDropped={onIconDropped}
      thumbnailClassName="h-10 w-10 rounded-full object-cover"
      ghostClassName="h-14 w-14 rounded-full object-cover"
    />
  );
}
