import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { CASHFREE_MODE, WEBSITE_URL } from '@/core/config';
import { IconButton } from '@/ui/Button';
import { Header, Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { usePalette } from '@/ui/theme';

// Runs Cashfree's hosted web checkout (the same JS SDK the website uses) in a
// WebView, so payment works in Expo Go without a native SDK. After payment
// Cashfree returns to api.zillybuy.com/api/payment/cashfree/verify, which
// finalises the order on the server and 302s to zillybuy.com/thankyou or
// /checkout?status=failed — we catch that final redirect and go native.
const html = (session: string) => `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>body{font-family:-apple-system,Roboto,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#5B6B82}</style>
</head><body><p id="m">Opening secure payment…</p>
<script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
<script>
  try {
    var cf = Cashfree({ mode: ${JSON.stringify(CASHFREE_MODE)} });
    cf.checkout({ paymentSessionId: ${JSON.stringify(session)}, redirectTarget: "_self" });
  } catch (e) {
    document.getElementById('m').innerText = 'Could not start payment. Please go back and try again.';
  }
</script></body></html>`;

export default function PaymentScreen() {
  const { session, order_id, amount } = useLocalSearchParams<{ session: string; order_id: string; amount?: string }>();
  const t = usePalette();
  const [loading, setLoading] = useState(true);
  const handled = useRef(false);

  const finish = (url: string) => {
    if (handled.current) return;
    const u = new URL(url);
    if (u.pathname.startsWith('/thankyou')) {
      handled.current = true;
      router.replace({
        pathname: '/order-success',
        params: { order_id: u.searchParams.get('order_id') ?? order_id, amount: u.searchParams.get('amount') ?? amount ?? '' },
      });
    } else if (u.pathname.startsWith('/checkout') && u.searchParams.get('status') === 'failed') {
      handled.current = true;
      const msg = u.searchParams.get('msg');
      // amount_mismatch means money was captured — don't ask them to pay again.
      Alert.alert(
        'Payment not completed',
        msg === 'amount_mismatch'
          ? 'We received your payment but need to verify it. Our team will contact you — please do not pay again.'
          : 'Your payment did not go through. No money was charged, or it will be refunded automatically.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    }
  };

  const onRequest = (req: WebViewNavigation) => {
    const url = req.url;
    // UPI / bank app intents must be opened by the OS.
    if (!/^(https?|about|data|blob):/i.test(url)) {
      Linking.openURL(url).catch(() => Alert.alert('App not found', 'Please choose another payment method.'));
      return false;
    }
    if (url.startsWith(WEBSITE_URL) || url.startsWith(WEBSITE_URL.replace('://', '://www.'))) {
      const path = new URL(url).pathname;
      if (path.startsWith('/thankyou') || path.startsWith('/checkout')) {
        finish(url);
        return false;
      }
    }
    return true;
  };

  const cancel = () =>
    Alert.alert('Cancel payment?', 'Your order will not be placed until payment is complete.', [
      { text: 'Continue paying', style: 'cancel' },
      { text: 'Cancel', style: 'destructive', onPress: () => router.back() },
    ]);

  return (
    <Screen>
      <Header title="Secure payment" back={false} right={<IconButton icon="close" label="Cancel payment" onPress={cancel} />} />
      <View style={styles.web}>
        <WebView
          // baseUrl gives the page the website's origin, which Cashfree's
          // production SDK is whitelisted for.
          source={{ html: html(session), baseUrl: WEBSITE_URL }}
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={onRequest}
          onNavigationStateChange={(s) => s.url.startsWith(WEBSITE_URL + '/') && finish(s.url)}
          onLoadEnd={() => setLoading(false)}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          style={{ backgroundColor: 'transparent' }}
        />
        {loading && (
          <View style={[StyleSheet.absoluteFill, styles.loader]}>
            <ActivityIndicator size="large" color={t.primary} />
            <Text tone="muted">Opening secure payment…</Text>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, marginHorizontal: 12, marginBottom: 12, borderRadius: 20, overflow: 'hidden', backgroundColor: '#fff' },
  loader: { alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#fff' },
});
