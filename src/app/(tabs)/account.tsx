import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PolicySlug } from '@/core/api/support';
import { useAuth } from '@/core/auth/AuthContext';
import { setThemeMode, useThemeMode, type ThemeMode } from '@/core/themePref';
import { getPushStatus, openNotificationSettings, syncPush } from '@/core/push';
import { Button, tap } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { PoweredByOndc } from '@/ui/Logo';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { radius, TAB_BAR_HEIGHT, usePalette } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

type Item = { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; hint?: string };

export default function AccountScreen() {
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const { user, isLoggedIn, logout } = useAuth();
  const toast = useToast();

  const go = (href: Href) => () => router.push(href);

  const shopping: Item[] = [
    { icon: 'receipt-outline', label: 'My orders', onPress: go('/orders') },
    { icon: 'location-outline', label: 'Saved addresses', onPress: go('/addresses') },
    { icon: 'person-outline', label: 'Edit profile', onPress: go('/profile-edit') },
    { icon: 'notifications-outline', label: 'Notifications', onPress: go('/notifications') },
    { icon: 'chatbubbles-outline', label: 'Support tickets', onPress: go('/tickets') },
    // Invite-only, like the website's account sidebar.
    ...(user?.affiliate_status && user.affiliate_status !== 'none'
      ? [{ icon: 'people-outline' as const, label: 'Affiliate', onPress: go('/affiliate') }]
      : []),
  ];
  const policy = (slug: PolicySlug) => go({ pathname: '/policy/[slug]', params: { slug } });

  const discover: Item[] = [
    { icon: 'heart-outline', label: 'My wishlist', onPress: go('/wishlist') },
    { icon: 'flag-outline', label: 'NavBharat · Made in India', onPress: go('/navbharat') },
    { icon: 'pricetags-outline', label: 'Shop by brand', onPress: go('/brands') },
    { icon: 'gift-outline', label: 'ZillyCart combos', onPress: go('/combos') },
    { icon: 'newspaper-outline', label: 'Blog', onPress: go('/blogs') },
  ];
  const notifications = async () => {
    const status = await getPushStatus();
    if (status === 'denied') return openNotificationSettings();
    if (status === 'unavailable') return toast('Notifications are not available on this device.', 'info');
    const next = await syncPush({ prompt: true });
    if (next === 'granted') toast('Notifications are on. We’ll keep you posted on orders and offers.', 'success');
  };

  const support: Item[] = [
    { icon: 'notifications-circle-outline', label: 'Push notifications', onPress: notifications },
    { icon: 'help-circle-outline', label: 'Help & support', onPress: go('/support') },
    { icon: 'return-down-back-outline', label: 'Returns & refunds', onPress: policy('return-policies') },
    { icon: 'document-text-outline', label: 'Terms & conditions', onPress: policy('terms-and-conditions') },
    { icon: 'lock-closed-outline', label: 'Privacy policy', onPress: policy('privacy-policy') },
    { icon: 'information-circle-outline', label: 'About ZillyBuy', onPress: go('/about') },
    { icon: 'share-social-outline', label: 'Connect with us', onPress: go('/connect') },
    { icon: 'trash-outline', label: 'Delete account', onPress: go('/delete-account') },
  ];

  const confirmLogout = () =>
    Alert.alert('Log out?', 'You can log back in any time with your mobile number.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);

  const initials = (user?.name || user?.mobile || '?')
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Screen statusBar="light">
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 32 }}>
        {/* Blue header with the profile */}
        <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: t.dark ? '#0B4A99' : t.primary }]}>
          <View pointerEvents="none" style={styles.ring} />
          <Text variant="title" tone="onPrimary">
            Account
          </Text>
          {isLoggedIn && user ? (
            <View style={styles.profile}>
              <View style={styles.avatar}>
                <Text variant="title" style={{ color: '#0066CC' }}>
                  {initials}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="heading" tone="onPrimary" numberOfLines={1}>
                  {user.name || 'ZillyBuy shopper'}
                </Text>
                {!!user.mobile && (
                  <Text variant="caption" style={{ color: 'rgba(255,255,255,0.85)' }}>
                    +91 {user.mobile}
                  </Text>
                )}
                {!!user.email && (
                  <Text variant="caption" numberOfLines={1} style={{ color: 'rgba(255,255,255,0.85)' }}>
                    {user.email}
                  </Text>
                )}
              </View>
              <Pressable hitSlop={8} onPress={go('/profile-edit')} accessibilityLabel="Edit profile" style={styles.editBtn}>
                <Ionicons name="create-outline" size={18} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <View style={styles.profile}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={26} color="#0066CC" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="heading" tone="onPrimary">
                    Welcome to ZillyBuy
                  </Text>
                  <Text variant="caption" style={{ color: 'rgba(255,255,255,0.85)' }}>
                    Login to track orders, save addresses and check out faster.
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => (tap(), router.push('/login'))} style={styles.loginBtn}>
                <Text variant="label" style={{ color: '#0066CC' }}>
                  Login or sign up
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={{ padding: 16, gap: 16 }}>
        {isLoggedIn && <Menu title="Shopping" items={shopping} />}
        <Menu title="Discover" items={discover} />
        <Menu title="Support" items={support} />
        <AppearancePicker />

        {isLoggedIn && <Button title="Log out" icon="log-out-outline" variant="glass" onPress={confirmLogout} />}

        <PoweredByOndc style={{ marginTop: 8 }} />
        <Text variant="caption" tone="faint" style={{ textAlign: 'center' }}>
          ZillyBuy v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Menu({ title, items }: { title: string; items: Item[] }) {
  const t = usePalette();
  return (
    <View style={{ gap: 8 }}>
      <Text variant="caption" tone="muted" style={{ marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {title}
      </Text>
      <Glass radius={radius.lg} style={{ paddingVertical: 4 }}>
        {items.map((it, i) => (
          <Pressable
            key={it.label}
            onPress={() => (tap(), it.onPress())}
            style={({ pressed }) => [
              styles.item,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.hairline },
              pressed && { backgroundColor: t.hairline },
            ]}>
            <View style={[styles.itemIcon, { backgroundColor: `${t.primary}14` }]}>
              <Ionicons name={it.icon} size={18} color={t.primary} />
            </View>
            <Text variant="label" style={{ flex: 1, fontSize: 15 }}>
              {it.label}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={t.textFaint} />
          </Pressable>
        ))}
      </Glass>
    </View>
  );
}

// Light / dark / follow the phone.
function AppearancePicker() {
  const t = usePalette();
  const mode = useThemeMode();
  const options: [ThemeMode, string, keyof typeof Ionicons.glyphMap][] = [
    ['system', 'System', 'phone-portrait-outline'],
    ['light', 'Light', 'sunny-outline'],
    ['dark', 'Dark', 'moon-outline'],
  ];
  return (
    <View style={{ gap: 8 }}>
      <Text variant="caption" tone="muted" style={{ marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>
        Appearance
      </Text>
      <View style={[styles.segment, { backgroundColor: t.tileFill }]}>
        {options.map(([value, label, icon]) => {
          const on = mode === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => (tap(), setThemeMode(value))}
              style={[styles.segItem, on && { backgroundColor: t.glassFill, borderColor: t.glassBorder, borderWidth: 1 }]}>
              <Ionicons name={icon} size={16} color={on ? t.primary : t.textMuted} />
              <Text variant="caption" style={{ fontWeight: on ? '700' : '500', color: on ? t.primary : t.textMuted }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 18, gap: 14, overflow: 'hidden' },
  ring: { position: 'absolute', width: 220, height: 220, top: -90, right: -60, borderRadius: 999, borderWidth: 22, borderColor: 'rgba(255,255,255,0.06)' },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  editBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  loginBtn: { height: 46, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', padding: 4, borderRadius: 14, gap: 4 },
  segItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  itemIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
