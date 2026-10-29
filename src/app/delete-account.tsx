import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';

import {
  cancelDeletion,
  confirmDeletion,
  DeletionError,
  getDeletionEligibility,
  getDeletionStatus,
  sendDeletionOtp,
  sendRestoreOtp,
  type DeletionEligibility,
  type DeletionResult,
  type DeletionStatus,
} from '@/core/api/account';
import { SUPPORT } from '@/core/api/support';
import { useAuth } from '@/core/auth/AuthContext';
import { Button } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { usePageInsets } from '@/ui/GlassTabBar';
import { Input } from '@/ui/Input';
import { Header, Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

// Port of the website's /delete-account (the page Google Play's Data safety
// form links to). The step is derived from the server's deletion status, so
// reopening the screen mid-flow lands on the right step.

const DELETED_DATA = [
  'Your name, email address and mobile number',
  'All saved delivery addresses',
  'Your cart and saved lists',
  'Notification subscriptions on every device',
  'Support chat history',
];

const RETAINED_DATA = ['Order and invoice records, including amounts and tax details', 'Payment and refund records'];

type Step = 'info' | 'otp' | 'restore_phone' | 'restore_otp' | 'done';

const onlyDigits = (v: string) => v.replace(/\D/g, '').slice(-10);

function sentToLine(channel: string | null, maskedMobile: string | null, maskedEmail: string | null) {
  if (channel === 'email') return `We sent a code to ${maskedEmail || 'your registered email'}.`;
  return `We sent a code to ${maskedMobile || 'your registered mobile number'}.`;
}

export default function DeleteAccountScreen() {
  const t = usePalette();
  const insets = usePageInsets();
  const toast = useToast();
  const { isLoggedIn, logout, refreshUser } = useAuth();

  const [eligibility, setEligibility] = useState<DeletionEligibility | null>(null);
  const [status, setStatus] = useState<DeletionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('info');
  const [reason, setReason] = useState('');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DeletionResult | null>(null);

  const refresh = useCallback(async () => {
    if (!isLoggedIn) return;
    const [s, e] = await Promise.allSettled([getDeletionStatus(), getDeletionEligibility()]);
    if (s.status === 'fulfilled') {
      setStatus(s.value);
      if (s.value.account_status === 'deactivated') {
        setStep((cur) => (cur === 'restore_otp' ? cur : 'restore_phone'));
      } else if (s.value.awaiting_otp) {
        setStep('otp');
      }
    }
    // Eligibility sits behind plain `authenticate`, so a deactivated account
    // gets a 403 here; that just leaves it null.
    setEligibility(e.status === 'fulfilled' ? e.value : null);
    setLoading(false);
  }, [isLoggedIn]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const maskedMobile = status?.masked_mobile || eligibility?.masked_mobile || null;
  const maskedEmail = status?.masked_email || eligibility?.masked_email || null;
  const hasMobile = status?.has_mobile ?? eligibility?.has_mobile ?? false;
  const mobileReady = !hasMobile || mobile.length === 10;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong. Please try again.', 'error');
      // A cooldown means a code is already on its way: the OTP step is where
      // the shopper needs to be.
      if (e instanceof DeletionError && e.code === 'OTP_COOLDOWN') {
        setStep((cur) => (cur === 'restore_phone' ? 'restore_otp' : cur === 'info' ? 'otp' : cur));
      }
    } finally {
      setBusy(false);
    }
  };

  const startRequest = () =>
    run(async () => {
      const res = await sendDeletionOtp({ reason: reason.trim(), mobile });
      setOtp('');
      setSentTo(res.delivered_to);
      setStep('otp');
      toast(sentToLine(res.delivered_to, res.masked_mobile, res.masked_email), 'info');
    });

  // No mobile: it was proved when the request was opened.
  const resend = () =>
    run(async () => {
      const res = await sendDeletionOtp({ reason: reason.trim() });
      setSentTo(res.delivered_to);
      toast(sentToLine(res.delivered_to, res.masked_mobile, res.masked_email), 'info');
    });

  const confirm = () =>
    run(async () => {
      const res = await confirmDeletion(otp.trim());
      setResult(res);
      setStep('done');
      // The account is deactivated; the session is only good for restoring now.
      await logout();
    });

  const abandonRequest = () =>
    run(async () => {
      const res = await cancelDeletion();
      setStep('info');
      setOtp('');
      setConfirmText('');
      toast(res.message || 'Deletion request cancelled', 'info');
      await refresh();
    });

  const startRestore = () =>
    run(async () => {
      const res = await sendRestoreOtp(mobile);
      setOtp('');
      setSentTo(res.delivered_to);
      setStep('restore_otp');
      toast(sentToLine(res.delivered_to, res.masked_mobile, res.masked_email), 'info');
    });

  const confirmRestore = () =>
    run(async () => {
      const res = await cancelDeletion(otp.trim());
      toast(res.message || 'Your account has been restored.', 'success');
      await refreshUser().catch(() => {});
      router.replace('/account');
    });

  const blockers = eligibility?.blockers ?? [];

  const mobileField = (
    <Input
      label="Confirm your registered mobile number"
      prefix="+91"
      placeholder="10-digit mobile number"
      keyboardType="number-pad"
      autoComplete="tel"
      maxLength={10}
      value={mobile}
      onChangeText={(v) => setMobile(onlyDigits(v))}
    />
  );
  const mobileHint = (
    <Text variant="caption" tone="muted">
      Must match the number on your account{maskedMobile ? ` (${maskedMobile})` : ''}. The code is sent to that number only.
    </Text>
  );
  const otpField = (
    <Input
      label="Verification code"
      placeholder="6-digit code"
      keyboardType="number-pad"
      autoComplete="one-time-code"
      textContentType="oneTimeCode"
      maxLength={6}
      value={otp}
      onChangeText={(v) => setOtp(v.replace(/\D/g, ''))}
      style={{ letterSpacing: 6 }}
    />
  );

  const action = () => {
    if (!isLoggedIn) {
      return (
        <>
          <Text>Log in to your ZillyBuy account to request deletion.</Text>
          <Button title="Log in to continue" onPress={() => router.push({ pathname: '/login', params: { next: '/delete-account' } })} />
        </>
      );
    }
    if (loading) return <Text tone="muted">Loading…</Text>;

    if (step === 'done') {
      return (
        <>
          <Banner icon="checkmark-circle" color={t.success} title="Request received" />
          <Text>{result?.message}</Text>
          {result?.mode === 'soft' && (
            <Text variant="caption" tone="muted">
              Changed your mind? Log in again before that date to restore your account.
            </Text>
          )}
          <Button title="Back to shopping" variant="glass" onPress={() => router.replace('/')} />
        </>
      );
    }

    if (step === 'restore_phone' || step === 'restore_otp') {
      return (
        <>
          <Banner icon="warning" color={t.warning} title="Deletion already scheduled" />
          <Text>
            {status?.days_remaining != null
              ? `Your account will be permanently deleted in ${status.days_remaining} day(s).`
              : 'Your account is scheduled for deletion.'}
          </Text>
          {step === 'restore_phone' ? (
            <>
              {hasMobile ? (
                <>
                  {mobileField}
                  {mobileHint}
                </>
              ) : (
                <Text tone="muted">We will send a verification code to {maskedEmail || 'your registered email'}.</Text>
              )}
              <Button title="Send verification code" icon="shield-checkmark" onPress={startRestore} loading={busy} disabled={!mobileReady} />
            </>
          ) : (
            <>
              {otpField}
              <Text variant="caption" tone="muted">
                {sentToLine(sentTo, maskedMobile, maskedEmail)}
              </Text>
              <Button title="Restore my account" icon="refresh" onPress={confirmRestore} loading={busy} disabled={otp.length < 4} />
              <Button title="Use a different number" variant="ghost" size="md" onPress={() => setStep('restore_phone')} disabled={busy} />
            </>
          )}
          <Button title="Log out" variant="ghost" size="md" onPress={() => logout().then(() => router.replace('/'))} disabled={busy} />
        </>
      );
    }

    if (step === 'otp') {
      return (
        <>
          {otpField}
          <Text variant="caption" tone="muted">
            {sentToLine(sentTo, maskedMobile, maskedEmail)} It is valid for 10 minutes.
          </Text>
          <Input
            label="Type DELETE to confirm"
            placeholder="DELETE"
            autoCapitalize="characters"
            autoCorrect={false}
            value={confirmText}
            onChangeText={setConfirmText}
          />
          <Button
            title="Delete my account"
            icon="trash"
            variant="danger"
            onPress={confirm}
            loading={busy}
            disabled={otp.length < 4 || confirmText.trim() !== 'DELETE'}
          />
          <View style={styles.row}>
            <Button title="Resend code" variant="ghost" size="md" onPress={resend} disabled={busy} style={{ flex: 1 }} />
            <Button title="Cancel request" variant="ghost" size="md" onPress={abandonRequest} disabled={busy} style={{ flex: 1 }} />
          </View>
        </>
      );
    }

    if (eligibility && !eligibility.can_request && blockers.length > 0) {
      return (
        <>
          <Banner icon="warning" color={t.warning} title="Not available yet" />
          {blockers.map((b) => (
            <Text key={b.code}>• {b.message}</Text>
          ))}
        </>
      );
    }

    return (
      <>
        <Input
          label="Why are you leaving? (optional)"
          placeholder="This helps us improve ZillyBuy."
          multiline
          maxLength={255}
          value={reason}
          onChangeText={setReason}
        />
        {hasMobile ? (
          <>
            {mobileField}
            {mobileHint}
          </>
        ) : (
          <Text tone="muted">We will send a verification code to {maskedEmail || 'your registered email'}.</Text>
        )}
        <Button
          title="Send verification code"
          icon="shield-checkmark"
          variant="danger"
          onPress={startRequest}
          loading={busy}
          disabled={!mobileReady}
        />
        <Text variant="caption" tone="faint">
          We will send a one-time code to your registered mobile number, or to your email if the SMS cannot be delivered.
        </Text>
      </>
    );
  };

  return (
    <Screen tabBar="account">
      <Header title="Delete account" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32 }}>
          <Glass radius={radius.lg} style={styles.card}>{action()}</Glass>

          <Glass radius={radius.lg} style={styles.card}>
            <Text variant="heading">What gets deleted</Text>
            {DELETED_DATA.map((d) => (
              <Text key={d} tone="muted">
                • {d}
              </Text>
            ))}
          </Glass>

          <Glass radius={radius.lg} style={styles.card}>
            <Text variant="heading">What we have to keep, and why</Text>
            {RETAINED_DATA.map((d) => (
              <Text key={d} tone="muted">
                • {d}
              </Text>
            ))}
            <Text variant="caption" tone="muted">
              Indian tax and company law require us to retain transaction records for up to 8 years. After your account is
              deleted they are no longer linked to your name, email or phone number.
            </Text>
          </Glass>

          <Glass radius={radius.lg} style={styles.card}>
            <Text variant="heading">How long it takes</Text>
            <Text tone="muted">
              Your account is deactivated immediately and permanently deleted after 30 days. During those 30 days you can log in
              and restore it. After that it cannot be recovered.
            </Text>
            <Text tone="muted">
              You cannot delete your account while an order is still being delivered or a refund is still open.
            </Text>
          </Glass>

          <Text variant="caption" tone="muted" style={{ textAlign: 'center' }}>
            Need help? Email{' '}
            <Text variant="caption" tone="primary" onPress={() => Linking.openURL(`mailto:${SUPPORT.email}`)}>
              {SUPPORT.email}
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Banner({ icon, color, title }: { icon: keyof typeof Ionicons.glyphMap; color: string; title: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={color} />
      <Text variant="heading" style={{ color }}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
