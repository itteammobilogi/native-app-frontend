import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tap } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { Header, Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';

// Website: /connect (the official links page).
const LINKS: { title: string; subtitle: string; href: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  {
    title: 'Instagram',
    subtitle: 'Follow ZillyBuy on Instagram',
    href: 'https://www.instagram.com/zillybuy',
    icon: 'logo-instagram',
    color: '#E1306C',
  },
  { title: 'Facebook', subtitle: 'Like and follow on Facebook', href: 'https://www.facebook.com/zillybuy/', icon: 'logo-facebook', color: '#1877F2' },
  {
    title: 'LinkedIn',
    subtitle: 'Connect with ZillyBuy on LinkedIn',
    href: 'https://www.linkedin.com/company/110582913/',
    icon: 'logo-linkedin',
    color: '#0A66C2',
  },
  { title: 'X / Twitter', subtitle: 'Latest updates on X', href: 'https://x.com/Zillybuy_', icon: 'logo-x', color: '#111111' },
  { title: 'Leave a review', subtitle: 'Share your experience on Google', href: 'https://g.page/r/CYak7mkT-9C4EBM/review', icon: 'star', color: '#F5A623' },
];

export default function ConnectScreen() {
  const t = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Screen>
      <Header title="Connect with us" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 32 }}>
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 12 }}>
          <Image source={require('../../assets/brand/icon.png')} style={styles.logo} />
          <Text variant="title">ZillyBuy</Text>
          <Text tone="muted" style={{ textAlign: 'center' }}>
            Shop smarter. Stay connected. All our official links in one place.
          </Text>
        </View>
        {LINKS.map((l) => (
          <Pressable
            key={l.title}
            accessibilityRole="link"
            onPress={() => (tap(), Linking.openURL(l.href).catch(() => {}))}
            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
            <Glass radius={radius.lg} style={styles.row}>
              <View style={[styles.icon, { backgroundColor: l.color }]}>
                <Ionicons name={l.icon} size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="heading">{l.title}</Text>
                <Text variant="caption" tone="muted">
                  {l.subtitle}
                </Text>
              </View>
              <Ionicons name="open-outline" size={18} color={t.textFaint} />
            </Glass>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { width: 84, height: 84, borderRadius: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  icon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
