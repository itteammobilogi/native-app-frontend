import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createAddress, getAddress, lookupPincode, updateAddress, type AddressInput } from '@/core/api/address';
import { errorMessage } from '@/core/api/client';
import { useAuth } from '@/core/auth/AuthContext';
import { Button } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { Input } from '@/ui/Input';
import { Header, Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

type Form = Required<Pick<AddressInput, 'name' | 'phone' | 'city' | 'state' | 'country'>> & {
  house_name: string;
  building: string;
  locality: string;
  area_code: string;
  email: string;
  is_default: boolean;
};

const EMPTY: Form = {
  name: '',
  phone: '',
  house_name: '',
  building: '',
  locality: '',
  area_code: '',
  city: '',
  state: '',
  country: 'India',
  email: '',
  is_default: false,
};

// Same rules the server applies on edit (controllers/userController.js).
function validate(f: Form) {
  const e: Partial<Record<keyof Form, string>> = {};
  if (f.name.trim().length < 2) e.name = 'Enter the full name';
  if (!/^\d{10}$/.test(f.phone.replace(/\D/g, ''))) e.phone = 'Enter a 10-digit mobile number';
  if (!f.house_name.trim()) e.house_name = 'Enter house / flat number';
  if (!/^\d{6}$/.test(f.area_code)) e.area_code = 'Enter a 6-digit pincode';
  if (!f.city.trim()) e.city = 'Enter the city';
  if (!f.state.trim()) e.state = 'Enter the state';
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Enter a valid email';
  return e;
}

export default function AddressFormScreen() {
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const [form, setForm] = useState<Form>({ ...EMPTY, name: user?.name ?? '', phone: user?.mobile ?? '', email: user?.email ?? '' });
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    getAddress(Number(id))
      .then((a) =>
        setForm({
          name: a.name ?? '',
          phone: a.phone ?? '',
          house_name: a.house_name ?? '',
          building: a.building ?? '',
          locality: a.locality ?? '',
          area_code: a.area_code ?? '',
          city: a.city ?? '',
          state: a.state ?? '',
          country: a.country || 'India',
          email: a.email ?? '',
          is_default: Number(a.is_default) === 1,
        }),
      )
      .catch((e) => toast(errorMessage(e), 'error'));
  }, [id, toast]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  // Auto-fill city/state from the pincode.
  const onPincode = async (v: string) => {
    const pin = v.replace(/\D/g, '');
    set('area_code', pin);
    if (pin.length !== 6) return;
    const loc = await lookupPincode(pin);
    if (loc) setForm((f) => ({ ...f, city: f.city || loc.district, state: loc.state_name }));
  };

  const save = async () => {
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length || !user) return;
    setBusy(true);
    const payload: AddressInput = {
      name: form.name.trim(),
      phone: form.phone.replace(/\D/g, ''),
      house_name: form.house_name.trim(),
      building: form.building.trim() || null,
      locality: form.locality.trim() || null,
      area_code: form.area_code,
      city: form.city.trim(),
      state: form.state.trim(),
      country: form.country.trim() || 'India',
      email: form.email.trim() || null,
      is_default: form.is_default ? 1 : 0,
    };
    try {
      if (editing) await updateAddress(Number(id), payload);
      else await createAddress(user.id, payload);
      toast(editing ? 'Address updated' : 'Address saved', 'success');
      router.back();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title={editing ? 'Edit address' : 'Add address'} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32 }}>
          <Glass radius={radius.lg} style={{ padding: 16, gap: 14 }}>
            <Text variant="heading">Contact</Text>
            <Input label="Full name" value={form.name} onChangeText={(v) => set('name', v)} error={errors.name} autoComplete="name" />
            <Input
              label="Mobile number"
              prefix="+91"
              keyboardType="phone-pad"
              maxLength={10}
              value={form.phone}
              onChangeText={(v) => set('phone', v.replace(/\D/g, ''))}
              error={errors.phone}
            />
            <Input
              label="Email (optional)"
              keyboardType="email-address"
              autoCapitalize="none"
              value={form.email}
              onChangeText={(v) => set('email', v)}
              error={errors.email}
            />
          </Glass>

          <Glass radius={radius.lg} style={{ padding: 16, gap: 14 }}>
            <Text variant="heading">Address</Text>
            <Input
              label="Pincode"
              icon="location-outline"
              keyboardType="number-pad"
              maxLength={6}
              value={form.area_code}
              onChangeText={onPincode}
              error={errors.area_code}
            />
            <Input label="House / flat no." value={form.house_name} onChangeText={(v) => set('house_name', v)} error={errors.house_name} />
            <Input label="Building / street (optional)" value={form.building} onChangeText={(v) => set('building', v)} />
            <Input label="Area / locality (optional)" value={form.locality} onChangeText={(v) => set('locality', v)} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Input label="City" value={form.city} onChangeText={(v) => set('city', v)} error={errors.city} />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="State" value={form.state} onChangeText={(v) => set('state', v)} error={errors.state} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="label">Make this my default address</Text>
              <Switch
                value={form.is_default}
                onValueChange={(v) => set('is_default', v)}
                trackColor={{ true: t.primary, false: t.hairline }}
                thumbColor="#fff"
              />
            </View>
          </Glass>

          <Button title={editing ? 'Save changes' : 'Save address'} onPress={save} loading={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
