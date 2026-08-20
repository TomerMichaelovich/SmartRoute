"use client";

import { useRef, useState } from "react";

export interface DraggableIcon {
  key: string;
  labelHe: string;
  src: string;
}

interface IconPaletteProps<T extends DraggableIcon> {
  title: string;
  icons: T[];
  onIconDropped: (icon: T, clientX: number, clientY: number) => void;
  thumbnailClassName: string;
  ghostClassName: string;
}

/**
 * Draggable icon palette. Uses Pointer Events (not native HTML5 drag-and-drop, which doesn't
 * work on touchscreens) so it behaves the same on the admin's phone as on desktop, matching
 * the drag pattern already used for repositioning nodes/walls in StoreLayoutEditor. Generic over
 * the icon type so both the product-icon and department-fixture-icon sidebars share this one
 * drag implementation instead of duplicating it.
 */
export function IconPalette<T extends DraggableIcon>({
  title,
  icons,
  onIconDropped,
  thumbnailClassName,
  ghostClassName,
}: IconPaletteProps<T>) {
  const [ghost, setGhost] = useState<{ icon: T; x: number; y: number } | null>(null);
  const draggingIconRef = useRef<T | null>(null);

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>, icon: T) {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingIconRef.current = icon;
    setGhost({ icon, x: e.clientX, y: e.clientY });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!draggingIconRef.current) return;
    setGhost({ icon: draggingIconRef.current, x: e.clientX, y: e.clientY });
  }

  function handlePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const icon = draggingIconRef.current;
    draggingIconRef.current = null;
    setGhost(null);
    if (icon) onIconDropped(icon, e.clientX, e.clientY);
  }

  return (
    <>
      <div className="flex w-full flex-col gap-1.5 rounded-2xl border border-neutral-200 bg-white p-2">
        <p className="text-xs font-medium text-neutral-500">{title}</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {icons.map((icon) => (
            <button
              key={icon.key}
              type="button"
              onPointerDown={(e) => handlePointerDown(e, icon)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="flex shrink-0 touch-none flex-col items-center gap-1 rounded-xl p-1.5 text-center active:bg-cyan-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={icon.src} alt={icon.labelHe} className={thumbnailClassName} draggable={false} />
              <span className="whitespace-nowrap text-[11px] leading-tight text-neutral-700">{icon.labelHe}</span>
            </button>
          ))}
        </div>
      </div>

      {ghost && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ghost.icon.src}
          alt=""
          className={`pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 opacity-80 shadow-lg ${ghostClassName}`}
          style={{ left: ghost.x, top: ghost.y }}
        />
      )}
    </>
  );
}
