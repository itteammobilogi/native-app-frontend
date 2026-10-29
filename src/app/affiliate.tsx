import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { acceptAffiliateTerms, AffiliateError, getAffiliateMe, type AffiliateMe } from '@/core/api/affiliate';
import { TERMS_VERSION } from '@/core/affiliateTerms';
import { useAuth } from '@/core/auth/AuthContext';
import { useAsync } from '@/core/hooks/useAsync';
import { AffiliateTerms, TermsUpdating, termsTextIsCurrent } from '@/ui/affiliate/AffiliateTerms';
import { Dashboard, Notice } from '@/ui/affiliate/Dashboard';
import { HelpSheet } from '@/ui/affiliate/HelpSheet';
import { JoinForm } from '@/ui/affiliate/JoinForm';
import { PaymentDetails } from '@/ui/affiliate/PaymentDetails';
import { Button, IconButton } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { usePageInsets } from '@/ui/GlassTabBar';
import { EmptyState, ErrorState, Header, Screen } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { radius } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

// Website: /affiliate. One screen for every stage: invitation + join form →
// application received → dashboard (link, numbers, orders, payouts, payment
// details) → paused. Only invited users and affiliates get anything but 404;
// the Account tab shows the entry only to them (profile.affiliate_status).
export default function AffiliateScreen() {
  const insets = usePageInsets();
  const toast = useToast();
  const { isLoggedIn } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const res = useAsync(async (): Promise<{ me: AffiliateMe | null }> => {
    if (!isLoggedIn) return { me: null };
    try {
      return { me: await getAffiliateMe() };
    } catch (e) {
      // Only "not for you" is a not-found; anything else offers a retry.
      if (e instanceof AffiliateError && [401, 403, 404].includes(e.status)) return { me: null };
      throw e;
    }
  }, [isLoggedIn]);

  const me = res.data?.me ?? null;
  const setMe = (next: AffiliateMe) => res.setData(() => ({ me: next }));

  const accept = async () => {
    setAccepting(true);
    try {
      await acceptAffiliateTerms(TERMS_VERSION);
      toast('Thanks, terms accepted. Your link is working again.', 'success');
      res.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong.', 'error');
    } finally {
      setAccepting(false);
    }
  };

  const joined = me && me.status !== 'invited' && me.status !== 'can_apply';

  const body = () => {
    if (res.loading) {
      return (
        <View style={{ gap: 12 }}>
          <Skeleton height={160} r={radius.lg} />
          <Skeleton height={220} r={radius.lg} />
        </View>
      );
    }
    if (res.error) return <ErrorState message={res.error} onRetry={res.reload} />;
    if (!me) {
      return (
        <EmptyState
          icon="people-outline"
          title="Affiliate programme"
          message="The ZillyBuy affiliate programme is invite-only. If you've been invited, log in with the same account."
          action={isLoggedIn ? 'Back to account' : 'Log in'}
          onAction={() => (isLoggedIn ? router.back() : router.push({ pathname: '/login', params: { next: '/affiliate' } }))}
        />
      );
    }
    if (me.status === 'invited' || me.status === 'can_apply') return <JoinForm me={me} onJoined={setMe} />;
    if (me.status === 'pending') {
      return (
        <EmptyState
          icon="time-outline"
          title="Application received"
          message="We'll email you when it's reviewed. Your link appears here once you're approved."
          action="Continue shopping"
          onAction={() => router.replace('/')}
        />
      );
    }
    return (
      <View style={{ gap: 14 }}>
        {me.terms?.needs_acceptance && (
          <Glass radius={radius.lg} style={{ padding: 16, gap: 10 }}>
            <Text variant="heading">The programme terms have changed</Text>
            <Text variant="caption" tone="muted">
              {me.link_paused
                ? "Your link is paused until you accept them. New visits through it aren't tracked, so they won't earn. People who clicked your link before the change still count, and what you've already earned is not affected."
                : 'Please read and accept the updated terms.'}
            </Text>
            {termsTextIsCurrent(me) ? (
              <>
                <Button title={showTerms ? 'Hide terms' : 'Read the terms'} variant="ghost" size="md" onPress={() => setShowTerms((v) => !v)} />
                {showTerms && <AffiliateTerms programme={me.programme} version={me.terms.version} />}
                <Button title="Accept the terms" onPress={accept} loading={accepting} />
              </>
            ) : (
              <TermsUpdating />
            )}
          </Glass>
        )}
        {me.status === 'suspended' && (
          <Notice text="Your affiliate account is paused, so new orders through your link don't earn commission. What you've already earned is not affected. Use Need help if you have questions." />
        )}
        {me.dashboard && <Dashboard me={me} />}
        {me.status === 'approved' && me.payment && <PaymentDetails payment={me.payment} onSaved={setMe} />}
        {!me.terms?.needs_acceptance && (
          <Glass radius={radius.lg} style={{ padding: 16, gap: 10 }}>
            <Button title={showTerms ? 'Hide programme terms' : 'Programme terms'} variant="ghost" size="md" icon="document-text-outline" onPress={() => setShowTerms((v) => !v)} />
            {showTerms && <AffiliateTerms programme={me.programme} version={me.terms?.version} />}
          </Glass>
        )}
      </View>
    );
  };

  return (
    <Screen tabBar="account">
      <Header title="Affiliate" right={joined ? <IconButton icon="help-circle-outline" label="Need help" onPress={() => setHelpOpen(true)} /> : undefined} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32, flexGrow: 1 }}>
          {!!joined && (
            <Text tone="muted" style={{ marginLeft: 2 }}>
              Share ZillyBuy and earn on the orders you bring.
            </Text>
          )}
          {body()}
        </ScrollView>
      </KeyboardAvoidingView>
      <HelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} supportEmail={me?.programme?.support_email} />
    </Screen>
  );
}
