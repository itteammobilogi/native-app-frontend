import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AffiliateError, joinAffiliate, rupees, type AffiliateMe } from '@/core/api/affiliate';
import { TERMS_VERSION } from '@/core/affiliateTerms';
import { Button, tap } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Glass } from '@/ui/Glass';
import { Input } from '@/ui/Input';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

import { AffiliateTerms, TermsUpdating, termsTextIsCurrent } from './AffiliateTerms';

const CHANNELS: [string, string][] = [
  ['instagram', 'Instagram'],
  ['youtube', 'YouTube'],
  ['whatsapp', 'WhatsApp'],
  ['telegram', 'Telegram'],
  ['facebook', 'Facebook'],
  ['website', 'Website or blog'],
  ['other', 'Somewhere else'],
];
const AUDIENCE: [string, string][] = [
  ['<1k', 'Under 1,000'],
  ['1k-10k', '1,000 to 10,000'],
  ['10k-100k', '10,000 to 1 lakh'],
  ['>100k', 'Over 1 lakh'],
];

function ChipField({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: [string, string][];
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {options.map(([v, l]) => (
          <Chip key={v} label={l} active={value === v} onPress={() => onChange(v)} />
        ))}
      </ScrollView>
      {!!error && (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      )}
    </View>
  );
}

// Website: components/affiliate/JoinForm.js — invitation + application.
export function JoinForm({ me, onJoined }: { me: AffiliateMe; onJoined: (me: AffiliateMe) => void }) {
  const t = usePalette();
  const toast = useToast();
  const p = me.programme;
  const textCurrent = termsTextIsCurrent(me);
  const [form, setForm] = useState({ display_name: '', channel_type: '', channel_url: '', audience_band: '', pitch: '', accept_terms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof form>(k: K) => (v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setBusy(true);
    try {
      const next = await joinAffiliate({ ...form, terms_version: TERMS_VERSION });
      toast('Application sent', 'success');
      onJoined(next);
    } catch (e) {
      if (e instanceof AffiliateError && e.errors) setErrors(e.errors);
      toast(e instanceof Error ? e.message : 'Something went wrong.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 14 }}>
      <Glass radius={radius.lg} style={{ padding: 16, gap: 8 }}>
        <Text variant="tiny" tone="primary" style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
          You’re invited
        </Text>
        <Text variant="title">Earn by sharing ZillyBuy</Text>
        {[
          'You get a personal link to any page on zillybuy.com.',
          `When someone buys within ${p.tracking_days} days of clicking it, you earn ${p.rate}% of the order${p.cap ? `, up to ${rupees(p.cap)} per order` : ''}.`,
          `Commission is confirmed ${p.hold_days} days after delivery, if nothing is returned.`,
          `We pay monthly on the ${p.payout_day}th once you have at least ${rupees(p.min_payout)}.`,
        ].map((line) => (
          <View key={line} style={{ flexDirection: 'row', gap: 8 }}>
            <Ionicons name="checkmark-circle" size={16} color={t.success} style={{ marginTop: 2 }} />
            <Text tone="muted" style={{ flex: 1 }}>
              {line}
            </Text>
          </View>
        ))}
      </Glass>

      <Glass radius={radius.lg} style={{ padding: 16, gap: 14 }}>
        <Text variant="heading">Tell us about you</Text>
        <Input label="Name to show" value={form.display_name} onChangeText={set('display_name')} maxLength={120} error={errors.display_name} placeholder="Your name or your page's name" />
        <ChipField label="Where will you share your links?" options={CHANNELS} value={form.channel_type} onChange={set('channel_type')} error={errors.channel_type} />
        <Input
          label="Link to your page, channel or group"
          value={form.channel_url}
          onChangeText={set('channel_url')}
          maxLength={255}
          autoCapitalize="none"
          keyboardType="url"
          placeholder="instagram.com/yourpage"
          error={errors.channel_url}
        />
        <ChipField label="How many people follow you?" options={AUDIENCE} value={form.audience_band} onChange={set('audience_band')} error={errors.audience_band} />
        <Input label="How will you promote ZillyBuy? (optional)" value={form.pitch} onChangeText={set('pitch')} multiline maxLength={2000} error={errors.pitch} />

        <Text variant="heading" style={{ marginTop: 4 }}>
          Programme terms
        </Text>
        <View style={{ maxHeight: 280, borderRadius: radius.md, borderWidth: 1, borderColor: t.hairline }}>
          <ScrollView nestedScrollEnabled contentContainerStyle={{ padding: 12 }}>
            <AffiliateTerms programme={p} version={me.terms.version} />
          </ScrollView>
        </View>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: form.accept_terms }}
          onPress={() => (tap(), set('accept_terms')(!form.accept_terms))}
          style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Ionicons name={form.accept_terms ? 'checkbox' : 'square-outline'} size={22} color={form.accept_terms ? t.primary : t.textFaint} />
          <Text variant="caption" style={{ flex: 1 }}>
            I have read and accept the programme terms, including labelling my posts as ads.
          </Text>
        </Pressable>
        {!!errors.accept_terms && (
          <Text variant="caption" tone="danger">
            {errors.accept_terms}
          </Text>
        )}
        {!textCurrent && <TermsUpdating />}
        <Button title="Send application" onPress={submit} loading={busy} disabled={!textCurrent} />
      </Glass>
    </View>
  );
}
