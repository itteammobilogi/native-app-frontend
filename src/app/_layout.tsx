import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';

import { AuthProvider, useAuth } from '@/core/auth/AuthContext';
import { CartProvider } from '@/core/cart/CartContext';
import { LocationProvider } from '@/core/location/LocationContext';
import { PushSync } from '@/core/PushSync';
import { SavedProvider } from '@/core/saved/SavedContext';
import { IntroGate } from '@/ui/introGate';
import { IntroSplash } from '@/ui/IntroSplash';
import { usePalette } from '@/ui/theme';
import { ToastProvider } from '@/ui/Toast';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const t = usePalette();
  const base = t.dark ? DarkTheme : DefaultTheme;
  // Transparent navigation background so each screen's gradient shows through.
  const theme = { ...base, colors: { ...base.colors, background: 'transparent', primary: t.primary } };
  const [introDone, setIntroDone] = useState(false);
  const finishIntro = useCallback(() => setIntroDone(true), []);
  const [revealed, setRevealed] = useState(false);
  const reveal = useCallback(() => setRevealed(true), []);

  return (
    <ThemeProvider value={theme}>
      <ToastProvider>
        <AuthProvider>
          <LocationProvider>
            <CartProvider>
              <SavedProvider>
                <PushSync canPrompt={introDone} />
                <IntroGate.Provider value={revealed || introDone}>
                  <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="login" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="assistant" options={{ animation: 'slide_from_bottom' }} />
                    <Stack.Screen name="payment" options={{ gestureEnabled: false }} />
                    <Stack.Screen name="order-success" options={{ gestureEnabled: false, animation: 'fade' }} />
                  </Stack>
                </IntroGate.Provider>
                {!introDone && <Intro onReveal={reveal} onDone={finishIntro} />}
              </SavedProvider>
            </CartProvider>
          </LocationProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

// Animated launch intro over the app. The native splash is a plain colour
// (no logo) matching the intro's first frame, so the hand-off is seamless.
// The splash stays up until the stored session has been read (so the first
// frame already knows whether the user is logged in); the intro starts once
// it is actually gone, so none of the animation plays behind it.
function Intro({ onReveal, onDone }: { onReveal: () => void; onDone: () => void }) {
  const { ready } = useAuth();
  const [splashHidden, setSplashHidden] = useState(false);
  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync()
      .catch(() => {})
      .finally(() => requestAnimationFrame(() => setSplashHidden(true)));
  }, [ready]);
  return <IntroSplash start={splashHidden} onReveal={onReveal} onDone={onDone} />;
}
