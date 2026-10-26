import { Image } from 'expo-image';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  forgotPassword,
  isEmail,
  isValidMobile,
  loginWithPassword,
  resetPassword,
  sendCheckoutOtp,
  verifyCheckoutOtp,
  verifyForgotOtp,
  type LoginResponse,
} from '@/core/api/auth';
import { errorMessage } from '@/core/api/client';
import { useAuth } from '@/core/auth/AuthContext';
import { Button, IconButton } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Glass } from '@/ui/Glass';
import { Input } from '@/ui/Input';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

type Mode = 'otp' | 'password' | 'forgot';

export default function LoginScreen() {
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { completeLogin } = useAuth();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [mode, setMode] = useState<Mode>('otp');

  const finish = async (res: LoginResponse) => {
    await completeLogin(res);
    // A deactivated account can still sign in, but only to restore itself.
    if (res.account_status === 'deactivated') {
      toast('This account is scheduled for deletion. Restore it to continue.', 'info');
      return router.replace('/delete-account');
    }
    toast(res.isNewUser ? 'Welcome to ZillyBuy!' : `Welcome back${res.user?.name ? `, ${res.user.name.split(' ')[0]}` : ''}!`, 'success');
    if (next) router.replace(next as Href);
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 24, flexGrow: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <IconButton icon="close" label="Close" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          </View>

          <View style={{ alignItems: 'center', marginTop: 12, marginBottom: 28, gap: 12 }}>
            <Glass radius={32} style={styles.logo}>
              <Image source={require('@/assets/brand/icon.png')} style={{ width: 84, height: 84 }} tintColor={t.text} contentFit="contain" />
            </Glass>
            <Text variant="display">
              {mode === 'forgot' ? 'Reset password' : 'Login or sign up'}
            </Text>
            <Text tone="muted" style={{ textAlign: 'center' }}>
              {mode === 'forgot'
                ? "We'll send an OTP to your registered mobile."
                : 'Shop from thousands of sellers on ONDC.'}
            </Text>
          </View>

          {mode !== 'forgot' && (
            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
              <Chip label="Mobile OTP" active={mode === 'otp'} onPress={() => setMode('otp')} />
              <Chip label="Password" active={mode === 'password'} onPress={() => setMode('password')} />
            </View>
          )}

          <Glass radius={radius.xl} style={{ padding: 20, gap: 16 }}>
            {mode === 'otp' && <OtpForm onDone={finish} />}
            {mode === 'password' && <PasswordForm onDone={finish} onForgot={() => setMode('forgot')} />}
            {mode === 'forgot' && <ForgotForm onDone={() => setMode('password')} />}
          </Glass>

          {mode === 'forgot' && (
            <Button title="Back to login" variant="ghost" onPress={() => setMode('password')} style={{ marginTop: 8 }} />
          )}

          <View style={{ flex: 1 }} />
          <Text variant="caption" tone="faint" style={{ textAlign: 'center', marginTop: 24 }}>
            By continuing you agree to ZillyBuy’s Terms of Use and Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function useCountdown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return [left, setLeft] as const;
}

// One-step login-or-signup by OTP (checkout-otp creates the account if needed).
function OtpForm({ onDone }: { onDone: (r: LoginResponse) => Promise<void> }) {
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [left, setLeft] = useCountdown();

  const send = async () => {
    if (!isValidMobile(mobile)) return setError('Enter a valid 10-digit mobile number');
    setBusy(true);
    setError('');
    try {
      await sendCheckoutOtp(mobile);
      setSent(true);
      setLeft(30); // server enforces a 30s resend cooldown
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(otp)) return setError('Enter the 6-digit OTP');
    setBusy(true);
    setError('');
    try {
      await onDone(await verifyCheckoutOtp({ mobile, otp }));
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <>
      <Input
        label="Mobile number"
        prefix="+91"
        icon="call-outline"
        keyboardType="phone-pad"
        maxLength={10}
        value={mobile}
        onChangeText={(v) => {
          setMobile(v.replace(/\D/g, ''));
          if (sent) setSent(false);
        }}
        placeholder="10-digit number"
        autoComplete="tel"
        textContentType="telephoneNumber"
        error={!sent ? error : undefined}
      />
      {sent && (
        <Input
          label="OTP"
          icon="keypad-outline"
          keyboardType="number-pad"
          maxLength={6}
          value={otp}
          onChangeText={(v) => setOtp(v.replace(/\D/g, ''))}
          placeholder="6-digit code"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          autoFocus
          error={error}
          onSubmitEditing={verify}
        />
      )}
      {sent ? (
        <>
          <Button title="Verify & continue" onPress={verify} loading={busy} />
          <Button
            title={left > 0 ? `Resend OTP in ${left}s` : 'Resend OTP'}
            variant="ghost"
            size="md"
            disabled={left > 0 || busy}
            onPress={send}
          />
        </>
      ) : (
        <Button title="Get OTP" onPress={send} loading={busy} />
      )}
    </>
  );
}

function PasswordForm({ onDone, onForgot }: { onDone: (r: LoginResponse) => Promise<void>; onForgot: () => void }) {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!isEmail(id) && !isValidMobile(id)) return setError('Enter your mobile number or email');
    if (!password) return setError('Enter your password');
    setBusy(true);
    setError('');
    try {
      await onDone(await loginWithPassword(id, password));
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <>
      <Input
        label="Mobile or email"
        icon="person-outline"
        autoCapitalize="none"
        keyboardType="email-address"
        value={id}
        onChangeText={setId}
        placeholder="Mobile number or email"
        autoComplete="username"
      />
      <Input
        label="Password"
        icon="lock-closed-outline"
        secure
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
        autoComplete="current-password"
        error={error}
        onSubmitEditing={submit}
      />
      <Text variant="label" tone="primary" onPress={onForgot} style={{ alignSelf: 'flex-end' }} suppressHighlighting>
        Forgot password?
      </Text>
      <Button title="Login" onPress={submit} loading={busy} />
    </>
  );
}

function ForgotForm({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [step, setStep] = useState<'mobile' | 'otp' | 'password'>('mobile');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (step === 'mobile') {
    return (
      <>
        <Input
          label="Registered mobile"
          prefix="+91"
          keyboardType="phone-pad"
          maxLength={10}
          value={mobile}
          onChangeText={(v) => setMobile(v.replace(/\D/g, ''))}
          error={error}
        />
        <Button
          title="Send OTP"
          loading={busy}
          onPress={() =>
            isValidMobile(mobile)
              ? run(async () => {
                  await forgotPassword(mobile);
                  setStep('otp');
                })
              : setError('Enter a valid 10-digit mobile number')
          }
        />
      </>
    );
  }
  if (step === 'otp') {
    return (
      <>
        <Input
          label="OTP"
          keyboardType="number-pad"
          maxLength={6}
          value={otp}
          onChangeText={(v) => setOtp(v.replace(/\D/g, ''))}
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          autoFocus
          error={error}
        />
        <Button
          title="Verify OTP"
          loading={busy}
          onPress={() =>
            run(async () => {
              const r = await verifyForgotOtp(otp);
              setToken(r.reset_token);
              setStep('password');
            })
          }
        />
      </>
    );
  }
  return (
    <>
      <Input label="New password" secure value={password} onChangeText={setPassword} autoFocus error={error} autoComplete="new-password" />
      <Button
        title="Update password"
        loading={busy}
        onPress={() =>
          password.length < 6
            ? setError('Use at least 6 characters')
            : run(async () => {
                await resetPassword(token, password);
                toast('Password updated. Please login.', 'success');
                onDone();
              })
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  logo: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
});
