import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import { updateProfile } from '@/core/api/auth';
import { errorMessage } from '@/core/api/client';
import { useAuth } from '@/core/auth/AuthContext';
import { Button } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { usePageInsets } from '@/ui/GlassTabBar';
import { Input } from '@/ui/Input';
import { Header, Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { radius } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

// Only name and date of birth are editable through /api/users/profile;
// mobile and email changes need the OTP flows on the website.
export default function ProfileEditScreen() {
  const insets = usePageInsets();
  const toast = useToast();
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [dob, setDob] = useState(user?.dob ? String(user.dob).slice(0, 10) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (name.trim().length < 2) return setError('Enter your full name');
    if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return setError('Use the format YYYY-MM-DD');
    setBusy(true);
    setError('');
    try {
      await updateProfile({ name: name.trim(), dob: dob || null });
      await refreshUser();
      toast('Profile updated', 'success');
      router.back();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen tabBar="account">
      <Header title="Edit profile" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32 }}>
        <Glass radius={radius.lg} style={{ padding: 16, gap: 14 }}>
          <Input label="Full name" value={name} onChangeText={setName} autoComplete="name" />
          <Input
            label="Date of birth (optional)"
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            value={dob}
            onChangeText={setDob}
            error={error}
          />
          <Input label="Mobile" value={user?.mobile ? `+91 ${user.mobile}` : '—'} editable={false} />
          <Input label="Email" value={user?.email ?? '—'} editable={false} />
          <Text variant="caption" tone="faint">
            To change your mobile number or email, use your account settings on zillybuy.com.
          </Text>
        </Glass>
        <Button title="Save" onPress={save} loading={busy} />
      </ScrollView>
    </Screen>
  );
}
