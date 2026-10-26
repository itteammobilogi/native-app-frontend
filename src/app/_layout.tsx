import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';

import { AuthProvider, useAuth } from '@/core/auth/AuthContext';
import { CartProvider } from '@/core/cart/CartContext';
import { LocationProvider } from '@/core/location/LocationContext';
import { PushSync } from '@/core/PushSync';
import { IntroSplash } from '@/ui/IntroSplash';
import { usePalette } from '@/ui/theme';
import { ToastProvider } from '@/ui/Toast';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const t = usePalette();
  const base = t.dark ? DarkTheme : DefaultTheme;
  // Transparent navigation background so each screen's gradient shows through.
  const theme = { ...base, colors: { ...base.colors, background: 'transparent', primary: t.primary } };

  return (
    <ThemeProvider value={theme}>
      <ToastProvider>
        <AuthProvider>
          <LocationProvider>
            <CartProvider>
              <SplashGate />
              <PushSync />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="login" options={{ presentation: 'modal' }} />
                <Stack.Screen name="assistant" options={{ animation: 'slide_from_bottom' }} />
                <Stack.Screen name="payment" options={{ gestureEnabled: false }} />
                <Stack.Screen name="order-success" options={{ gestureEnabled: false, animation: 'fade' }} />
              </Stack>
              <Intro />
            </CartProvider>
          </LocationProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

// Animated launch intro over the app. The native splash is a plain colour
// (no logo) matching the intro's first frame, so the hand-off is seamless.
function Intro() {
  const { ready } = useAuth();
  const [done, setDone] = useState(false);
  const finish = useCallback(() => setDone(true), []);
  if (done) return null;
  return <IntroSplash start={ready} onDone={finish} />;
}

// Keep the splash up until the stored session has been read, so the first
// frame already knows whether the user is logged in.
function SplashGate() {
  const { ready } = useAuth();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  return null;
}
