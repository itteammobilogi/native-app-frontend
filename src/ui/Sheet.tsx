import { useEffect, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from './Glass';
import { Text } from './Text';
import { radius, usePalette } from './theme';

// Height of the on-screen keyboard (0 when hidden). Measured by hand because
// KeyboardAvoidingView does nothing inside an Android Modal under edge-to-edge
// (SDK 57 default): the window no longer resizes, so the keyboard would cover
// the sheet. iOS gets the "will" events so the sheet moves with the keyboard.
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvt, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

// Bottom sheet: dimmed backdrop + frosted panel that sits above the keyboard.
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const keyboard = useKeyboardHeight();

  // With the keyboard up, the panel starts right above it (the keyboard
  // already covers the home-indicator inset) and may use what's left of the
  // screen below the status bar.
  const bottomPad = keyboard ? 16 : insets.bottom + 20;
  const maxHeight = windowHeight - keyboard - insets.top - 12;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, paddingBottom: keyboard }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,11,26,0.45)' }]} onPress={onClose} />
        <View style={{ flex: 1 }} pointerEvents="box-none" />
        <Glass strong radius={radius.xl} intensity={80} style={[styles.panel, { paddingBottom: bottomPad, maxHeight }]}>
          <View style={[styles.grabber, { backgroundColor: t.hairline }]} />
          {title && (
            <Text variant="title" style={{ marginBottom: 12 }}>
              {title}
            </Text>
          )}
          <View style={{ flexShrink: 1 }}>{children}</View>
        </Glass>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 20, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: 14 },
});
