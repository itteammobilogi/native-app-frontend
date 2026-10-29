import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/core/auth/AuthContext';
import { errorMessage } from '@/core/api/client';
import { FAQ, POLICIES, sendContactMessage, SUPPORT, type PolicySlug } from '@/core/api/support';
import { Button, tap } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { usePageInsets } from '@/ui/GlassTabBar';
import { Input } from '@/ui/Input';
import { Header, Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Help & support (website: /contact-us). `order` pre-fills the message when
// opened from an order's "Need help?".
export default function SupportScreen() {
  const t = usePalette();
  const insets = usePageInsets();
  const toast = useToast();
  const { user, isLoggedIn } = useAuth();
  const { order } = useLocalSearchParams<{ order?: string }>();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [message, setMessage] = useState(order ? `Order ${order}: ` : '');
  const [errors, setErrors] = useState<{ name?: string; email?: string; message?: string }>({});
  const [busy, setBusy] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  const open = (url: string) => Linking.openURL(url).catch(() => toast('Could not open that app on this phone.', 'error'));

  const submit = async () => {
    const next = {
      name: name.trim() ? undefined : 'Please enter your name.',
      email: EMAIL_RE.test(email.trim()) ? undefined : 'Please enter a valid email.',
      message: message.trim().length >= 10 ? undefined : 'Please tell us a little more (10+ characters).',
    };
    setErrors(next);
    if (next.name || next.email || next.message) return;
    setBusy(true);
    try {
      const res = await sendContactMessage({
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        ...(user?.id ? { user_id: user.id } : {}),
      });
      toast(res?.message || 'Thanks! Our team will get back to you within 24 hours.', 'success');
      setMessage('');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const actions: { icon: keyof typeof Ionicons.glyphMap; label: string; hint: string; onPress: () => void }[] = [
    { icon: 'call', label: 'Call us', hint: SUPPORT.phone, onPress: () => open(SUPPORT.phoneHref) },
    { icon: 'logo-whatsapp', label: 'WhatsApp', hint: 'Chat with us', onPress: () => open(SUPPORT.whatsappHref) },
    { icon: 'mail', label: 'Email', hint: SUPPORT.email, onPress: () => open(`mailto:${SUPPORT.email}`) },
    {
      icon: 'receipt',
      label: 'My orders',
      hint: 'Track, cancel, return',
      onPress: () => router.push((isLoggedIn ? '/orders' : '/login') as Href),
    },
    { icon: 'chatbubbles', label: 'My tickets', hint: 'Chat about an order', onPress: () => router.push('/tickets') },
    { icon: 'sparkles', label: 'Ask Zilly AI', hint: 'Instant answers', onPress: () => router.push('/assistant') },
  ];

  return (
    <Screen tabBar="account">
      <Header title="Help & support" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <LinearGradient colors={t.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="headset" size={26} color="#fff" />
            </View>
            <Text variant="title" tone="onPrimary">
              How can we help{user?.name ? `, ${user.name.split(' ')[0]}` : ''}?
            </Text>
            <View style={styles.hours}>
              <View style={styles.liveDot} />
              <Text variant="caption" tone="onPrimary">
                {SUPPORT.hours} · replies within 24 hours
              </Text>
            </View>
          </LinearGradient>

          {/* Quick actions */}
          <View style={styles.grid}>
            {actions.map((a) => (
              <Pressable
                key={a.label}
                accessibilityRole="button"
                onPress={() => (tap(), a.onPress())}
                style={({ pressed }) => [styles.gridItem, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
                <Glass radius={radius.lg} style={styles.action}>
                  <View style={[styles.actionIcon, { backgroundColor: `${t.primary}14` }]}>
                    <Ionicons name={a.icon} size={20} color={t.primary} />
                  </View>
                  <Text variant="label">{a.label}</Text>
                  <Text variant="tiny" tone="muted" numberOfLines={1}>
                    {a.hint}
                  </Text>
                </Glass>
              </Pressable>
            ))}
          </View>

          {/* FAQ */}
          <View style={{ gap: 8 }}>
            <SectionLabel>Frequently asked</SectionLabel>
            <Glass radius={radius.lg} style={{ paddingVertical: 4 }}>
              {FAQ.map((f, i) => {
                const isOpen = openFaq === i;
                return (
                  <Pressable
                    key={f.q}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen }}
                    onPress={() => (tap(), setOpenFaq(isOpen ? -1 : i))}
                    style={[styles.faq, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.hairline }]}>
                    <View style={styles.faqHead}>
                      <Text variant="label" style={{ flex: 1 }}>
                        {f.q}
                      </Text>
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={t.textFaint} />
                    </View>
                    {isOpen && (
                      <Text tone="muted" style={{ fontSize: 14, lineHeight: 20 }}>
                        {f.a}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </Glass>
          </View>

          {/* Contact form */}
          <View style={{ gap: 8 }}>
            <SectionLabel>Send us a message</SectionLabel>
            <Glass radius={radius.lg} style={{ padding: 16, gap: 12 }}>
              <Input label="Name" icon="person-outline" value={name} onChangeText={setName} error={errors.name} autoComplete="name" />
              <Input
                label="Email"
                icon="mail-outline"
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <Input
                label="How can we help?"
                value={message}
                onChangeText={setMessage}
                error={errors.message}
                multiline
                maxLength={2000}
                placeholder="Tell us about your question or issue"
              />
              <Button title="Send message" icon="paper-plane" onPress={submit} loading={busy} />
            </Glass>
          </View>

          {/* Policies */}
          <View style={{ gap: 8 }}>
            <SectionLabel>Policies</SectionLabel>
            <Glass radius={radius.lg} style={{ paddingVertical: 4 }}>
              {(['return-policies', 'refund-cancellation-policies', 'shipping-policies'] as PolicySlug[]).map((slug, i) => (
                <Pressable
                  key={slug}
                  onPress={() => (tap(), router.push({ pathname: '/policy/[slug]', params: { slug } }))}
                  style={({ pressed }) => [
                    styles.row,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.hairline },
                    pressed && { backgroundColor: t.hairline },
                  ]}>
                  <Ionicons name="document-text-outline" size={18} color={t.primary} />
                  <Text variant="label" style={{ flex: 1 }}>
                    {POLICIES[slug]}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={t.textFaint} />
                </Pressable>
              ))}
            </Glass>
          </View>

          {/* Office */}
          <Pressable onPress={() => open(SUPPORT.mapsHref)}>
            <Glass radius={radius.lg} style={[styles.row, { alignItems: 'flex-start', padding: 16 }]}>
              <Ionicons name="location" size={20} color={t.primary} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="label">Our office</Text>
                <Text variant="caption" tone="muted" style={{ lineHeight: 18 }}>
                  {SUPPORT.address}
                </Text>
                <Text variant="caption" tone="primary">
                  Open in Maps
                </Text>
              </View>
            </Glass>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text variant="caption" tone="muted" style={{ marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: 20, gap: 10 },
  heroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  hours: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  gridItem: { width: '50%', padding: 5 },
  action: { padding: 14, gap: 4 },
  actionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  faq: { paddingHorizontal: 14, paddingVertical: 13, gap: 8 },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
});
