import { Text, TSpan, type TextProps } from "react-native-svg";

interface MultilineSvgTextProps extends TextProps {
  text: string;
  x: number;
  y: number;
  lineHeight: number;
}

/**
 * SVG <text> doesn't wrap or honor \n on its own - splits `text` on manually inserted
 * newlines (e.g. an admin breaking a long label into two lines) and renders one <tspan>
 * per line, each re-anchored to the same x so multi-line labels stay aligned/centered.
 */
export function MultilineSvgText({ text, x, y, lineHeight, ...rest }: MultilineSvgTextProps) {
  const lines = text.split(/\r\n|\r|\n/);
  return (
    <Text x={x} y={y} {...rest}>
      {lines.map((line, i) => (
        <TSpan key={i} x={x} dy={i === 0 ? 0 : lineHeight}>
          {line}
        </TSpan>
      ))}
    </Text>
  );
}
