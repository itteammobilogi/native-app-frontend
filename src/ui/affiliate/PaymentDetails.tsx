import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { View } from 'react-native';

import { AffiliateError, saveAffiliatePaymentDetails, type AffiliateMe, type PaymentInfo } from '@/core/api/affiliate';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Glass } from '@/ui/Glass';
import { Input } from '@/ui/Input';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

// Website: components/affiliate/PaymentDetails.js. Saved values come back
// masked, so editing always starts with empty PAN/account fields.
export function PaymentDetails({ payment, onSaved }: { payment: PaymentInfo; onSaved: (me: AffiliateMe) => void }) {
  const t = usePalette();
  const toast = useToast();
  const has = payment.has_details;
  const [editing, setEditing] = useState(!has);
  const [form, setForm] = useState({
    pan: '',
    pan_name: payment.pan_name ?? '',
    payout_method: 'bank',
    bank_account: '',
    ifsc: '',
    upi_id: '',
    gstin: payment.gstin ?? '',
    address: payment.address ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      const next = await saveAffiliatePaymentDetails(form);
      toast('Payment details saved', 'success');
      setEditing(false);
      setErrors({});
      onSaved(next);
    } catch (e) {
      if (e instanceof AffiliateError && e.errors) setErrors(e.errors);
      toast(e instanceof Error ? e.message : 'Something went wrong.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <Glass radius={radius.lg} style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text variant="heading">Payment and tax details</Text>
            <Text variant="caption" tone="muted">
              Saved securely. Only the last digits are shown.
            </Text>
          </View>
          <Button title="Change" variant="glass" size="md" onPress={() => setEditing(true)} />
        </View>
        <Row label="PAN" value={`${payment.pan_masked ?? ''} · ${payment.pan_name ?? ''}`} />
        <Row
          label={payment.payout_method === 'upi' ? 'UPI ID' : 'Bank account'}
          value={payment.payout_method === 'upi' ? (payment.upi_masked ?? '') : `${payment.account_masked ?? ''} · ${payment.ifsc ?? ''}`}
        />
        {!!payment.gstin && <Row label="GSTIN" value={payment.gstin} />}
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Ionicons
            name={payment.bank_verified ? 'checkmark-circle' : 'time-outline'}
            size={16}
            color={payment.bank_verified ? t.success : t.warning}
          />
          <Text variant="caption" style={{ flex: 1, color: payment.bank_verified ? t.success : t.warning }}>
            {payment.bank_verified ? 'Account checked by our team' : 'Our team will check the account name before your first payout'}
          </Text>
        </View>
      </Glass>
    );
  }

  return (
    <Glass radius={radius.lg} style={{ padding: 16, gap: 14 }}>
      <View style={{ gap: 4 }}>
        <Text variant="heading">Payment and tax details</Text>
        <Text variant="caption" tone="muted">
          Needed before your first payout. The account must be in the same name as your PAN. We deduct TDS as the law requires.
        </Text>
      </View>
      <Input label="PAN" value={form.pan} onChangeText={(v) => set('pan')(v.toUpperCase())} maxLength={10} autoCapitalize="characters" autoCorrect={false} placeholder="ABCDE1234F" error={errors.pan} />
      <Input label="Name on PAN" value={form.pan_name} onChangeText={set('pan_name')} maxLength={120} error={errors.pan_name} />
      <View style={{ gap: 6 }}>
        <Text variant="caption" tone="muted">
          Pay me by
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label="Bank transfer" active={form.payout_method === 'bank'} onPress={() => set('payout_method')('bank')} />
          <Chip label="UPI" active={form.payout_method === 'upi'} onPress={() => set('payout_method')('upi')} />
        </View>
      </View>
      {form.payout_method === 'bank' ? (
        <>
          <Input label="Account number" value={form.bank_account} onChangeText={set('bank_account')} keyboardType="number-pad" maxLength={22} error={errors.bank_account} />
          <Input label="IFSC" value={form.ifsc} onChangeText={(v) => set('ifsc')(v.toUpperCase())} autoCapitalize="characters" autoCorrect={false} maxLength={11} placeholder="HDFC0001234" error={errors.ifsc} />
        </>
      ) : (
        <Input label="UPI ID" value={form.upi_id} onChangeText={set('upi_id')} autoCapitalize="none" autoCorrect={false} maxLength={100} placeholder="name@okhdfcbank" error={errors.upi_id} />
      )}
      <Input label="GSTIN (only if you are registered)" value={form.gstin} onChangeText={(v) => set('gstin')(v.toUpperCase())} autoCapitalize="characters" maxLength={15} error={errors.gstin} />
      <Input label="Postal address" value={form.address} onChangeText={set('address')} multiline maxLength={500} error={errors.address} />
      {has && (
        <Text variant="caption" tone="faint">
          Changing these details means our team checks the account again before your next payout.
        </Text>
      )}
      <Button title="Save details" onPress={save} loading={busy} />
      {has && <Button title="Cancel" variant="ghost" size="md" onPress={() => (setEditing(false), setErrors({}))} />}
    </Glass>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="label">{value}</Text>
    </View>
  );
}
