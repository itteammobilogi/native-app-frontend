import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WEBSITE_URL } from '@/core/config';
import { Button } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { Header, Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';

// Website: /about-us. Same copy and numbers; the website's decorative map
// and animations are left out.

type Icon = keyof typeof Ionicons.glyphMap;

const STATS = [
  { value: '1L+', label: 'Products' },
  { value: '10K+', label: 'Sellers' },
  { value: '26+', label: 'ONDC partners' },
];

const TRUST: { icon: Icon; title: string; text: string }[] = [
  { icon: 'shield-checkmark-outline', title: 'Verified sellers', text: '100% verified and trusted' },
  { icon: 'card-outline', title: 'Secure payments', text: '100% safe & secure' },
  { icon: 'car-outline', title: 'Fast delivery', text: 'Across India' },
  { icon: 'return-down-back-outline', title: 'Easy returns', text: '7 days return policy' },
];

const TIMELINE: { year: string; title: string; text: string }[] = [
  { year: '2024', title: 'Founded', text: 'The beginning of our journey' },
  { year: '2025', title: 'ONDC integration', text: 'Joined the open network' },
  { year: '2026', title: '1L+ products', text: 'Expanding choices for everyone' },
  { year: 'Future', title: 'Endless possibilities', text: 'Building the future of commerce' },
];

const WHY: { icon: Icon; title: string; text: string }[] = [
  { icon: 'ribbon-outline', title: 'Verified sellers', text: 'Every seller is verified to ensure trust and quality.' },
  { icon: 'pricetag-outline', title: 'Best prices', text: 'No hidden charges. Get the best value for your money.' },
  { icon: 'car-outline', title: 'Fast delivery', text: 'Quick and reliable delivery across thousands of cities.' },
  { icon: 'lock-closed-outline', title: 'Secure payments', text: 'Multiple secure payment options for worry-free shopping.' },
  { icon: 'return-down-back-outline', title: 'Easy returns', text: '7-day easy returns on most products.' },
  { icon: 'storefront-outline', title: 'Support local', text: 'Empowering Indian businesses through open commerce.' },
];

const STEPS: { icon: Icon; title: string; text: string }[] = [
  { icon: 'search-outline', title: 'Browse', text: 'Explore products from verified sellers across multiple categories.' },
  { icon: 'bag-handle-outline', title: 'Buy', text: 'Choose the right offer and place your order with a secure checkout.' },
  { icon: 'cube-outline', title: 'Get delivered', text: 'Receive your products at your doorstep quickly and safely.' },
];

const ONDC_POINTS = [
  'Open network without platform bias',
  'More choices, better prices',
  'Promotes fair competition',
  'Supports thousands of local businesses',
  'Building the future of digital India',
];

export default function AboutScreen() {
  const t = usePalette();
  const insets = useSafeAreaInsets();

  return (
    <Screen>
      <Header title="About ZillyBuy" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: insets.bottom + 32 }}>
        <LinearGradient colors={t.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text variant="tiny" tone="onPrimary" style={styles.tag}>
            ABOUT ZILLYBUY
          </Text>
          <Text variant="display" tone="onPrimary" style={{ fontSize: 28 }}>
            Powering open ecommerce for every Indian
          </Text>
          <Text tone="onPrimary" style={{ opacity: 0.9 }}>
            ZillyBuy connects buyers with verified sellers across India through the power of ONDC.
          </Text>
          <View style={styles.stats}>
            {STATS.map((s) => (
              <View key={s.label} style={{ flex: 1, alignItems: 'center' }}>
                <Text variant="title" tone="onPrimary">
                  {s.value}
                </Text>
                <Text variant="caption" tone="onPrimary" style={{ opacity: 0.85 }}>
                  {s.label}
                </Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={styles.grid}>
          {TRUST.map((x) => (
            <Glass key={x.title} radius={radius.lg} style={styles.gridItem}>
              <IconBubble icon={x.icon} />
              <Text variant="label">{x.title}</Text>
              <Text variant="caption" tone="muted">
                {x.text}
              </Text>
            </Glass>
          ))}
        </View>

        <Section tag="Our story" title="Building a more open and fair digital India">
          <Image source={{ uri: `${WEBSITE_URL}/assets/office-team.jpeg` }} style={styles.photo} contentFit="cover" transition={200} />
          <Text tone="muted">
            We connect buyers with verified sellers through ONDC, remove platform bias, encourage fair pricing, and make digital commerce
            easier for everyone.
          </Text>
          <View style={{ gap: 0, marginTop: 4 }}>
            {TIMELINE.map((s, i) => (
              <View key={s.year} style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ alignItems: 'center' }}>
                  <View style={[styles.node, { borderColor: t.primary }]} />
                  {i < TIMELINE.length - 1 && <View style={[styles.line, { backgroundColor: t.hairline }]} />}
                </View>
                <View style={{ paddingBottom: 14, flex: 1 }}>
                  <Text variant="label" tone="primary">
                    {s.year} · {s.title}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {s.text}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Section>

        <Section tag="Why ZillyBuy?" title="Built for buyers. Empowering sellers.">
          <View style={styles.grid}>
            {WHY.map((x) => (
              <Glass key={x.title} radius={radius.lg} style={styles.gridItem}>
                <IconBubble icon={x.icon} />
                <Text variant="label">{x.title}</Text>
                <Text variant="caption" tone="muted">
                  {x.text}
                </Text>
              </Glass>
            ))}
          </View>
        </Section>

        <Section tag="How it works" title="Shopping on ZillyBuy is simple">
          {STEPS.map((s, i) => (
            <Glass key={s.title} radius={radius.lg} style={styles.step}>
              <IconBubble icon={s.icon} size={48} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="heading">
                  {i + 1}. {s.title}
                </Text>
                <Text variant="caption" tone="muted">
                  {s.text}
                </Text>
              </View>
            </Glass>
          ))}
        </Section>

        <Section tag="What is ONDC?" title="Open Network for Digital Commerce">
          <Image source={{ uri: `${WEBSITE_URL}/assets/about-us-ondc.jpg` }} style={[styles.photo, { backgroundColor: '#fff' }]} contentFit="contain" transition={200} />
          <Text tone="muted">
            ONDC (Open Network for Digital Commerce) is a government-backed initiative that promotes an open and interoperable
            e-commerce network.
          </Text>
          {ONDC_POINTS.map((p) => (
            <View key={p} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <View style={[styles.dot, { backgroundColor: t.primary }]} />
              <Text style={{ flex: 1 }}>{p}</Text>
            </View>
          ))}
        </Section>

        <Glass radius={radius.xl} style={{ padding: 20, gap: 12 }}>
          <Text variant="title">Be a part of the open commerce revolution</Text>
          <Text tone="muted">Discover products from verified sellers across India.</Text>
          <Button title="Start shopping" icon="arrow-forward" onPress={() => router.replace('/')} />
          <Button title="Connect with us" variant="ghost" icon="people-outline" onPress={() => router.push('/connect')} />
        </Glass>
      </ScrollView>
    </Screen>
  );
}

function Section({ tag, title, children }: { tag: string; title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text variant="tiny" tone="primary" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
        {tag}
      </Text>
      <Text variant="title">{title}</Text>
      {children}
    </View>
  );
}

function IconBubble({ icon, size = 40 }: { icon: Icon; size?: number }) {
  const t = usePalette();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${t.primary}1A`, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.48} color={t.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: 20, gap: 12 },
  tag: { letterSpacing: 1.2, opacity: 0.85 },
  stats: { flexDirection: 'row', marginTop: 8, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.35)' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { flexBasis: '45%', flexGrow: 1, padding: 14, gap: 6 },
  photo: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.lg },
  node: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, marginTop: 4 },
  line: { width: 2, flex: 1, marginVertical: 2 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
