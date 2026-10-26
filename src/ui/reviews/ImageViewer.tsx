import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/ui/Button';
import { Text } from '@/ui/Text';

// Full-screen swipeable photo viewer (review photos).
export function ImageViewer({ images, index, onClose }: { images: string[]; index: number | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(index ?? 0);

  return (
    <Modal visible={index !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent onShow={() => setCurrent(index ?? 0)}>
      <View style={styles.backdrop}>
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          initialScrollIndex={index ?? 0}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(u, i) => `${u}-${i}`}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <Pressable onPress={onClose} style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={{ uri: item }} style={{ width: width - 24, height: height * 0.75 }} contentFit="contain" transition={150} />
            </Pressable>
          )}
        />
        <View style={[styles.top, { top: insets.top + 8 }]}>
          {images.length > 1 ? (
            <Text variant="label" tone="onPrimary">
              {current + 1} / {images.length}
            </Text>
          ) : (
            <View />
          )}
          <IconButton icon="close" label="Close" color="#fff" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
