import { View } from 'react-native';

import { rupees, type AffiliateMe, type Programme } from '@/core/api/affiliate';
import { TERMS_BLOCKS, TERMS_TITLE, TERMS_VERSION } from '@/core/affiliateTerms';
import { Text } from '@/ui/Text';
import { usePalette } from '@/ui/theme';

// True when the wording shipped in the app is the version the programme
// requires; otherwise nobody may accept until the app has the new text.
export const termsTextIsCurrent = (me: AffiliateMe) => String(me.terms?.version || '') === TERMS_VERSION;

function couponRuleText(p: Programme) {
  if (p.coupon_rule === 'pay_after_coupon') return 'Commission is paid on what the shopper paid after any ZillyBuy coupon.';
  if (p.coupon_rule === 'none_with_coupon') return 'No commission on orders where a ZillyBuy coupon is used.';
  return `No commission on orders where a ZillyBuy coupon worth more than ${rupees(p.coupon_rule_amount)} is used.`;
}

// The schedule is built from the live programme settings, as on the website.
function scheduleRows(p: Programme): [string, string][] {
  return [
    ['Tracking window', `${p.tracking_days} days from the click, last click wins`],
    ['Commission', `${p.rate}% of the delivered, kept items, after discounts, not counting delivery or tax`],
    ['Cap per order', p.cap ? rupees(p.cap) : 'No cap'],
    ['ZillyBuy coupons', couponRuleText(p)],
    ['Monthly programme budget', 'Set by ZillyBuy each month; see section 6.4'],
    ['Hold period', `${p.hold_days} days after delivery`],
    ['Payout date', `On or around the ${p.payout_day}th of each month`],
    ['Minimum payout', rupees(p.min_payout)],
    ['Payment methods', 'Bank transfer or UPI, in your own name'],
  ];
}

export function TermsUpdating() {
  const t = usePalette();
  return (
    <View style={{ padding: 12, borderRadius: 12, backgroundColor: `${t.warning}1A` }}>
      <Text variant="caption" style={{ color: t.warning }}>
        The programme terms are being updated. Please update the app or check back in a little while to read and accept them.
      </Text>
    </View>
  );
}

export function AffiliateTerms({ programme, version }: { programme?: Programme; version?: string }) {
  const t = usePalette();
  const support = programme?.support_email || '[affiliate support email]';
  return (
    <View style={{ gap: 8 }}>
      <Text variant="heading">{TERMS_TITLE}</Text>
      {!!version && (
        <Text variant="caption" tone="faint">
          Version {version}
        </Text>
      )}
      {TERMS_BLOCKS.map((b, i) => {
        const text = b.x.replace('[affiliate support email]', support);
        if (b.t === 'h')
          return (
            <Text key={i} variant="label" style={{ marginTop: 8 }}>
              {text}
            </Text>
          );
        return (
          <Text key={i} variant="caption" tone="muted" style={[{ lineHeight: 19 }, b.t === 'li' && { paddingLeft: 12 }]}>
            {text}
          </Text>
        );
      })}
      {programme && (
        <View style={{ marginTop: 10, gap: 6 }}>
          <Text variant="label">Schedule: current programme settings</Text>
          {scheduleRows(programme).map(([k, v]) => (
            <View key={k} style={{ paddingVertical: 6, borderTopWidth: 1, borderTopColor: t.hairline }}>
              <Text variant="caption">{k}</Text>
              <Text variant="caption" tone="muted">
                {v}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
