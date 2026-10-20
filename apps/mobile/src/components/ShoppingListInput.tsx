import { useEffect, useRef, useState } from "react";
import {
  I18nManager,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextLayoutLine,
  type TextStyle,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { he } from "@smartroute/core/i18n/he";
import { COLORS } from "@/constants/colors";

const CHECK_SIZE = 26;
const CHECK_GAP = 6;
// Kept clear on the side where Hebrew lines end, so the check never covers text.
const GUTTER = CHECK_SIZE + CHECK_GAP;

// Physical left in an RTL layout is the "end" edge (left/right get swapped in RTL).
const PHYSICAL_LEFT = I18nManager.isRTL ? "end" : "start";

type ShoppingListInputProps = Omit<TextInputProps, "value" | "onChangeText" | "multiline"> & {
  value: string;
  onChangeText: (text: string) => void;
};

function CheckIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={CHECK_SIZE} height={CHECK_SIZE}>
      <Circle cx={12} cy={12} r={12} fill={COLORS.green600} />
      <Path
        d="M7 12.5l3.2 3.2L17 9"
        fill="none"
        stroke={COLORS.white}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Multiline "one item per line" input that shows a green check at the end of
 * the line being typed. Tapping it moves to a fresh line, so finishing an item
 * doesn't require hunting for the keyboard's Enter key.
 *
 * TextInput doesn't expose where its lines end, so an invisible Text with the
 * same font and width mirrors the value and reports per-line widths via
 * onTextLayout. Lines are right-aligned, so a Hebrew line ends at
 * (content right edge - line width).
 */
export function ShoppingListInput({ value, onChangeText, style, onFocus, onBlur, onSelectionChange, onScroll, ...props }: ShoppingListInputProps) {
  const inputRef = useRef<TextInput>(null);
  const pendingCursor = useRef<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [cursor, setCursor] = useState(value.length);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [lines, setLines] = useState<TextLayoutLine[]>([]);
  const [scrollY, setScrollY] = useState(0);

  // Restore the caret once the parent has re-rendered with the inserted newline.
  useEffect(() => {
    if (pendingCursor.current === null) return;
    const next = pendingCursor.current;
    pendingCursor.current = null;
    inputRef.current?.setSelection(next, next);
  }, [value]);

  const flat = StyleSheet.flatten(style) ?? {};
  const borderWidth = Number(flat.borderWidth ?? 0);
  const padX = Number(flat.paddingHorizontal ?? flat.padding ?? 0);
  const padTop = Number(flat.paddingTop ?? flat.paddingVertical ?? flat.padding ?? 0);
  const contentLeft = borderWidth + padX + GUTTER;
  const contentRight = size.width - borderWidth - padX;
  const mirrorStyle: TextStyle = {
    fontSize: flat.fontSize,
    lineHeight: flat.lineHeight,
    fontFamily: flat.fontFamily,
    letterSpacing: flat.letterSpacing,
  };

  const caret = Math.min(cursor, value.length);
  const lineStart = caret === 0 ? 0 : value.lastIndexOf("\n", caret - 1) + 1;
  const newlineAt = value.indexOf("\n", caret);
  const lineEnd = newlineAt === -1 ? value.length : newlineAt;
  let lastChar = lineEnd - 1;
  while (lastChar >= lineStart && /\s/.test(value[lastChar])) lastChar--;

  // The visual (wrapped) line that holds the current item's last character.
  let checkLine: TextLayoutLine | null = null;
  if (focused && lastChar >= lineStart) {
    let offset = 0;
    for (const line of lines) {
      if (lastChar < offset + line.text.length) {
        checkLine = line;
        break;
      }
      offset += line.text.length;
    }
  }

  const checkLeft = checkLine ? Math.max(4, contentRight - checkLine.width - CHECK_GAP - CHECK_SIZE) : 0;
  const checkTop = checkLine ? borderWidth + padTop + checkLine.y + checkLine.height / 2 - CHECK_SIZE / 2 - scrollY : 0;
  const checkVisible = checkLine !== null && checkTop >= 0 && checkTop + CHECK_SIZE <= size.height;

  function handleNextLine() {
    // Reuse an empty line that already follows instead of stacking blank lines.
    const nextLineIsEmpty = value[lineEnd] === "\n" && (lineEnd + 1 === value.length || value[lineEnd + 1] === "\n");
    const nextCursor = lineEnd + 1;
    setCursor(nextCursor);
    if (nextLineIsEmpty) {
      inputRef.current?.setSelection(nextCursor, nextCursor);
      return;
    }
    pendingCursor.current = nextCursor;
    onChangeText(value.slice(0, lineEnd) + "\n" + value.slice(lineEnd));
  }

  return (
    <View
      style={styles.wrapper}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      <TextInput
        ref={inputRef}
        {...props}
        value={value}
        onChangeText={onChangeText}
        multiline
        style={[style, { [PHYSICAL_LEFT === "end" ? "paddingEnd" : "paddingStart"]: padX + GUTTER }]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        onSelectionChange={(e) => {
          setCursor(e.nativeEvent.selection.end);
          onSelectionChange?.(e);
        }}
        onScroll={(e) => {
          setScrollY(e.nativeEvent.contentOffset.y);
          onScroll?.(e);
        }}
      />

      {size.width > 0 && (
        <Text
          style={[
            mirrorStyle,
            styles.mirror,
            { top: borderWidth + padTop, [PHYSICAL_LEFT]: contentLeft, width: Math.max(0, contentRight - contentLeft) },
          ]}
          onTextLayout={(e) => setLines(e.nativeEvent.lines)}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {value}
        </Text>
      )}

      {checkVisible && (
        <Pressable
          onPress={handleNextLine}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={he.list.nextLine}
          style={[styles.check, { top: checkTop, [PHYSICAL_LEFT]: checkLeft }]}
        >
          <CheckIcon />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    overflow: "hidden",
  },
  mirror: {
    position: "absolute",
    color: "transparent",
  },
  check: {
    position: "absolute",
  },
});
