import type { Ref } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, type ScrollViewProps } from "react-native";

/**
 * ScrollView that shrinks above the on-screen keyboard. The app is edge-to-edge
 * on Android (mandatory since Expo SDK 54), so the window no longer resizes for
 * the keyboard and inputs low on the screen would end up hidden behind it.
 * Once the scroll area ends at the keyboard, Android's own "keep the caret
 * visible" scrolling works again.
 */
export function KeyboardAwareScrollView({ ref, ...props }: ScrollViewProps & { ref?: Ref<ScrollView> }) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView ref={ref} keyboardShouldPersistTaps="handled" {...props} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
