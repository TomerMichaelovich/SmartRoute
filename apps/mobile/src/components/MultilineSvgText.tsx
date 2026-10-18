import { G, Text, TSpan, type TextProps } from "react-native-svg";

interface MultilineSvgTextProps extends TextProps {
  text: string;
  x: number;
  y: number;
  lineHeight: number;
  /** Draws an outline of this color/width around the glyphs (e.g. a black edge on white text). */
  outlineColor?: string;
  outlineWidth?: number;
}

/**
 * SVG <text> doesn't wrap or honor \n on its own - splits `text` on manually inserted
 * newlines (e.g. an admin breaking a long label into two lines) and renders one <tspan>
 * per line, each re-anchored to the same x so multi-line labels stay aligned/centered.
 *
 * react-native-svg has no paint-order, so a stroke on the text itself paints over the fill
 * and eats into the letters - the outline is drawn as a separate stroked copy underneath.
 */
export function MultilineSvgText({
  text,
  x,
  y,
  lineHeight,
  outlineColor,
  outlineWidth,
  ...rest
}: MultilineSvgTextProps) {
  // Trimmed so a stray space after an admin-inserted line break doesn't shift that line off-center.
  const lines = text.split(/\r\n|\r|\n/).map((line) => line.trim());
  const spans = lines.map((line, i) => (
    <TSpan key={i} x={x} dy={i === 0 ? 0 : lineHeight}>
      {line}
    </TSpan>
  ));

  if (!outlineColor || !outlineWidth) {
    return (
      <Text x={x} y={y} {...rest}>
        {spans}
      </Text>
    );
  }

  return (
    <G>
      <Text
        x={x}
        y={y}
        {...rest}
        fill={outlineColor}
        stroke={outlineColor}
        strokeWidth={outlineWidth}
        strokeLinejoin="round"
      >
        {spans}
      </Text>
      <Text x={x} y={y} {...rest} stroke="none">
        {spans}
      </Text>
    </G>
  );
}
