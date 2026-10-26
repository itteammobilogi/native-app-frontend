import { isAxiosError } from 'axios';

import { api } from './client';

// Affiliate programme (website: My Account → Affiliate, /affiliate); routes in
// website/node/ondc-zillybuy-node/routes/affiliateRoute.js. Every endpoint
// answers 404 to anyone who isn't invited or an affiliate.

export type AffiliateStatus = 'invited' | 'can_apply' | 'pending' | 'approved' | 'suspended' | string;

export type Programme = {
  rate: number;
  cap: number | null;
  tracking_days: number;
  hold_days: number;
  payout_day: number;
  min_payout: number;
  coupon_rule: 'pay_after_coupon' | 'none_with_coupon' | string;
  coupon_rule_amount?: number;
  support_email?: string | null;
};

export type PaymentInfo = {
  has_details: boolean;
  pan_masked?: string;
  pan_name?: string;
  payout_method?: 'bank' | 'upi';
  account_masked?: string;
  ifsc?: string;
  upi_masked?: string;
  gstin?: string | null;
  address?: string | null;
  bank_verified?: boolean;
};

export type AffiliateMe = {
  status: AffiliateStatus;
  programme: Programme;
  terms: { version: string; needs_acceptance?: boolean };
  code?: string;
  link?: string;
  site_url?: string;
  link_paused?: boolean;
  payment?: PaymentInfo;
  dashboard?: {
    clicks_30d: number;
    orders_30d: number;
    pending_amount: number;
    ready_amount: number;
    paid_amount: number;
    tds_deducted?: number;
    budget?: { state?: 'ok' | 'near' | 'used' | string };
  };
};

export type AffiliateOrder = {
  order_ref: string;
  created_at: string;
  order_value: number;
  commission: number;
  status: 'pending' | 'approved' | 'paid' | 'reversed' | 'no_commission' | string;
  reason?: string | null;
  hold_until?: string | null;
  is_final?: boolean;
};

export type AffiliatePayout = {
  period_month: string; // YYYY-MM
  gross: number;
  tds_amount: number;
  net: number;
  status: 'paid' | 'held' | string;
  paid_at?: string | null;
  utr?: string | null;
};

// Field errors come back as {errors: {field: message}} on a 400.
export class AffiliateError extends Error {
  status: number;
  errors: Record<string, string> | null;
  constructor(message: string, status: number, errors: Record<string, string> | null) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function call<T>(p: Promise<{ data: { data?: T } }>): Promise<T> {
  try {
    const { data } = await p;
    return data.data as T;
  } catch (e) {
    if (isAxiosError(e)) {
      const body = e.response?.data as { message?: string; errors?: Record<string, string> } | undefined;
      throw new AffiliateError(
        body?.errors ? 'Please check the highlighted fields.' : body?.message || 'Something went wrong. Please try again.',
        e.response?.status ?? 0,
        body?.errors ?? null,
      );
    }
    throw new AffiliateError('Something went wrong. Please try again.', 0, null);
  }
}

export const getAffiliateMe = () => call<AffiliateMe>(api.get('/api/affiliate/me'));

export const joinAffiliate = (form: {
  display_name: string;
  channel_type: string;
  channel_url: string;
  audience_band: string;
  pitch: string;
  accept_terms: boolean;
  terms_version: string;
}) => call<AffiliateMe>(api.post('/api/affiliate/join', form));

export const acceptAffiliateTerms = (terms_version: string) => call<unknown>(api.post('/api/affiliate/accept-terms', { terms_version }));

export const getAffiliateOrders = (page = 1) =>
  call<{ rows: AffiliateOrder[]; total: number; page: number; page_size: number }>(api.get('/api/affiliate/orders', { params: { page } }));

export const getAffiliatePayouts = () => call<AffiliatePayout[]>(api.get('/api/affiliate/payouts')).then((d) => (Array.isArray(d) ? d : []));

export const saveAffiliatePaymentDetails = (form: Record<string, string>) =>
  call<AffiliateMe>(api.put('/api/affiliate/payment-details', form));

export const sendAffiliateHelp = (topic: string, message: string) => call<unknown>(api.post('/api/affiliate/help', { topic, message }));

export const rupees = (n?: number | string | null) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const affDate = (v?: string | null) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
};

export const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};
