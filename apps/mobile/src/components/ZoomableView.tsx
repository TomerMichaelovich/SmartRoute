import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { he } from "@smartroute/core/i18n/he";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const BUTTON_STEP = 1.5;

function clamp(value: number, min: number, max: number): number {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

/**
 * Pinch-to-zoom / drag-to-pan / double-tap container for the store map. Zooming out
 * stops at 1x (the whole map fits), and panning is clamped so the content always
 * covers the frame. Single taps still reach the children (stop selection), since
 * none of the gestures activate on a plain tap.
 */
export function ZoomableView({ children }: { children: ReactNode }) {
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startFocalX = useSharedValue(0);
  const startFocalY = useSharedValue(0);

  function onLayout(e: LayoutChangeEvent) {
    width.value = e.nativeEvent.layout.width;
    height.value = e.nativeEvent.layout.height;
  }

  // Content is scaled around its center, so at scale s it overhangs the frame by
  // (s - 1) * size / 2 on each side - that's how far it may be dragged.
  function clampX(x: number, s: number): number {
    "worklet";
    const max = ((s - 1) * width.value) / 2;
    return clamp(x, -max, max);
  }
  function clampY(y: number, s: number): number {
    "worklet";
    const max = ((s - 1) * height.value) / 2;
    return clamp(y, -max, max);
  }

  /** Zooms to `next`, keeping the content point that was under (focalX, focalY) at start under the current focal point. */
  function zoomAround(
    next: number,
    focalX: number,
    focalY: number,
    fromScale: number,
    fromX: number,
    fromY: number,
  ) {
    "worklet";
    const cx = width.value / 2;
    const cy = height.value / 2;
    const ratio = next / fromScale;
    return {
      x: clampX(focalX - cx - ratio * (startFocalX.value - cx - fromX), next),
      y: clampY(focalY - cy - ratio * (startFocalY.value - cy - fromY), next),
    };
  }

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      startScale.value = scale.value;
      startX.value = translateX.value;
      startY.value = translateY.value;
      startFocalX.value = e.focalX;
      startFocalY.value = e.focalY;
    })
    .onUpdate((e) => {
      const next = clamp(startScale.value * e.scale, MIN_SCALE, MAX_SCALE);
      const t = zoomAround(
        next,
        e.focalX,
        e.focalY,
        startScale.value,
        startX.value,
        startY.value,
      );
      scale.value = next;
      translateX.value = t.x;
      translateY.value = t.y;
    });

  // One finger only - a two-finger drag is already handled by the pinch's moving focal point.
  const pan = Gesture.Pan()
    .maxPointers(1)
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      if (scale.value <= MIN_SCALE) return;
      translateX.value = clampX(startX.value + e.translationX, scale.value);
      translateY.value = clampY(startY.value + e.translationY, scale.value);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (scale.value > MIN_SCALE) {
        scale.value = withTiming(MIN_SCALE);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        return;
      }
      startFocalX.value = e.x;
      startFocalY.value = e.y;
      const t = zoomAround(
        DOUBLE_TAP_SCALE,
        e.x,
        e.y,
        scale.value,
        translateX.value,
        translateY.value,
      );
      scale.value = withTiming(DOUBLE_TAP_SCALE);
      translateX.value = withTiming(t.x);
      translateY.value = withTiming(t.y);
    });

  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  function zoomBy(factor: number) {
    const next = clamp(scale.value * factor, MIN_SCALE, MAX_SCALE);
    const ratio = next / scale.value;
    scale.value = withTiming(next);
    translateX.value = withTiming(clampX(translateX.value * ratio, next));
    translateY.value = withTiming(clampY(translateY.value * ratio, next));
  }

  const contentStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={styles.frame} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.content, contentStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
      <View style={styles.controls}>
        <Pressable
          style={styles.button}
          onPress={() => zoomBy(BUTTON_STEP)}
          accessibilityRole="button"
          accessibilityLabel={he.route.zoomIn}
          hitSlop={6}
        >
          <Text style={styles.buttonText}>+</Text>
        </Pressable>
        <Pressable
          style={styles.button}
          onPress={() => zoomBy(1 / BUTTON_STEP)}
          accessibilityRole="button"
          accessibilityLabel={he.route.zoomOut}
          hitSlop={6}
        >
          <Text style={styles.buttonText}>−</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    overflow: "hidden",
  },
  content: {
    flex: 1,
  },
  controls: {
    position: "absolute",
    bottom: 8,
    start: 8,
    gap: 6,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  buttonText: {
    fontSize: 20,
    lineHeight: 22,
    fontFamily: FONTS.bold,
    color: COLORS.neutral900,
  },
});
