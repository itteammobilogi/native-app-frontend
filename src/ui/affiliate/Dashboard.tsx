import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, View } from 'react-native';

import {
  affDate,
  getAffiliateOrders,
  getAffiliatePayouts,
  monthLabel,
  rupees,
  type AffiliateMe,
  type AffiliateOrder,
} from '@/core/api/affiliate';
import { useAsync } from '@/core/hooks/useAsync';
import { Button } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { Input } from '@/ui/Input';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';

// Website: components/affiliate/Dashboard.js.

const STATUS: Record<string, { label: string; tone: 'warning' | 'success' | 'muted' }> = {
  pending: { label: 'Waiting', tone: 'warning' },
  approved: { label: 'Earned', tone: 'success' },
  paid: { label: 'Paid', tone: 'success' },
  reversed: { label: 'Cancelled', tone: 'muted' },
  no_commission: { label: 'No commission', tone: 'muted' },
};

const REASON: Record<string, string> = {
  own_purchase: 'Bought through your own link',
  coupon_rule: 'A ZillyBuy coupon was used',
  budget_used: "This month's budget was used up",
  suspended: 'Your account was paused',
  no_delivery: 'Not delivered',
  nothing_kept: 'Returned or refunded',
  return_or_refund: 'Returned or refunded',
  fraud: 'Cancelled by ZillyBuy',
  manual: 'Cancelled by ZillyBuy',
};

// No clipboard module in the app: the share sheet offers Copy on both platforms.
const shareLink = (url: string) => Share.share({ message: url }).catch(() => {});

function buildLink(input: string, code: string): { url?: string; error?: string } {
  const raw = input.trim();
  if (!raw) return {};
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/(^|\.)zillybuy\.com$/i.test(u.hostname)) return { error: 'Paste a link from zillybuy.com.' };
    u.searchParams.set('ref', code);
    return { url: u.toString() };
  } catch {
    return { error: "That doesn't look like a web address." };
  }
}

export function Dashboard({ me }: { me: AffiliateMe }) {
  const t = usePalette();
  const d = me.dashboard!;
  const p = me.programme;
  const [page, setPage] = useState(1);
  const [builderInput, setBuilderInput] = useState('');
  const orders = useAsync(() => getAffiliateOrders(page), [page]);
  const payouts = useAsync(getAffiliatePayouts, []);
  const pages = Math.max(1, Math.ceil((orders.data?.total || 0) / (orders.data?.page_size || 20)));
  const built = me.code ? buildLink(builderInput, me.code) : {};

  const tiles: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; hint?: string }[] = [
    { icon: 'finger-print-outline', label: 'Clicks, 30 days', value: d.clicks_30d.toLocaleString('en-IN') },
    { icon: 'bag-outline', label: 'Orders, 30 days', value: d.orders_30d.toLocaleString('en-IN') },
    { icon: 'hourglass-outline', label: 'Waiting', value: rupees(d.pending_amount), hint: 'Until delivered and kept' },
    { icon: 'wallet-outline', label: 'Ready for payout', value: rupees(d.ready_amount), hint: `Paid from ${rupees(p.min_payout)}` },
    { icon: 'cash-outline', label: 'Paid to you', value: rupees(d.paid_amount), hint: d.tds_deducted ? `TDS ${rupees(d.tds_deducted)}` : undefined },
  ];

  return (
    <View style={{ gap: 14 }}>
      {(d.budget?.state === 'used' || d.budget?.state === 'near') && (
        <Notice
          text={
            d.budget.state === 'used'
              ? "This month's commission budget is used up. Orders through your link are still tracked, but won't earn until the 1st."
              : "This month's commission budget is nearly used up. Once it runs out, orders won't earn until the 1st."
          }
        />
      )}

      {!!me.code && !!me.link && (
        <Glass radius={radius.lg} style={styles.card}>
          <Text variant="heading">Your link</Text>
          {me.link_paused && (
            <Text variant="caption" style={{ color: t.warning }}>
              Paused: accept the updated terms above to start tracking new visits again.
            </Text>
          )}
          <View style={[styles.linkBox, { backgroundColor: `${t.primary}14` }]}>
            <Text variant="label" tone="primary" selectable style={{ flex: 1 }}>
              {me.link}
            </Text>
          </View>
          <Button title="Share or copy link" icon="share-social-outline" size="md" onPress={() => shareLink(me.link!)} />
          <Text variant="caption" tone="muted">
            Your code is {me.code}. Add ?ref={me.code} to any zillybuy.com link. Please label your posts as ads, for example “#ad”.
          </Text>
          <Input
            label="Link to a product or page"
            placeholder={`${me.site_url || 'https://zillybuy.com'}/product/...`}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={builderInput}
            onChangeText={setBuilderInput}
            error={built.error}
          />
          {built.url ? (
            <>
              <Text variant="caption" selectable>
                {built.url}
              </Text>
              <Button title="Share this link" variant="glass" size="md" icon="share-outline" onPress={() => shareLink(built.url!)} />
            </>
          ) : (
            !built.error && (
              <Text variant="caption" tone="faint">
                Paste any zillybuy.com link and we’ll add your code to it.
              </Text>
            )
          )}
        </Glass>
      )}

      <View style={styles.tiles}>
        {tiles.map((x) => (
          <Glass key={x.label} radius={radius.lg} style={styles.tile}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={x.icon} size={14} color={t.textFaint} />
              <Text variant="tiny" tone="muted">
                {x.label}
              </Text>
            </View>
            <Text variant="heading">{x.value}</Text>
            {!!x.hint && (
              <Text variant="tiny" tone="faint">
                {x.hint}
              </Text>
            )}
          </Glass>
        ))}
      </View>

      <Glass radius={radius.lg} style={styles.card}>
        <Text variant="heading">Orders through your link</Text>
        <Text variant="caption" tone="muted">
          We never show who bought. Commission is final {p.hold_days} days after delivery.
        </Text>
        {orders.loading ? (
          <ActivityIndicator color={t.primary} style={{ margin: 12 }} />
        ) : !orders.data?.rows.length ? (
          <Text tone="muted" style={{ textAlign: 'center', marginVertical: 12 }}>
            No orders yet. Share your link and orders will show here.
          </Text>
        ) : (
          orders.data.rows.map((o) => <OrderRow key={o.order_ref} o={o} />)
        )}
        {pages > 1 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Button title="Newer" variant="glass" size="md" style={{ flex: 1 }} disabled={page <= 1 || orders.loading} onPress={() => setPage(page - 1)} />
            <Text variant="caption" tone="muted">
              {page} / {pages}
            </Text>
            <Button title="Older" variant="glass" size="md" style={{ flex: 1 }} disabled={page >= pages || orders.loading} onPress={() => setPage(page + 1)} />
          </View>
        )}
      </Glass>

      <Glass radius={radius.lg} style={styles.card}>
        <Text variant="heading">Payouts</Text>
        <Text variant="caption" tone="muted">
          Paid around the {p.payout_day}th for commission confirmed the month before.
        </Text>
        {!payouts.data?.length ? (
          <Text tone="muted">No payouts yet.</Text>
        ) : (
          payouts.data.map((x) => (
            <View key={x.period_month} style={[styles.rowItem, { borderTopColor: t.hairline }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="label">{monthLabel(x.period_month)}</Text>
                <Text variant="caption" tone="muted">
                  {rupees(x.gross)} − TDS {rupees(x.tds_amount)}
                </Text>
                <Text variant="tiny" tone="faint">
                  {x.status === 'paid' ? `Paid ${affDate(x.paid_at)}` : x.status === 'held' ? 'On hold' : 'Being processed'}
                  {x.utr ? ` · Ref ${x.utr}` : ''}
                </Text>
              </View>
              <Text variant="heading">{rupees(x.net)}</Text>
            </View>
          ))
        )}
      </Glass>
    </View>
  );
}

function OrderRow({ o }: { o: AffiliateOrder }) {
  const t = usePalette();
  const s = STATUS[o.status] ?? STATUS.pending;
  const color = s.tone === 'warning' ? t.warning : s.tone === 'success' ? t.success : t.textMuted;
  const note = o.reason
    ? (REASON[o.reason] ?? null)
    : o.status === 'pending' && o.hold_until
      ? `Final after ${affDate(o.hold_until)}`
      : o.status === 'pending'
        ? 'Waiting for delivery'
        : null;
  return (
    <View style={[styles.rowItem, { borderTopColor: t.hairline }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label">{o.order_ref}</Text>
        <Text variant="caption" tone="muted">
          {affDate(o.created_at)} · Order {rupees(o.order_value)}
        </Text>
        <Text variant="tiny" style={{ color }}>
          {s.label}
          {note ? ` · ${note}` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text variant="heading">{rupees(o.commission)}</Text>
        {!o.is_final && o.status === 'pending' && (
          <Text variant="tiny" tone="faint">
            estimate
          </Text>
        )}
      </View>
    </View>
  );
}

export function Notice({ text }: { text: string }) {
  const t = usePalette();
  return (
    <View style={[styles.notice, { backgroundColor: `${t.warning}1A` }]}>
      <Ionicons name="warning-outline" size={18} color={t.warning} />
      <Text variant="caption" style={{ flex: 1, color: t.warning }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 10 },
  linkBox: { padding: 12, borderRadius: radius.md },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '45%', flexGrow: 1, padding: 12, gap: 4 },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  notice: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.md, alignItems: 'flex-start' },
});
