import { isAxiosError } from 'axios';

import { api } from './client';

// Account deletion, same endpoints as the website's /delete-account
// (website/node/ondc-zillybuy-node/controllers/accountDeletionController.js).
// A confirmed deletion deactivates the account for a 30-day grace period;
// signing in again during that window lets the owner restore it with an OTP.

export type DeletionBlocker = { code: string; message: string };

export type DeletionEligibility = {
  status: string;
  can_request: boolean;
  blockers: DeletionBlocker[];
  has_mobile: boolean;
  has_email: boolean;
  masked_mobile: string | null;
  masked_email: string | null;
  grace_period_days: number;
};

export type DeletionStatus = {
  account_status: 'active' | 'deletion_requested' | 'deactivated' | 'anonymized' | string;
  request_status: string | null;
  scheduled_purge_at: string | null;
  days_remaining: number | null;
  can_restore: boolean;
  restore_needs_otp: boolean;
  awaiting_otp: boolean;
  masked_mobile: string | null;
  masked_email: string | null;
  has_mobile: boolean;
};

export type OtpSent = {
  delivered_to: 'mobile' | 'email';
  masked_mobile: string | null;
  masked_email: string | null;
  expires_in_minutes: number;
};

export type DeletionResult = { message: string; mode: 'soft' | 'hard'; purge_at: string | null };

// The server's `code` (OTP_COOLDOWN, MOBILE_MISMATCH, ...) drives which step
// the screen moves to, so it is kept on the thrown error.
export class DeletionError extends Error {
  code: string | null;
  constructor(message: string, code: string | null) {
    super(message);
    this.code = code;
  }
}

async function call<T>(p: Promise<{ data: { message?: string; data?: T } }>, fallback: string) {
  try {
    const { data } = await p;
    return { message: data.message ?? '', ...(data.data as T) };
  } catch (e) {
    if (isAxiosError(e)) {
      const body = e.response?.data as { message?: string; error?: string; code?: string } | undefined;
      throw new DeletionError(body?.message || body?.error || fallback, body?.code ?? null);
    }
    throw new DeletionError(fallback, null);
  }
}

export const getDeletionEligibility = () =>
  call<DeletionEligibility>(api.get('/api/users/account/deletion/eligibility'), 'Could not check whether this account can be deleted');

export const getDeletionStatus = () =>
  call<DeletionStatus>(api.get('/api/users/account/deletion/status'), 'Could not read the deletion status');

// `mobile` is required the first time (it must match the number on file);
// a resend from the OTP step omits it.
export const sendDeletionOtp = (p: { reason?: string; mobile?: string }) =>
  call<OtpSent>(api.post('/api/users/account/deletion/send-otp', { mode: 'soft', ...p }), 'Could not send the verification code');

export const confirmDeletion = (otp: string) =>
  call<DeletionResult>(api.post('/api/users/account/deletion/confirm', { otp }), 'Could not complete account deletion');

export const sendRestoreOtp = (mobile?: string) =>
  call<OtpSent>(api.post('/api/users/account/restore/send-otp', { mobile }), 'Could not send the verification code');

// Without an OTP this abandons an unconfirmed request; with one it restores a
// deactivated account.
export const cancelDeletion = (otp = '') =>
  call<object>(api.post('/api/users/account/deletion/cancel', { otp }), 'Could not cancel the deletion request');
