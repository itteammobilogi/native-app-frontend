import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PolicySlug } from '@/core/api/support';
import { useAuth } from '@/core/auth/AuthContext';
import { getPushStatus, openNotificationSettings, syncPush } from '@/core/push';
import { Button, tap } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
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
    <Screen>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, padding: 16, gap: 16, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 32 }}>
        <Text variant="display">Account</Text>

        {isLoggedIn && user ? (
          <Glass radius={radius.xl} style={styles.profile}>
            <LinearGradient colors={t.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
              <Text variant="title" tone="onPrimary">
                {initials}
              </Text>
            </LinearGradient>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="heading" numberOfLines={1}>
                {user.name || 'ZillyBuy shopper'}
              </Text>
              {!!user.mobile && (
                <Text variant="caption" tone="muted">
                  +91 {user.mobile}
                </Text>
              )}
              {!!user.email && (
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {user.email}
                </Text>
              )}
            </View>
            <Pressable hitSlop={8} onPress={go('/profile-edit')} accessibilityLabel="Edit profile">
              <Ionicons name="create-outline" size={22} color={t.primary} />
            </Pressable>
          </Glass>
        ) : (
          <Glass radius={radius.xl} style={{ padding: 20, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <LinearGradient colors={t.primaryGradient} style={styles.avatar}>
                <Ionicons name="person" size={26} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text variant="heading">Welcome to ZillyBuy</Text>
                <Text variant="caption" tone="muted">
                  Login to track orders, save addresses and check out faster.
                </Text>
              </View>
            </View>
            <Button title="Login or sign up" onPress={() => router.push('/login')} />
          </Glass>
        )}

        {isLoggedIn && <Menu title="Shopping" items={shopping} />}
        <Menu title="Discover" items={discover} />
        <Menu title="Support" items={support} />

        {isLoggedIn && <Button title="Log out" icon="log-out-outline" variant="glass" onPress={confirmLogout} />}

        <Text variant="caption" tone="faint" style={{ textAlign: 'center' }}>
          ZillyBuy v{Constants.expoConfig?.version ?? '1.0.0'} · Powered by ONDC
        </Text>
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

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  itemIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
