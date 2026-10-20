import { useEffect, useRef, type ReactNode } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;

function clamp(value: number, min: number, max: number): number {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

/** The drawing's on-screen size at scale 1, letterboxed inside a w x h frame. */
function bandSize(w: number, h: number, aspect: number): { w: number; h: number } {
  "worklet";
  return { w: Math.min(w, h * aspect), h: Math.min(h, w / aspect) };
}

interface ZoomableViewProps {
  children: ReactNode;
  /** Width/height of what the children draw, centered in the frame (e.g. an SVG letterboxed by
   * its viewBox). Lets panning stop at the drawing's edges rather than the frame's. */
  contentAspect: number;
  /** Start zoomed so the drawing covers the whole frame (a letterboxed map would leave much of a
   * tall frame empty). Pinching out still reaches the whole drawing. */
  cover?: boolean;
  /** Point of the drawing (0-1 fractions) to center on when covering. */
  focus?: { x: number; y: number };
}

/**
 * Pinch-to-zoom / drag-to-pan / double-tap container for the store map. Zooming out stops at
 * the whole drawing, and panning is clamped so the drawing always fills as much of the frame
 * as it can. Single taps still reach the children
 * (stop selection), since none of the gestures activate on a plain tap.
 */
export function ZoomableView({ children, contentAspect, cover = false, focus }: ZoomableViewProps) {
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  // Where the view starts and double-tap returns to: 1 (whole drawing) or covering the frame.
  const baseScale = useSharedValue(1);
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startFocalX = useSharedValue(0);
  const startFocalY = useSharedValue(0);

  // The frame size as last laid out, for JS-side math: a shared value written on the JS thread
  // only updates (on the UI thread) asynchronously, so reading it straight back can be stale.
  const frameRef = useRef({ w: 0, h: 0 });

  // Scaled around the frame's center, the drawing overhangs the frame by (size*s - frame)/2 on
  // each side - that's how far it may be dragged (never less than 0).
  function clampX(x: number, s: number): number {
    "worklet";
    const bandW = bandSize(width.value, height.value, contentAspect).w;
    const max = Math.max(0, (bandW * s - width.value) / 2);
    return clamp(x, -max, max);
  }
  function clampY(y: number, s: number): number {
    "worklet";
    const bandH = bandSize(width.value, height.value, contentAspect).h;
    const max = Math.max(0, (bandH * s - height.value) / 2);
    return clamp(y, -max, max);
  }

  function applyLayout() {
    const { w, h } = frameRef.current;
    width.value = w;
    height.value = h;
    if (w === 0 || h === 0) return;
    const { w: bandW, h: bandH } = bandSize(w, h, contentAspect);
    const base = cover ? Math.max(w / bandW, h / bandH) : 1;
    // Center the focus point: at scale 1 it sits (f - 0.5) * band from the frame's center.
    const dx = focus ? (focus.x - 0.5) * bandW : 0;
    const dy = focus ? (focus.y - 0.5) * bandH : 0;
    const maxX = Math.max(0, (bandW * base - w) / 2);
    const maxY = Math.max(0, (bandH * base - h) / 2);
    baseScale.value = base;
    scale.value = base;
    translateX.value = clamp(-dx * base, -maxX, maxX);
    translateY.value = clamp(-dy * base, -maxY, maxY);
  }

  function onLayout(e: LayoutChangeEvent) {
    frameRef.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
    applyLayout();
  }

  // Switching between the inline and full-screen map, or moving on to the next stop, re-fits
  // and re-centers it.
  useEffect(() => {
    applyLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cover, focus?.x, focus?.y]);

  /** Zooms to `next`, keeping the content point that was under (focalX, focalY) at start under the current focal point. */
  function zoomAround(next: number, focalX: number, focalY: number, fromScale: number, fromX: number, fromY: number) {
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
      const next = clamp(startScale.value * e.scale, 1, baseScale.value * MAX_ZOOM);
      const t = zoomAround(next, e.focalX, e.focalY, startScale.value, startX.value, startY.value);
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
      translateX.value = clampX(startX.value + e.translationX, scale.value);
      translateY.value = clampY(startY.value + e.translationY, scale.value);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (scale.value > baseScale.value * 1.01) {
        scale.value = withTiming(baseScale.value);
        translateX.value = withTiming(clampX(translateX.value, baseScale.value));
        translateY.value = withTiming(clampY(translateY.value, baseScale.value));
        return;
      }
      const next = baseScale.value * DOUBLE_TAP_ZOOM;
      startFocalX.value = e.x;
      startFocalY.value = e.y;
      const t = zoomAround(next, e.x, e.y, scale.value, translateX.value, translateY.value);
      scale.value = withTiming(next);
      translateX.value = withTiming(t.x);
      translateY.value = withTiming(t.y);
    });

  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <View style={styles.frame} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.content, contentStyle]}>{children}</Animated.View>
      </GestureDetector>
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
});
