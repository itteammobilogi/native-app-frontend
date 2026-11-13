import { StyleSheet, View } from 'react-native';

import { usePalette } from './theme';

// The plain page colour behind every screen.
export function Background() {
  const t = usePalette();
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: t.background[0] }]} pointerEvents="none" />;
}
