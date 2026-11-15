"use client";

import { useEffect, useState, useTransition } from "react";
import {
  computeFootstepPlacements,
  FOOTSTEP_SCALE_DEFAULT,
  FOOTSTEP_SCALE_MAX,
  FOOTSTEP_SCALE_MIN,
  footstepTrailMetrics,
} from "@smartroute/core/map/footstep-trail";
import { Footprint } from "@/src/presentation/components/map/StoreMap";

interface FootstepSizeFormProps {
  mapWidth: number;
  mapHeight: number;
  mapImageUrl: string;
  footstepScale: number;
  updateFootstepScale: (footstepScale: number) => Promise<void>;
}

const TOAST_DURATION_MS = 2500;
/** Roughly the map's on-screen width in the app, inline above the checklist. */
const PHONE_MAP_WIDTH_PX = 360;
/** A made-up walk across the map (normalized 0-1), just to show the prints at real size. */
const SAMPLE_PATH = [
  { x: 0.1, y: 0.78 },
  { x: 0.45, y: 0.78 },
  { x: 0.45, y: 0.38 },
  { x: 0.9, y: 0.38 },
];

/**
 * The store's footprint-trail size, with a live preview drawn on its own map at the width
 * the app shows it, plus a 2x crop for when the shopper enlarges the map.
 */
export function FootstepSizeForm({
  mapWidth,
  mapHeight,
  mapImageUrl,
  footstepScale,
  updateFootstepScale,
}: FootstepSizeFormProps) {
  // Collapsed to one button until the admin opens it - the previews are big and rarely needed.
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(footstepScale);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  const trail = footstepTrailMetrics(mapWidth, value);
  const points = SAMPLE_PATH.map((p) => ({ x: p.x * mapWidth, y: p.y * mapHeight }));
  const footsteps = computeFootstepPlacements(points, trail.stepDistance, trail.footOffset);
  // Pixel height of one print as the shopper sees it on the inline map.
  const printPx = (trail.size / mapWidth) * PHONE_MAP_WIDTH_PX;
  // The 2x crop: half the map's width, centered on the sample path's corner.
  const zoomW = mapWidth / 2;
  const zoomH = mapHeight / 2;
  const zoomX = Math.min(Math.max(0.45 * mapWidth - zoomW / 2, 0), mapWidth - zoomW);
  const zoomY = Math.min(Math.max(0.58 * mapHeight - zoomH / 2, 0), mapHeight - zoomH);
  const dirty = Math.abs(value - footstepScale) > 1e-9;

  function save() {
    startTransition(async () => {
      await updateFootstepScale(value);
      setSaved(true);
    });
  }

  const preview = (viewBox: string) => (
    <svg
      viewBox={viewBox}
      width={PHONE_MAP_WIDTH_PX}
      className="h-auto max-w-full rounded-xl border border-neutral-200 bg-white"
      role="img"
      aria-label="תצוגה מקדימה של גודל הצעדים"
    >
      {mapImageUrl && (
        <image href={mapImageUrl} x={0} y={0} width={mapWidth} height={mapHeight} preserveAspectRatio="xMidYMid slice" />
      )}
      {footsteps.map((step, i) => (
        <Footprint key={i} {...step} size={trail.size} />
      ))}
    </svg>
  );

  const toast = saved && (
    <div
      role="status"
      className="fixed bottom-6 start-1/2 z-50 -translate-x-1/2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-lg"
    >
      ✓ גודל הצעדים נשמר
    </div>
  );

  if (!open) {
    return (
      <div className="flex">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:border-cyan-600 hover:text-cyan-700"
        >
          הגדרת גודל הצעדים במפה <span className="font-normal text-neutral-400">({Math.round(footstepScale * 100)}%)</span>
        </button>
        {toast}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-neutral-900">גודל הצעדים במפה</h2>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setValue(footstepScale);
            }}
            className="text-sm text-neutral-500 hover:text-neutral-900"
          >
            סגירה ✕
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          טביעות הרגליים שמסמנות לקונה את הדרך למחלקה. המרווח בין הצעדים משתנה יחד עם הגודל. התצוגה למטה מציירת מסלול
          לדוגמה על מפת הסניף ברוחב שבו היא מוצגת באפליקציה.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="footstep-scale" className="text-sm text-neutral-700">
          גודל
        </label>
        <input
          id="footstep-scale"
          type="range"
          min={FOOTSTEP_SCALE_MIN}
          max={FOOTSTEP_SCALE_MAX}
          step={0.05}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-64 accent-cyan-600"
        />
        <span className="w-28 text-sm font-medium tabular-nums text-neutral-900">
          {Math.round(value * 100)}% <span className="text-xs font-normal text-neutral-400">(~{printPx.toFixed(0)}px)</span>
        </span>
        <button
          type="button"
          onClick={() => setValue(FOOTSTEP_SCALE_DEFAULT)}
          disabled={value === FOOTSTEP_SCALE_DEFAULT}
          className="text-xs text-cyan-700 hover:underline disabled:text-neutral-300 disabled:no-underline"
        >
          חזרה לגודל המקורי
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || pending}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {pending ? "שומר…" : "שמור"}
        </button>
        {dirty && <span className="text-xs text-amber-700">שמור כעת: {Math.round(footstepScale * 100)}%</span>}
      </div>

      <div className="flex flex-wrap gap-4">
        <figure className="flex flex-col gap-1">
          {preview(`0 0 ${mapWidth} ${mapHeight}`)}
          <figcaption className="text-xs text-neutral-500">כך זה נראה בטלפון (המפה הרגילה)</figcaption>
        </figure>
        <figure className="flex flex-col gap-1">
          {preview(`${zoomX} ${zoomY} ${zoomW} ${zoomH}`)}
          <figcaption className="text-xs text-neutral-500">בהגדלה פי 2 (מפה מוגדלת / זום)</figcaption>
        </figure>
      </div>

      {toast}
    </section>
  );
}
