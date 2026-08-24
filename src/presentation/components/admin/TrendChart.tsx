"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyPoint } from "@/src/application/analytics/analytics-service";

const LINE_COLOR = "#0891b2"; // cyan-600, matches this app's existing accent (StatTile value, buttons)
const GRIDLINE_COLOR = "#e1e0d9";
const MUTED_TEXT_COLOR = "#898781";

export type TrendChartFormat = "percent" | "count" | "seconds" | "rating";

// Format is passed as a serializable string, not a function - page.tsx is a Server
// Component and this is a Client Component, and functions can't cross that boundary.
const FORMATTERS: Record<TrendChartFormat, (value: number) => string> = {
  percent: (v) => `${Math.round(v * 100)}%`,
  count: (v) => `${v}`,
  seconds: (v) => `${Math.round(v)} שנ׳`,
  rating: (v) => `${v.toFixed(1)}/5`,
};

// Axis ticks stay unit-less and compact - the unit only appears in the tooltip/title,
// otherwise "6000 שנ׳" wraps inside the narrow axis column.
const AXIS_FORMATTERS: Record<TrendChartFormat, (value: number) => string> = {
  ...FORMATTERS,
  seconds: (v) => `${Math.round(v)}`,
};

interface TrendChartProps {
  title: string;
  data: DailyPoint[];
  format?: TrendChartFormat;
}

function formatDayLabel(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

function TooltipContent({
  active,
  payload,
  formatValue,
}: {
  active?: boolean;
  payload?: { payload: DailyPoint }[];
  formatValue: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-sm">
      <div className="text-sm font-semibold text-neutral-900">{formatValue(point.value)}</div>
      <div className="text-xs text-neutral-500">{formatDayLabel(point.date)}</div>
    </div>
  );
}

export function TrendChart({ title, data, format = "count" }: TrendChartProps) {
  const hasData = data.some((point) => point.value !== 0);
  const formatValue = FORMATTERS[format];
  const formatAxisValue = AXIS_FORMATTERS[format];

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
      <span className="text-sm text-neutral-500">{title}</span>
      {hasData ? (
        <div className="h-48 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRIDLINE_COLOR} strokeWidth={1} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDayLabel}
                tick={{ fill: MUTED_TEXT_COLOR, fontSize: 12 }}
                axisLine={{ stroke: GRIDLINE_COLOR }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tickFormatter={formatAxisValue}
                tick={{ fill: MUTED_TEXT_COLOR, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip content={<TooltipContent formatValue={formatValue} />} />
              <Line
                dataKey="value"
                stroke={LINE_COLOR}
                strokeWidth={2}
                dot={{ r: 3, fill: LINE_COLOR, strokeWidth: 2, stroke: "#ffffff" }}
                activeDot={{ r: 5, fill: LINE_COLOR, strokeWidth: 2, stroke: "#ffffff" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-48 w-full items-center justify-center text-sm text-neutral-400">
          אין נתונים עדיין
        </div>
      )}
    </div>
  );
}
